import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { format, startOfWeek } from "date-fns";
import { db } from "@/src/db";
import { scans, wellnessCheckins } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { fetchCityWeather } from "@/src/lib/cityWeather";
import {
  nutritionKeysToLegacyLabel,
  stressAnchorToLegacyLevel,
  type CheckinConcernPath,
} from "@/src/lib/checkin/definitions";
import {
  computeCheckinFlags,
  emptyCheckinAnswers,
  type CheckinAnswers,
  type WeeklyCheckInPayload,
} from "@/src/lib/checkin/types";

export const runtime = "nodejs";

const CONCERNS = new Set<CheckinConcernPath>([
  "acne",
  "pigmentation",
  "wrinkles",
  "hair_loss",
  "weight_loss",
]);

export function currentWeekMondayYmd(now = new Date()): string {
  return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function parseAnswers(raw: unknown): CheckinAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const base = emptyCheckinAnswers();
  if (typeof a.sleep_hours === "string") base.sleep_hours = a.sleep_hours;
  if (typeof a.stress === "string") base.stress = a.stress;
  if (typeof a.water === "string") base.water = a.water;
  if (typeof a.exercise_hours === "string") base.exercise_hours = a.exercise_hours;
  if (Array.isArray(a.nutrition)) {
    base.nutrition = a.nutrition.filter((x): x is string => typeof x === "string");
  }
  if (Array.isArray(a.supplements)) {
    base.supplements = a.supplements.filter(
      (x): x is string => typeof x === "string"
    );
  }
  if (a.concernSpecific && typeof a.concernSpecific === "object") {
    base.concernSpecific = a.concernSpecific as CheckinAnswers["concernSpecific"];
  }
  return base;
}

