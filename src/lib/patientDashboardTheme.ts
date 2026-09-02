/** Patient dashboard - SkinFit Wellness brand tokens. */
export const PATIENT_MINT_BG = "#FAF8F5";
export const PATIENT_NAVY = "#1E1B31";
export const PATIENT_NAVY_HOVER = "#242A5F";
export const PATIENT_GREEN = "#4CAF50";
export const PATIENT_CARD_BG = "#FFFFFF";
export const PATIENT_CARD_BORDER = "#E4E6F0";
export const PATIENT_TEXT = "#1E1B31";
export const PATIENT_MUTED = "#5B66A1";

/** @deprecated use PATIENT_MINT_BG */
export const PATIENT_SAGE = "#F0EAE2";
/** @deprecated */
export const PATIENT_SAGE_MUTED = "#F8EDEE";

export const patientDashboardCard =
  "rounded-[20px] border border-[#E4E6F0] bg-white p-5 md:p-6";

export const patientDashboardNavyCard =
  "rounded-[20px] bg-[#1E1B31] p-5 md:p-6";

export const patientGlassShell = patientDashboardCard;

export const patientInnerCard =
  "rounded-xl border border-[#E4E6F0] bg-white";

export const patientSectionIcon =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1E1B31]/10 text-[#1E1B31]";

export const patientPageTitle =
  "font-headline text-2xl font-extrabold tracking-tight text-[#1E1B31] sm:text-3xl";

export const patientSectionTitle = "font-headline text-lg font-bold text-[#1E1B31]";

export const patientKicker =
  "font-meta text-[11px] font-bold uppercase tracking-wide text-[#1E1B31]/60";

export const patientMuted = "text-sm text-[#5B66A1]";

export const patientPrimaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E1B31] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#242A5F] disabled:cursor-not-allowed disabled:opacity-50";

export const patientSecondaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E4E6F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#1E1B31] transition hover:bg-[#FAF8F5]";

export const patientInputBase =
  "rounded-xl border border-[#E4E6F0] bg-white px-4 py-3 text-[#1E1B31] placeholder:text-[#5B66A1]/60 outline-none focus:border-[#1E1B31]/40 focus:ring-2 focus:ring-[#1E1B31]/10 disabled:opacity-60";

export const patientInput = `w-full max-w-full ${patientInputBase}`;

export const patientFormSection =
  "min-w-0 overflow-hidden rounded-xl border border-[#E4E6F0] bg-white p-5 sm:p-6";

export const patientStatTile =
  "rounded-xl border border-[#E4E6F0] bg-white px-3.5 py-3";

export const patientScoreChip =
  "rounded-md bg-[#FAF8F5] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#1E1B31]";

/** Locked weekly trend glyph (↑ / ↓ / -). */
export function lockedWeeklyProgressSymbol(weeklyDeltaScore: number): string {
  if (weeklyDeltaScore > 0) return "↑";
  if (weeklyDeltaScore < 0) return "↓";
  return "-";
}

/** @deprecated Prefer icons via weeklyTrendDirection; kept for string fallbacks. */
export function lockedWeeklyProgressLabel(weeklyDeltaScore: number): string {
  return lockedWeeklyProgressSymbol(weeklyDeltaScore);
}

export type WeeklyTrendDirection = "up" | "down" | "flat" | "none";

export function weeklyTrendDirection(delta: number | null): WeeklyTrendDirection {
  if (delta === null || !Number.isFinite(delta)) return "none";
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

export function lockedWeeklyTrendAria(delta: number | null): string {
  const dir = weeklyTrendDirection(delta);
  if (dir === "up") return "Trending up";
  if (dir === "down") return "Trending down";
  if (dir === "flat") return "No change";
  return "Not available";
}

export function patientWeeklyDeltaLabel(
  delta: number | null,
  scoresUnlocked: boolean
): string {
  if (delta === null) return "-";
  if (!scoresUnlocked) return lockedWeeklyProgressLabel(delta);
  return `${delta > 0 ? "+" : ""}${delta}`;
}
