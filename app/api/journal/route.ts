import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/src/db";
import { dailyLogs } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  AM_ROUTINE_LEN,
  normalizeRoutineSteps,
  PM_ROUTINE_LEN,
} from "@/src/lib/routine";
import { refreshUserStreakAfterRoutineDay } from "@/src/lib/userStreak";
import {
  localCalendarYmd,
  parseYmdToDateOnly,
  ymdFromDateOnly,
} from "@/src/lib/date-only";

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

    if (!row) {
      return NextResponse.json({ entry: null });
    }
    return NextResponse.json({ entry: serializeLog(row) });
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

  return NextResponse.json({ entry: row ? serializeLog(row) : null });
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

  const sleepHours = clampInt(body.sleepHours, 0, 24, 0);
  const stressLevel = clampInt(body.stressLevel, 0, 10, 5);
  const waterGlasses = clampInt(body.waterGlasses, 0, 40, 0);
  const journalEntry =
    typeof body.journalEntry === "string" ? body.journalEntry : null;
  const mood =
    typeof body.mood === "string" && body.mood.trim()
      ? body.mood.trim().slice(0, 100)
      : "Neutral";

  const routineAmSteps = normalizeRoutineSteps(
    body.routineAmSteps,
    AM_ROUTINE_LEN,
    existing?.routineAmSteps ?? undefined
  );
  const routinePmSteps = normalizeRoutineSteps(
    body.routinePmSteps,
    PM_ROUTINE_LEN,
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
      AM_ROUTINE_LEN,
      PM_ROUTINE_LEN
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

  if (!Array.isArray(body.routineAmSteps) || !Array.isArray(body.routinePmSteps)) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "routineAmSteps and routinePmSteps arrays required." },
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

  const amSteps = normalizeRoutineSteps(
    body.routineAmSteps,
    AM_ROUTINE_LEN,
    undefined
  );
  const pmSteps = normalizeRoutineSteps(
    body.routinePmSteps,
    PM_ROUTINE_LEN,
    undefined
  );

  const [existing] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, d)))
    .limit(1);

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
        AM_ROUTINE_LEN,
        PM_ROUTINE_LEN
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
      AM_ROUTINE_LEN,
      PM_ROUTINE_LEN
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