function answersFromRow(
  row: typeof wellnessCheckins.$inferSelect
): CheckinAnswers {
  if (row.payload && typeof row.payload === "object") {
    const p = row.payload as WeeklyCheckInPayload;
    if (p.universal) {
      return {
        sleep_hours: p.universal.sleep_hours ?? row.sleepHours,
        stress: p.universal.stress ?? row.stressAnchor,
        water: p.universal.water ?? row.water,
        nutrition: p.universal.nutrition ?? row.nutritionMulti ?? [],
        exercise_hours: p.universal.exercise_hours ?? row.exerciseHours,
        supplements: p.universal.supplements ?? row.supplementsList ?? [],
        concernSpecific:
          (p.concern_specific as CheckinAnswers["concernSpecific"]) ??
          row.concernSpecific ??
          {},
      };
    }
  }
  return {
    sleep_hours: row.sleepHours,
    stress: row.stressAnchor,
    water: row.water,
    nutrition: row.nutritionMulti ?? [],
    exercise_hours: row.exerciseHours,
    supplements: row.supplementsList ?? [],
    concernSpecific: row.concernSpecific ?? {},
  };
}

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const weekYmd = url.searchParams.get("weekYmd") || currentWeekMondayYmd();

  const [row] = await db
    .select()
    .from(wellnessCheckins)
    .where(
      and(
        eq(wellnessCheckins.userId, userId),
        eq(wellnessCheckins.weekYmd, weekYmd)
      )
    )
    .limit(1);

  const scanCount = await db
    .select({ id: scans.id })
    .from(scans)
    .where(eq(scans.userId, userId))
    .limit(1);

  return NextResponse.json({
    weekYmd,
    hasScan: scanCount.length > 0,
    checkin: row
      ? {
          id: row.id,
          concern: row.concern,
          answers: answersFromRow(row),
          flags: row.flags ?? [],
          submittedAt: row.submittedAt?.toISOString() ?? null,
          payload: row.payload,
        }
      : null,
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const weekYmd =
    typeof b.weekYmd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.weekYmd)
      ? b.weekYmd
      : currentWeekMondayYmd();
  const concern =
    typeof b.concern === "string" && CONCERNS.has(b.concern as CheckinConcernPath)
      ? (b.concern as CheckinConcernPath)
      : null;
  if (!concern) {
    return NextResponse.json({ error: "INVALID_CONCERN" }, { status: 400 });
  }
  const answers = parseAnswers(b.answers);
  if (!answers?.sleep_hours || !answers.stress || !answers.water) {
    return NextResponse.json({ error: "INCOMPLETE_UNIVERSAL" }, { status: 400 });
  }
  if (!answers.exercise_hours) {
    return NextResponse.json({ error: "INCOMPLETE_UNIVERSAL" }, { status: 400 });
  }
  if (!answers.nutrition.length || !answers.supplements.length) {
    return NextResponse.json({ error: "INCOMPLETE_UNIVERSAL" }, { status: 400 });
  }

  const scanCount = await db
    .select({ id: scans.id })
    .from(scans)
    .where(eq(scans.userId, userId))
    .limit(1);
  if (scanCount.length === 0) {
    return NextResponse.json({ error: "SCAN_REQUIRED" }, { status: 403 });
  }

  const prior = await db
    .select({
      concernSpecific: wellnessCheckins.concernSpecific,
      flags: wellnessCheckins.flags,
      weekYmd: wellnessCheckins.weekYmd,
    })
    .from(wellnessCheckins)
    .where(
      and(
        eq(wellnessCheckins.userId, userId),
        ne(wellnessCheckins.weekYmd, weekYmd)
      )
    )
    .orderBy(desc(wellnessCheckins.weekYmd))
    .limit(8);

  const flags = computeCheckinFlags({
    concern,
    answers,
    priorWeeks: prior.map((p) => ({
      concernSpecific: p.concernSpecific,
      flags: p.flags,
      weekYmd: p.weekYmd,
    })),
  });

  // City from latest prior check-in or null - weather auto-detect when city known.
  const [priorCity] = await db
    .select({ city: wellnessCheckins.city })
    .from(wellnessCheckins)
    .where(eq(wellnessCheckins.userId, userId))
    .orderBy(desc(wellnessCheckins.updatedAt))
    .limit(1);
  const city = priorCity?.city?.trim() || null;
  const weather = city ? await fetchCityWeather(city) : null;

  const allScans = await db
    .select({ id: scans.id })
    .from(scans)
    .where(eq(scans.userId, userId));
  const weekNumber = Math.max(1, allScans.length);

  const now = new Date();
  const legacyNutrition = nutritionKeysToLegacyLabel(answers.nutrition);
  const legacyStress = stressAnchorToLegacyLevel(answers.stress);
  const supplementsText = answers.supplements
    .filter((s) => s !== "none")
    .join(", ");

  const [existing] = await db
    .select({ id: wellnessCheckins.id })
    .from(wellnessCheckins)
    .where(
      and(
        eq(wellnessCheckins.userId, userId),
        eq(wellnessCheckins.weekYmd, weekYmd)
      )
    )
    .limit(1);

  const payloadBase: Omit<WeeklyCheckInPayload, "checkin_id"> = {
    scan_id: null,
    week_number: weekNumber,
    completed_at: now.toISOString(),
    primary_concern: concern,
    universal: {
      sleep_hours: answers.sleep_hours,
      stress: answers.stress,
      water: answers.water,
      nutrition: answers.nutrition,
      exercise_hours: answers.exercise_hours,
      supplements: answers.supplements,
    },
    concern_specific: answers.concernSpecific,
    auto_detected: {
      city: weather?.city ?? city,
      uv_index_peak: weather?.uvIndex ?? null,
      humidity_pct_avg: weather?.humidity ?? null,
      humidity_delta_pct: null,
      aqi_avg: weather?.aqi ?? null,
      temp_c_avg: weather?.tempC ?? null,
    },
    flags,
  };

  const rowValues = {
    concern,
    water: answers.water,
    stressAnchor: answers.stress,
    nutritionMulti: answers.nutrition,
    supplementsList: answers.supplements,
    concernSpecific: answers.concernSpecific,
    flags,
    sleepHours: answers.sleep_hours,
    exerciseHours: answers.exercise_hours,
    nutritionLevel: legacyNutrition,
    stressLevel: legacyStress,
    supplements: supplementsText || null,
    city: weather?.city ?? city,
    submittedAt: now,
    updatedAt: now,
  };

  if (existing) {
    const payload: WeeklyCheckInPayload = {
      checkin_id: existing.id,
      ...payloadBase,
    };
    const [updated] = await db
      .update(wellnessCheckins)
      .set({ ...rowValues, payload })
      .where(eq(wellnessCheckins.id, existing.id))
      .returning();
    return NextResponse.json({
      ok: true,
      updated: true,
      weekYmd,
      flags,
      checkin: updated
        ? {
            id: updated.id,
            answers: answersFromRow(updated),
            flags: updated.flags ?? [],
            submittedAt: updated.submittedAt?.toISOString() ?? null,
            payload: updated.payload,
          }
        : null,
    });
  }

  const [created] = await db
    .insert(wellnessCheckins)
    .values({
      userId,
      weekYmd,
      ...rowValues,
      payload: null,
      createdAt: now,
    })
    .returning();

  if (!created) {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  }

  const payload: WeeklyCheckInPayload = {
    checkin_id: created.id,
    ...payloadBase,
  };
  const [finalRow] = await db
    .update(wellnessCheckins)
    .set({ payload })
    .where(eq(wellnessCheckins.id, created.id))
    .returning();

  return NextResponse.json({
    ok: true,
    updated: false,
    weekYmd,
    flags,
    checkin: finalRow
      ? {
          id: finalRow.id,
          answers: answersFromRow(finalRow),
          flags: finalRow.flags ?? [],
          submittedAt: finalRow.submittedAt?.toISOString() ?? null,
          payload: finalRow.payload,
        }
      : null,
  });
}
