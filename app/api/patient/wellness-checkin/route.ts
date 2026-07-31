import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { format, startOfWeek } from "date-fns";
import { db } from "@/src/db";
import { wellnessCheckins } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

const NUTRITION = new Set([
  "High Protein",
  "Low Protein",
  "Low Calorie",
  "Eating Outside",
]);
const EXERCISE = new Set(["0-2", "2-4", "4-6", "6+"]);
const SLEEP = new Set(["<4", "4-6", "6-8", "8+"]);
const ROUTINE = new Set(["Cleanser", "Toner/Serum", "Moisturiser", "Sunscreen"]);

export type WellnessCheckinPayload = {
  id: string;
  nutritionLevel: string | null;
  exerciseHours: string | null;
  sleepHours: string | null;
  supplements: string | null;
  stressLevel: number | null;
  city: string | null;
  skincareRoutine: string[] | null;
  activeIngredients: string | null;
  weekYmd: string;
  createdAt: string;
  updatedAt: string;
};

export function currentWeekMondayYmd(now = new Date()): string {
  return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function rowToPayload(
  row: typeof wellnessCheckins.$inferSelect
): WellnessCheckinPayload {
  return {
    id: row.id,
    nutritionLevel: row.nutritionLevel ?? null,
    exerciseHours: row.exerciseHours ?? null,
    sleepHours: row.sleepHours ?? null,
    supplements: row.supplements ?? null,
    stressLevel: row.stressLevel ?? null,
    city: row.city ?? null,
    skincareRoutine: Array.isArray(row.skincareRoutine)
      ? row.skincareRoutine
      : null,
    activeIngredients: row.activeIngredients ?? null,
    weekYmd: row.weekYmd,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function optionalText(v: unknown, max = 500): string | null | "INVALID" {
  if (v == null) return null;
  if (typeof v !== "string") return "INVALID";
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) return "INVALID";
  return t;
}

function parseBody(body: unknown):
  | {
      nutritionLevel: string | null;
      exerciseHours: string | null;
      sleepHours: string | null;
      supplements: string | null;
      stressLevel: number | null;
      city: string | null;
      skincareRoutine: string[] | null;
      activeIngredients: string | null;
    }
  | { error: string } {
  if (!body || typeof body !== "object") return { error: "INVALID_BODY" };
  const b = body as Record<string, unknown>;

  const nutritionLevel =
    b.nutritionLevel == null || b.nutritionLevel === ""
      ? null
      : typeof b.nutritionLevel === "string" && NUTRITION.has(b.nutritionLevel)
        ? b.nutritionLevel
        : "INVALID";
  if (nutritionLevel === "INVALID") return { error: "INVALID_NUTRITION" };

  const exerciseHours =
    b.exerciseHours == null || b.exerciseHours === ""
      ? null
      : typeof b.exerciseHours === "string" && EXERCISE.has(b.exerciseHours)
        ? b.exerciseHours
        : "INVALID";
  if (exerciseHours === "INVALID") return { error: "INVALID_EXERCISE" };

  const sleepHours =
    b.sleepHours == null || b.sleepHours === ""
      ? null
      : typeof b.sleepHours === "string" && SLEEP.has(b.sleepHours)
        ? b.sleepHours
        : "INVALID";
  if (sleepHours === "INVALID") return { error: "INVALID_SLEEP" };

  const supplements = optionalText(b.supplements, 500);
  if (supplements === "INVALID") return { error: "INVALID_SUPPLEMENTS" };

  let stressLevel: number | null = null;
  if (b.stressLevel != null && b.stressLevel !== "") {
    const n =
      typeof b.stressLevel === "number"
        ? b.stressLevel
        : Number.parseInt(String(b.stressLevel), 10);
    if (!Number.isFinite(n) || n < 1 || n > 10) return { error: "INVALID_STRESS" };
    stressLevel = Math.round(n);
  }

  const city = optionalText(b.city, 120);
  if (city === "INVALID") return { error: "INVALID_CITY" };

  let skincareRoutine: string[] | null = null;
  if (Array.isArray(b.skincareRoutine)) {
    const items: string[] = [];
    for (const item of b.skincareRoutine) {
      if (typeof item !== "string" || !ROUTINE.has(item)) {
        return { error: "INVALID_ROUTINE" };
      }
      if (!items.includes(item)) items.push(item);
    }
    skincareRoutine = items.length > 0 ? items : null;
  } else if (b.skincareRoutine != null) {
    return { error: "INVALID_ROUTINE" };
  }

  const activeIngredients = optionalText(b.activeIngredients, 500);
  if (activeIngredients === "INVALID") return { error: "INVALID_INGREDIENTS" };

  const hasAny =
    nutritionLevel != null ||
    exerciseHours != null ||
    sleepHours != null ||
    supplements != null ||
    stressLevel != null ||
    city != null ||
    (skincareRoutine != null && skincareRoutine.length > 0) ||
    activeIngredients != null;

  if (!hasAny) return { error: "EMPTY" };

  return {
    nutritionLevel,
    exerciseHours,
    sleepHours,
    supplements,
    stressLevel,
    city,
    skincareRoutine,
    activeIngredients,
  };
}

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const weekYmd = currentWeekMondayYmd();
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

  return NextResponse.json({
    weekYmd,
    checkin: row ? rowToPayload(row) : null,
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

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const weekYmd = currentWeekMondayYmd();
  const now = new Date();

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

  if (existing) {
    const [updated] = await db
      .update(wellnessCheckins)
      .set({
        ...parsed,
        updatedAt: now,
      })
      .where(eq(wellnessCheckins.id, existing.id))
      .returning();
    return NextResponse.json({
      success: true,
      updated: true,
      weekYmd,
      checkin: updated ? rowToPayload(updated) : null,
    });
  }

  const [created] = await db
    .insert(wellnessCheckins)
    .values({
      userId,
      weekYmd,
      ...parsed,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({
    success: true,
    updated: false,
    weekYmd,
    checkin: created ? rowToPayload(created) : null,
  });
}
