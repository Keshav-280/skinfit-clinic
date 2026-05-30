import { and, desc, eq, lte } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/src/db/schema";
import { routinePlanRevisions, users } from "@/src/db/schema";
import {
  dateOnlyFromYmd,
  localCalendarYmd,
  parseYmdToDateOnly,
  ymdFromDateOnly,
} from "@/src/lib/date-only";
import { coerceRoutinePlanList } from "@/src/lib/routine";

const FAR_PAST_YMD = "1970-01-01";

export type RoutinePlanSnapshot = {
  amItems: string[];
  pmItems: string[];
  amLen: number;
  pmLen: number;
};

export type RoutinePlanRevisionRow = {
  effectiveFrom: Date | string;
  amItems: unknown;
  pmItems: unknown;
};

export function parseEffectiveFromYmd(
  input: unknown
): { ok: true; ymd: string; date: Date } | { ok: false; error: string } {
  if (input === undefined || input === null || input === "") {
    const ymd = localCalendarYmd();
    return { ok: true, ymd, date: dateOnlyFromYmd(ymd) };
  }
  if (typeof input !== "string") {
    return { ok: false, error: "effectiveFromYmd must be YYYY-MM-DD." };
  }
  const ymd = input.trim().slice(0, 10);
  const date = parseYmdToDateOnly(ymd);
  if (!date) {
    return { ok: false, error: "effectiveFromYmd must be YYYY-MM-DD." };
  }
  return { ok: true, ymd, date };
}

export function resolveRoutinePlanForYmd(
  revisions: RoutinePlanRevisionRow[],
  fallback: { amItems: string[]; pmItems: string[] },
  ymd: string
): RoutinePlanSnapshot {
  for (const rev of revisions) {
    const revYmd = ymdFromDateOnly(rev.effectiveFrom);
    if (revYmd <= ymd) {
      const amItems = coerceRoutinePlanList(rev.amItems);
      const pmItems = coerceRoutinePlanList(rev.pmItems);
      return { amItems, pmItems, amLen: amItems.length, pmLen: pmItems.length };
    }
  }
  return {
    amItems: fallback.amItems,
    pmItems: fallback.pmItems,
    amLen: fallback.amItems.length,
    pmLen: fallback.pmItems.length,
  };
}

export async function loadRoutinePlanRevisions(
  db: NeonHttpDatabase<typeof schema>,
  userId: string
): Promise<RoutinePlanRevisionRow[]> {
  return db
    .select({
      effectiveFrom: routinePlanRevisions.effectiveFrom,
      amItems: routinePlanRevisions.amItems,
      pmItems: routinePlanRevisions.pmItems,
    })
    .from(routinePlanRevisions)
    .where(eq(routinePlanRevisions.userId, userId))
    .orderBy(desc(routinePlanRevisions.effectiveFrom));
}

export async function getRoutinePlanForDate(
  db: NeonHttpDatabase<typeof schema>,
  userId: string,
  ymd: string
): Promise<RoutinePlanSnapshot> {
  if (!parseYmdToDateOnly(ymd)) {
    return { amItems: [], pmItems: [], amLen: 0, pmLen: 0 };
  }

  const effectiveDate = dateOnlyFromYmd(ymd);
  const [rev] = await db
    .select({
      amItems: routinePlanRevisions.amItems,
      pmItems: routinePlanRevisions.pmItems,
    })
    .from(routinePlanRevisions)
    .where(
      and(
        eq(routinePlanRevisions.userId, userId),
        lte(routinePlanRevisions.effectiveFrom, effectiveDate)
      )
    )
    .orderBy(desc(routinePlanRevisions.effectiveFrom))
    .limit(1);

  if (rev) {
    const amItems = coerceRoutinePlanList(rev.amItems);
    const pmItems = coerceRoutinePlanList(rev.pmItems);
    return { amItems, pmItems, amLen: amItems.length, pmLen: pmItems.length };
  }

  const [u] = await db
    .select({
      am: users.routinePlanAmItems,
      pm: users.routinePlanPmItems,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const amItems = coerceRoutinePlanList(u?.am);
  const pmItems = coerceRoutinePlanList(u?.pm);
  return { amItems, pmItems, amLen: amItems.length, pmLen: pmItems.length };
}

/** Snapshot the current users-table plan before the first dated revision. */
export async function ensureInitialRoutineRevision(
  db: NeonHttpDatabase<typeof schema>,
  userId: string
): Promise<void> {
  const [existing] = await db
    .select({ id: routinePlanRevisions.id })
    .from(routinePlanRevisions)
    .where(eq(routinePlanRevisions.userId, userId))
    .limit(1);
  if (existing) return;

  const [u] = await db
    .select({
      am: users.routinePlanAmItems,
      pm: users.routinePlanPmItems,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return;

  const amItems = coerceRoutinePlanList(u.am);
  const pmItems = coerceRoutinePlanList(u.pm);
  if (amItems.length === 0 && pmItems.length === 0) return;

  const effectiveFrom = u.createdAt
    ? dateOnlyFromYmd(ymdFromDateOnly(u.createdAt))
    : dateOnlyFromYmd(FAR_PAST_YMD);

  await db.insert(routinePlanRevisions).values({
    userId,
    effectiveFrom,
    amItems,
    pmItems,
    createdByStaffId: null,
  });
}

export async function insertRoutinePlanRevision(
  db: NeonHttpDatabase<typeof schema>,
  opts: {
    userId: string;
    effectiveFrom: Date;
    amItems: string[];
    pmItems: string[];
    createdByStaffId?: string | null;
  }
): Promise<void> {
  await db
    .insert(routinePlanRevisions)
    .values({
      userId: opts.userId,
      effectiveFrom: opts.effectiveFrom,
      amItems: opts.amItems,
      pmItems: opts.pmItems,
      createdByStaffId: opts.createdByStaffId ?? null,
    })
    .onConflictDoUpdate({
      target: [
        routinePlanRevisions.userId,
        routinePlanRevisions.effectiveFrom,
      ],
      set: {
        amItems: opts.amItems,
        pmItems: opts.pmItems,
        createdByStaffId: opts.createdByStaffId ?? null,
      },
    });

  await db
    .update(users)
    .set({
      routinePlanAmItems: opts.amItems,
      routinePlanPmItems: opts.pmItems,
      routinePlanClinicianLocked: opts.amItems.length > 0 && opts.pmItems.length > 0,
    })
    .where(eq(users.id, opts.userId));
}
