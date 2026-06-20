import { asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  annotatorAssignments,
  annotatorImages,
  annotatorState,
  users,
} from "@/src/db/schema";
import {
  filterPersistedStateForRange,
  rebalanceAssignmentRanges,
  type AnnotatorAssignmentRange,
  type AnnotatorPersistedState,
} from "@/src/lib/annotatorAssignments";
import {
  annotatorUserScope,
  LEGACY_ANNOTATOR_SCOPE,
} from "@/src/lib/annotatorScope";

export type AnnotatorStateRow = {
  perImageByCategory: AnnotatorPersistedState["perImageByCategory"];
  annotations: AnnotatorPersistedState["annotations"];
  currentIndex: number;
  updatedAt: Date;
};

export async function countAnnotatorImages(): Promise<number> {
  const rows = await db.select({ id: annotatorImages.id }).from(annotatorImages);
  return rows.length;
}

export async function listAnnotatorAssignments(): Promise<AnnotatorAssignmentRange[]> {
  const rows = await db
    .select({
      userId: annotatorAssignments.userId,
      startIndex: annotatorAssignments.startIndex,
      endIndex: annotatorAssignments.endIndex,
      userName: users.name,
      userEmail: users.email,
    })
    .from(annotatorAssignments)
    .leftJoin(users, eq(annotatorAssignments.userId, users.id))
    .orderBy(asc(annotatorAssignments.startIndex));

  return rows.map((r) => ({
    userId: r.userId,
    startIndex: r.startIndex,
    endIndex: r.endIndex,
    userName: r.userName,
    userEmail: r.userEmail,
  }));
}

export async function resolveAnnotatorUserIds(input: {
  userIds?: string[];
  emails?: string[];
}): Promise<string[]> {
  const ids = [...new Set((input.userIds ?? []).map((s) => s.trim()).filter(Boolean))];
  const emails = [...new Set((input.emails ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean))];

  if (emails.length > 0) {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        or(
          ...emails.map((email) => sql`lower(${users.email}) = ${email}`)
        )!
      );
    const byEmail = new Map(rows.map((r) => [r.email.toLowerCase(), r.id]));
    for (const email of emails) {
      const id = byEmail.get(email);
      if (id) ids.push(id);
    }
  }

  return [...new Set(ids)];
}

async function readScopeState(scope: string): Promise<AnnotatorStateRow | null> {
  const [row] = await db
    .select({
      perImageByCategory: annotatorState.perImageByCategory,
      annotations: annotatorState.annotations,
      currentIndex: annotatorState.currentIndex,
      updatedAt: annotatorState.updatedAt,
    })
    .from(annotatorState)
    .where(eq(annotatorState.scope, scope))
    .limit(1);

  if (!row) return null;
  return {
    perImageByCategory: row.perImageByCategory ?? {},
    annotations: (row.annotations ?? []) as AnnotatorPersistedState["annotations"],
    currentIndex: row.currentIndex ?? 0,
    updatedAt: row.updatedAt,
  };
}

export async function getUserAnnotatorState(userId: string): Promise<AnnotatorStateRow | null> {
  return readScopeState(annotatorUserScope(userId));
}

async function upsertScopeState(scope: string, data: AnnotatorPersistedState): Promise<void> {
  const payload = {
    perImageByCategory: data.perImageByCategory ?? {},
    annotations: data.annotations ?? [],
    currentIndex: Math.max(0, Math.floor(data.currentIndex ?? 0)),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: annotatorState.id })
    .from(annotatorState)
    .where(eq(annotatorState.scope, scope))
    .limit(1);

  if (existing) {
    await db.update(annotatorState).set(payload).where(eq(annotatorState.id, existing.id));
  } else {
    await db.insert(annotatorState).values({ scope, ...payload });
  }
}

export async function saveUserAnnotatorState(
  userId: string,
  data: AnnotatorPersistedState
): Promise<void> {
  await upsertScopeState(annotatorUserScope(userId), data);
}

async function migrateLegacyDefaultToAssignments(
  ranges: AnnotatorAssignmentRange[]
): Promise<void> {
  const legacy = await readScopeState(LEGACY_ANNOTATOR_SCOPE);
  if (!legacy || ranges.length === 0) return;

  for (const range of ranges) {
    const slice = filterPersistedStateForRange(
      legacy,
      range.startIndex,
      range.endIndex
    );
    const existing = await getUserAnnotatorState(range.userId);
    const merged: AnnotatorPersistedState = {
      perImageByCategory: {
        ...(existing?.perImageByCategory ?? {}),
        ...slice.perImageByCategory,
      },
      annotations: [...(existing?.annotations ?? []), ...slice.annotations],
      currentIndex: existing?.currentIndex ?? slice.currentIndex,
    };
    await saveUserAnnotatorState(range.userId, merged);
  }

  await db.delete(annotatorState).where(eq(annotatorState.scope, LEGACY_ANNOTATOR_SCOPE));
}

export async function rebalanceAnnotatorAssignments(input: {
  userIds?: string[];
  emails?: string[];
}): Promise<{ assignments: AnnotatorAssignmentRange[]; imageCount: number }> {
  const userIds = await resolveAnnotatorUserIds(input);
  if (userIds.length === 0) {
    throw new Error("NO_ANNOTATORS_PROVIDED");
  }

  const imageCount = await countAnnotatorImages();
  const ranges = rebalanceAssignmentRanges(userIds, imageCount);

  await db.delete(annotatorAssignments);
  if (ranges.length > 0) {
    await db.insert(annotatorAssignments).values(
      ranges.map((r) => ({
        userId: r.userId,
        startIndex: r.startIndex,
        endIndex: r.endIndex,
        updatedAt: new Date(),
      }))
    );
  }

  await migrateLegacyDefaultToAssignments(ranges);

  const assignments = await listAnnotatorAssignments();
  return { assignments, imageCount };
}

export async function loadAnnotatorStatesByUserIds(
  userIds: string[]
): Promise<Map<string, AnnotatorPersistedState>> {
  const scopes = userIds.map((id) => annotatorUserScope(id));
  if (scopes.length === 0) return new Map();

  const rows = await db
    .select({
      scope: annotatorState.scope,
      perImageByCategory: annotatorState.perImageByCategory,
      annotations: annotatorState.annotations,
      currentIndex: annotatorState.currentIndex,
    })
    .from(annotatorState)
    .where(inArray(annotatorState.scope, scopes));

  const map = new Map<string, AnnotatorPersistedState>();
  for (const row of rows) {
    const userId = row.scope.startsWith("user:") ? row.scope.slice(5) : null;
    if (!userId) continue;
    map.set(userId, {
      perImageByCategory: row.perImageByCategory ?? {},
      annotations: (row.annotations ?? []) as AnnotatorPersistedState["annotations"],
      currentIndex: row.currentIndex ?? 0,
    });
  }
  return map;
}

export async function clearAllAnnotatorWork(): Promise<void> {
  await db.delete(annotatorAssignments);
  await db.delete(annotatorState);
}

export async function listAnnotatorImageMeta() {
  const rows = await db
    .select({
      fileName: annotatorImages.fileName,
      sortOrder: annotatorImages.sortOrder,
    })
    .from(annotatorImages)
    .orderBy(asc(annotatorImages.sortOrder), asc(annotatorImages.id));

  return rows.map((row, index) => ({
    index,
    fileName: row.fileName,
    imageWidth: null as number | null,
    imageHeight: null as number | null,
  }));
}
