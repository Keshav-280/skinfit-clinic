import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";

/** One-line hero title from the two worst markers. */
export function watchTitle(parameters: KaiReportParamRow[]): string {
  const sorted = [...parameters].sort((a, b) => b.severity - a.severity);
  if (sorted.length >= 2) {
    return `${sorted[0]!.shortName} and ${sorted[1]!.shortName.toLowerCase()} to watch`;
  }
  if (sorted.length === 1) {
    return `${sorted[0]!.shortName} is the one to watch`;
  }
  return "Your baseline is set";
}

export function shortHeadline(headline: string, max = 56): string {
  const first = headline.trim().split(/[.!?]/)[0]?.trim() || headline.trim();
  if (first.length <= max) return first;
  return `${first.slice(0, max - 1).trimEnd()}…`;
}

/** First clause of an action - card title, not the essay. */
export function actionLead(text: string): string {
  const cut = text.split(/[.\u2014]/)[0]?.trim() || text.trim();
  if (cut.length <= 52) return cut;
  return `${cut.slice(0, 50).trimEnd()}…`;
}

export function firstSentences(text: string, count = 2): string {
  const parts = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  if (parts.length <= count) return text.trim();
  return parts.slice(0, count).join(" ");
}

export const REPORT_CARD =
  "rounded-[24px] bg-white/80 shadow-[0_16px_44px_-22px_rgba(30, 27, 49,0.42)] backdrop-blur-md";

export const REPORT_PILL =
  "font-meta inline-flex w-fit items-center rounded-full bg-[#F8EDEE]/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1E1B31]";

/** Severity 1-5 (worse is higher) → ring fill 0-100. */
export function severityFill(severity: number): number {
  if (!Number.isFinite(severity)) return 50;
  return Math.round(Math.max(0, Math.min(100, 100 - ((severity - 1) / 4) * 100)));
}

export const GRADE_RING_COLOR: Record<string, string> = {
  A: "#4E9B72",
  B: "#C4A056",
  C: "#D4894A",
  D: "#C4694F",
};

export function gradeRingColor(grade: string): string {
  const n = Number.parseFloat(grade);
  if (Number.isFinite(n) && /^\d+(\.\d+)?$/.test(grade.trim())) {
    if (n >= 8) return "#4E9B72";
    if (n >= 5) return "#C4A056";
    return "#C4694F";
  }
  const letter = grade.trim().charAt(0).toUpperCase();
  return GRADE_RING_COLOR[letter] ?? "#1E1B31";
}
