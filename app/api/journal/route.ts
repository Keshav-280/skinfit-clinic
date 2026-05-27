import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/src/db";
import { dailyLogs, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { coerceRoutinePlanList, normalizeRoutineSteps } from "@/src/lib/routine";
import { refreshUserStreakAfterRoutineDay } from "@/src/lib/userStreak";
import {
  localCalendarYmd,
  parseYmdToDateOnly,
  ymdFromDateOnly,
} from "@/src/lib/date-only";
import { normalizeSleepQuality } from "@/src/lib/sleepQuality";

async function routineLensForUser(
  userId: string
): Promise<{ amLen: number; pmLen: number }> {
  const [r] = await db
    .select({
      am: users.routinePlanAmItems,
      pm: users.routinePlanPmItems,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!r) {
    return { amLen: 0, pmLen: 0 };
  }
  return {
    amLen: coerceRoutinePlanList(r.am).length,
    pmLen: coerceRoutinePlanList(r.pm).length,
  };
}

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");
  const dateParam = searchParams.get("date");

  if (before) {
    const beforeDate = parseYmdToDateOnly(before);
    if (!beforeDate) {
      return NextResponse.json(
        { error: "INVALID_DATE", message: "Use YYYY-MM-DD for before." },
        { status: 400 }
      );
    }
    const [row] = await db
      .select()
      .from(dailyLogs)
      .where(
        and(eq(dailyLogs.userId, userId), lt(dailyLogs.date, beforeDate))
      )
      .orderBy(desc(dailyLogs.date))
      .limit(1);

    const lens = await routineLensForUser(userId);
    if (!row) {
      return NextResponse.json({
        entry: null,
        routineAmLen: lens.amLen,
        routinePmLen: lens.pmLen,
      });
    }
    return NextResponse.json({
      entry: serializeLog(row),
      routineAmLen: lens.amLen,
      routinePmLen: lens.pmLen,
    });
  }

  const ymd = dateParam ?? localCalendarYmd();
  const d = parseYmdToDateOnly(ymd);
  if (!d) {
    return NextResponse.json(
      { error: "INVALID_DATE", message: "Use YYYY-MM-DD for date." },
      { status: 400 }
    );
  }

  const [row] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, d)))
    .limit(1);

  const lens = await routineLensForUser(userId);
  return NextResponse.json({
    entry: row ? serializeLog(row) : null,
    routineAmLen: lens.amLen,
    routinePmLen: lens.pmLen,
  });
}

type LogRow = typeof dailyLogs.$inferSelect;

function serializeLog(row: LogRow) {
  const date = ymdFromDateOnly(
    row.date instanceof Date ? row.date : String(row.date)
  );
  return {
    id: row.id,
    date,
    sleepHours: row.sleepHours,
    sleepQuality: row.sleepQuality ?? null,
    stressLevel: row.stressLevel,
    waterGlasses: row.waterGlasses,
    journalEntry: row.journalEntry,
    mood: row.mood,
    amRoutine: row.amRoutine,
    pmRoutine: row.pmRoutine,
    routineAmSteps: row.routineAmSteps ?? null,
    routinePmSteps: row.routinePmSteps ?? null,
    dietType: row.dietType ?? null,
    sunExposure: row.sunExposure ?? null,
    cycleDay: row.cycleDay ?? null,
    comments: row.comments ?? null,
  };
}

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    date?: string;
    sleepHours?: number;
    sleepQuality?: string | null;
    stressLevel?: number;
    waterGlasses?: number;
    journalEntry?: string | null;
    mood?: string;
    amRoutine?: boolean;
    pmRoutine?: boolean;
    routineAmSteps?: boolean[];
    routinePmSteps?: boolean[];
    dietType?: string | null;
    sunExposure?: string | null;
    cycleDay?: number | null;
    comments?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const ymd = typeof body.date === "string" ? body.date : localCalendarYmd();
  const d = parseYmdToDateOnly(ymd);
  if (!d) {
    return NextResponse.json(
      { error: "INVALID_DATE", message: "Use YYYY-MM-DD for date." },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, d)))
    .limit(1);

  const { amLen, pmLen } = await routineLensForUser(userId);

  const sleepHours = body.sleepHours != null
    ? clampFloat(body.sleepHours, 0, 24, existing?.sleepHours ?? 0)
    : (existing?.sleepHours ?? 0);
  const sleepQuality =
    body.sleepQuality !== undefined
      ? normalizeSleepQuality(
          body.sleepQuality,
          normalizeSleepQuality(existing?.sleepQuality, "average")
        )
      : normalizeSleepQuality(existing?.sleepQuality, "average");
  const stressLevel = body.stressLevel != null
    ? clampInt(body.stressLevel, 0, 10, existing?.stressLevel ?? 5)
    : (existing?.stressLevel ?? 5);
  const waterGlasses = body.waterGlasses != null
    ? clampInt(body.waterGlasses, 0, 40, existing?.waterGlasses ?? 0)
    : (existing?.waterGlasses ?? 0);
  const journalEntry =
    typeof body.journalEntry === "string" ? body.journalEntry
    : (existing?.journalEntry ?? null);
  const mood =
    typeof body.mood === "string" && body.mood.trim()
      ? body.mood.trim().slice(0, 100)
      : (existing?.mood ?? "Neutral");

  const routineAmSteps = normalizeRoutineSteps(
    body.routineAmSteps,
    amLen,
    existing?.routineAmSteps ?? undefined
  );
  const routinePmSteps = normalizeRoutineSteps(
    body.routinePmSteps,
    pmLen,
    existing?.routinePmSteps ?? undefined
  );
  const amRoutine = routineAmSteps.some(Boolean);
  const pmRoutine = routinePmSteps.some(Boolean);

  const dietType = normalizeDietType(body.dietType, existing?.dietType ?? null);
  const sunExposure = normalizeSunExposure(
    body.sunExposure,
    existing?.sunExposure ?? null
  );
  const cycleDay = normalizeCycleDay(body.cycleDay, existing?.cycleDay ?? null);
  const comments =
    typeof body.comments === "string"
      ? body.comments.trim().slice(0, 2000) || null
      : existing?.comments ?? null;

  // One row per user per calendar day: insert or overwrite (latest save wins).
  const [saved] = await db
    .insert(dailyLogs)
    .values({
      userId,
      date: d,
      sleepHours,
      sleepQuality,
      stressLevel,
      waterGlasses,
      journalEntry,
      mood,
      amRoutine,
      pmRoutine,
      routineAmSteps,
      routinePmSteps,
      dietType,
      sunExposure,
      cycleDay,
      comments,
    })
    .onConflictDoUpdate({
      target: [dailyLogs.userId, dailyLogs.date],
      set: {
        sleepHours,
        sleepQuality,
        stressLevel,
        waterGlasses,
        journalEntry,
        mood,
        amRoutine,
        pmRoutine,
        routineAmSteps,
        routinePmSteps,
        dietType,
        sunExposure,
        cycleDay,
        comments,
      },
    })
    .returning();

  if (saved) {
    await refreshUserStreakAfterRoutineDay(
      db,
      userId,
      d,
      routineAmSteps,
      routinePmSteps,
      amLen,
      pmLen
    );
  }

  return NextResponse.json({
    ok: true,
    entry: saved ? serializeLog(saved) : null,
  });
}

