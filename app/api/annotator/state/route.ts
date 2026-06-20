import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { annotatorState } from "@/src/db/schema";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  assignmentForUser,
  stripPersistedStateToAssignment,
  type AnnotatorPersistedState,
} from "@/src/lib/annotatorAssignments";
import {
  annotatorUserScope,
  LEGACY_ANNOTATOR_SCOPE,
} from "@/src/lib/annotatorScope";
import {
  getUserAnnotatorState,
  listAnnotatorAssignments,
  saveUserAnnotatorState,
} from "@/src/lib/annotatorParallelService";

type AnnotationShape = AnnotatorPersistedState["annotations"][number];

type PerImageByCategoryShape = AnnotatorPersistedState["perImageByCategory"];

async function migrateLegacyToUserIfNeeded(userId: string): Promise<void> {
  const userScope = annotatorUserScope(userId);
  const [userRow] = await db
    .select({ id: annotatorState.id })
    .from(annotatorState)
    .where(eq(annotatorState.scope, userScope))
    .limit(1);
  if (userRow) return;

  const [legacyRow] = await db
    .select({
      perImageByCategory: annotatorState.perImageByCategory,
      annotations: annotatorState.annotations,
      currentIndex: annotatorState.currentIndex,
    })
    .from(annotatorState)
    .where(eq(annotatorState.scope, LEGACY_ANNOTATOR_SCOPE))
    .limit(1);

  if (!legacyRow) return;

  await saveUserAnnotatorState(userId, {
    perImageByCategory: legacyRow.perImageByCategory ?? {},
    annotations: (legacyRow.annotations ?? []) as AnnotationShape[],
    currentIndex: legacyRow.currentIndex ?? 0,
  });
}

export async function GET(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await migrateLegacyToUserIfNeeded(userId);

  const assignments = await listAnnotatorAssignments();
  const mine = assignmentForUser(userId, assignments);
  const row = await getUserAnnotatorState(userId);

  return NextResponse.json({
    success: true,
    state: row
      ? {
          scope: annotatorUserScope(userId),
          perImageByCategory: row.perImageByCategory,
          annotations: row.annotations,
          currentIndex: row.currentIndex,
          updatedAt: row.updatedAt,
        }
      : null,
    parallel: {
      configured: assignments.length > 0,
      assignment: mine
        ? {
            startIndex: mine.startIndex,
            endIndex: mine.endIndex,
          }
        : null,
      team: assignments.map((a) => ({
        userId: a.userId,
        userName: a.userName ?? null,
        userEmail: a.userEmail ?? null,
        startIndex: a.startIndex,
        endIndex: a.endIndex,
      })),
    },
  });
}

export async function PUT(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        perImageByCategory?: PerImageByCategoryShape;
        annotations?: AnnotationShape[];
        currentIndex?: number;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
  }

  const assignments = await listAnnotatorAssignments();
  const mine = assignmentForUser(userId, assignments);

  const incoming: AnnotatorPersistedState = {
    perImageByCategory: body.perImageByCategory ?? {},
    annotations: body.annotations ?? [],
    currentIndex: Math.max(0, Math.floor(body.currentIndex ?? 0)),
  };

  const data = stripPersistedStateToAssignment(incoming, mine);
  await saveUserAnnotatorState(userId, data);

  return NextResponse.json({ success: true });
}
