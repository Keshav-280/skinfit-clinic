/** Keep in sync with repo root `src/lib/hydrationUnits.ts`. */

/** One journal “glass” — keep mobile + web display/save in sync. */
export const ML_PER_WATER_GLASS = 250;

export function snapHydrationMl(ml: number): number {
  return Math.round(Math.max(0, ml) / ML_PER_WATER_GLASS) * ML_PER_WATER_GLASS;
}

export function waterGlassesToMl(glasses: number): number {
  return Math.max(0, glasses) * ML_PER_WATER_GLASS;
}

export function waterGlassesToLiters(glasses: number): number {
  return waterGlassesToMl(glasses) / 1000;
}

export function formatWaterLiters(glasses: number, decimals = 2): string {
  return waterGlassesToLiters(glasses).toFixed(decimals);
}

export function mlToWaterGlasses(ml: number): number {
  return snapHydrationMl(ml) / ML_PER_WATER_GLASS;
}

/** Snap arbitrary liters input to the nearest 0.25 L (one glass). */
export function snapHydrationLiters(liters: number): number {
  return snapHydrationMl(liters * 1000) / 1000;
}
