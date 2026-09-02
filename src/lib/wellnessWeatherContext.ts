import { and, asc, eq, gte, lte } from "drizzle-orm";
import { format, startOfWeek } from "date-fns";
import { db } from "@/src/db/client";
import { wellnessCheckins } from "@/src/db/schema";
import { fetchCityWeather, type CityWeatherData } from "@/src/lib/cityWeather";
import type { LlmWellnessCheckinInput } from "@/src/lib/ragLlmAnalysis";

export function weekMondayYmdForDate(d: Date): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function toLlmWellness(
  row: typeof wellnessCheckins.$inferSelect
): LlmWellnessCheckinInput {
  return {
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
    water: row.water ?? null,
    stressAnchor: row.stressAnchor ?? null,
    nutritionMulti: Array.isArray(row.nutritionMulti) ? row.nutritionMulti : null,
    supplementsList: Array.isArray(row.supplementsList)
      ? row.supplementsList
      : null,
    concernSpecific: row.concernSpecific ?? null,
    flags: Array.isArray(row.flags) ? row.flags : null,
  };
}

export async function loadWellnessCheckinForWeek(
  userId: string,
  weekYmd: string
): Promise<LlmWellnessCheckinInput | null> {
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
  return row ? toLlmWellness(row) : null;
}

export async function loadWellnessCheckinsInRange(
  userId: string,
  weekYmdFrom: string,
  weekYmdTo: string
): Promise<LlmWellnessCheckinInput[]> {
  const rows = await db
    .select()
    .from(wellnessCheckins)
    .where(
      and(
        eq(wellnessCheckins.userId, userId),
        gte(wellnessCheckins.weekYmd, weekYmdFrom),
        lte(wellnessCheckins.weekYmd, weekYmdTo)
      )
    )
    .orderBy(asc(wellnessCheckins.weekYmd));
  return rows.map(toLlmWellness);
}

/** Wellness for the scan's week + live weather when city is present. */
export async function loadWellnessAndWeatherForScan(opts: {
  userId: string;
  scanDate: Date;
}): Promise<{
  wellness: LlmWellnessCheckinInput | null;
  cityWeather: CityWeatherData | null;
}> {
  const weekYmd = weekMondayYmdForDate(opts.scanDate);
  const wellness = await loadWellnessCheckinForWeek(opts.userId, weekYmd);
  const city = wellness?.city?.trim();
  const cityWeather = city ? await fetchCityWeather(city) : null;
  return { wellness, cityWeather };
}