/** Update AM/PM step checklists only (immediate toggle); creates the daily row if missing. */
export async function PATCH(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    date?: string;
    routineAmSteps?: unknown;
    routinePmSteps?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const hasAm = Array.isArray(body.routineAmSteps);
  const hasPm = Array.isArray(body.routinePmSteps);
  if (!hasAm && !hasPm) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "At least one of routineAmSteps or routinePmSteps required." },
      { status: 400 }
    );
  }

  const ymd = typeof body.date === "string" ? body.date : localCalendarYmd();
  const d = parseYmdToDateOnly(ymd);
  if (!d) {
    return NextResponse.json(
      { error: "INVALID_DATE", message: "Use YYYY-MM-DD for date." },
      { status: 400 }
    );
  }

  const { amLen, pmLen } = await routineLensForUser(userId);

  const [existing] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, d)))
    .limit(1);

  const amSteps = normalizeRoutineSteps(
    hasAm ? body.routineAmSteps : (existing?.routineAmSteps ?? undefined),
    amLen,
    existing?.routineAmSteps ?? undefined
  );
  const pmSteps = normalizeRoutineSteps(
    hasPm ? body.routinePmSteps : (existing?.routinePmSteps ?? undefined),
    pmLen,
    existing?.routinePmSteps ?? undefined
  );

  if (existing) {
    const [updated] = await db
      .update(dailyLogs)
      .set({
        routineAmSteps: amSteps,
        routinePmSteps: pmSteps,
        amRoutine: amSteps.some(Boolean),
        pmRoutine: pmSteps.some(Boolean),
      })
      .where(eq(dailyLogs.id, existing.id))
      .returning();
    if (updated) {
      await refreshUserStreakAfterRoutineDay(
        db,
        userId,
        d,
        amSteps,
        pmSteps,
        amLen,
        pmLen
      );
    }
    return NextResponse.json({
      ok: true,
      entry: updated ? serializeLog(updated) : null,
    });
  }

  const [inserted] = await db
    .insert(dailyLogs)
    .values({
      userId,
      date: d,
      mood: "Neutral",
      sleepHours: 0,
      stressLevel: 5,
      waterGlasses: 0,
      journalEntry: null,
      amRoutine: amSteps.some(Boolean),
      pmRoutine: pmSteps.some(Boolean),
      routineAmSteps: amSteps,
      routinePmSteps: pmSteps,
    })
    .returning();

  if (inserted) {
    await refreshUserStreakAfterRoutineDay(
      db,
      userId,
      d,
      amSteps,
      pmSteps,
      amLen,
      pmLen
    );
  }

  return NextResponse.json({
    ok: true,
    entry: inserted ? serializeLog(inserted) : null,
  });
}

function normalizeDietType(
  v: unknown,
  fallback: string | null
): string | null {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== "string") return fallback;
  const x = v.trim().toLowerCase();
  if (x === "heavy" || x === "balanced" || x === "light") return x;
  return fallback;
}

function normalizeSunExposure(
  v: unknown,
  fallback: string | null
): string | null {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== "string") return fallback;
  const x = v.trim().toLowerCase();
  if (x === "low" || x === "moderate" || x === "high") return x;
  return fallback;
}

function normalizeCycleDay(
  v: unknown,
  fallback: number | null
): number | null {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  const n = Math.round(v);
  if (n < 1 || n > 35) return fallback;
  return n;
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampFloat(
  v: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
