/**
 * Facts the report writer must not be left to work out (or get wrong) on its own. Code decides:
 *  - what each skin area is called to a patient (never "pigmentation"),
 *  - how big a move is in words (3-4 points "a little", 5-9 "clearly", 10 or more "a lot"),
 *  - whether an area dipped on two reports in a row (that needs a calm in-person visit suggestion).
 */
import type { ScorePoint } from "@/src/lib/scoreChange";

/** What a patient calls each skin area. */
export const PLAIN_AREA: Record<string, string> = {
  active_acne: "breakouts and pimples",
  acne_scars: "acne marks",
  pigmentation: "dark spots and uneven tone",
  wrinkles: "fine lines",
  under_eye: "dark circles",
  sagging_volume: "firmness",
};

/** The exact wording for a move, so the writer cannot understate or overstate it. */
export function sayItAs(movement: string | undefined, points: number | null | undefined): string {
  const p = Math.abs(points ?? 0);
  if (movement === "improved") {
    const size = p >= 10 ? "a lot" : p >= 5 ? "clearly" : "a little";
    return `${size} better (say what it looks like in the mirror)`;
  }
  if (movement === "declined") {
    return "dipped (say what it looks like in the mirror; for breakouts, a few more pimples are showing); one week is a small window";
  }
  if (movement === "tracking") return "make no claim of change: say the light or angle was different this time, or that it is too early to tell";
  return "steady / about the same (say what steady means for them)";
}

/** Adds the plain name and the wording to each focus row. */
export function decorateFocusRows<T extends { key?: string; movement?: string; change_points?: number | null }>(
  rows: T[]
): Array<T & { plain_name: string | null; say_it_as: string | null }> {
  return rows.map((r) => ({
    ...r,
    plain_name: (r.key && PLAIN_AREA[r.key]) || null,
    say_it_as: r.movement === "baseline" ? null : sayItAs(r.movement, r.change_points),
  }));
}

/** Internal words in text that is handed to the writer (it copies what it sees). */
export function plainWords(text: string): string {
  return text
    .replace(/\bpigmentation\b/gi, "dark spots")
    .replace(/\bactive acne\b/gi, "breakouts")
    .replace(/\bacne scars?\b/gi, "acne marks")
    .replace(/\bunder-?eye\b/gi, "dark circles")
    .replace(/\bwrinkles\b/gi, "fine lines")
    .replace(/\bsagging(?: and| &)? volume\b/gi, "firmness")
    .replace(/\bbaseline\b/gi, "starting point");
}

/** True when the last two moves were both drops of at least `min` points. Series is oldest to newest. */
export function dippedTwiceInARow(series: ScorePoint[] | undefined, min = 3): boolean {
  if (!series || series.length < 3) return false;
  const n = series.length;
  const a = series[n - 3].value;
  const b = series[n - 2].value;
  const c = series[n - 1].value;
  return b - a <= -min && c - b <= -min;
}

export function areasDippedTwice(byKey: Record<string, ScorePoint[]>): string[] {
  return Object.entries(byKey)
    .filter(([, s]) => dippedTwiceInARow(s))
    .map(([k]) => k);
}
