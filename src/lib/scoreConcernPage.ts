import { scoreOutOfHundred } from "@/src/lib/clarityGrade";
import {
  computeScoreChange,
  describeScoreChange,
  MIN_DETECTABLE_CHANGE,
  type ScoreChange,
} from "@/src/lib/scoreChange";
import { resolveScanDisplayScores } from "@/src/lib/resolveScanDisplayScores";
import {
  isSkinConcernSlug,
  slugToDisplayName,
  type SkinConcernSlug,
} from "@/src/lib/skinConcernSlug";

export type ScorePageSlug = SkinConcernSlug | "overall";

export function isScorePageSlug(s: string): s is ScorePageSlug {
  return s === "overall" || isSkinConcernSlug(s);
}

export function scorePageTitle(slug: ScorePageSlug): string {
  if (slug === "overall") return "Overall Skin Score";
  return slugToDisplayName(slug);
}

export type ScanScoreRow = {
  overallScore: number;
  acne: number;
  wrinkles: number;
  pigmentation: number;
  hydration: number;
  texture: number;
  scores: unknown;
};

/** Raw 0-100 display score for a concern (or overall kAI). Null if missing. */
export function concernRawScore(
  slug: ScorePageSlug,
  row: ScanScoreRow
): number | null {
  const resolved = resolveScanDisplayScores({
    scoresJson: row.scores,
    baseMetricsColumns: {
      overallScore: row.overallScore,
      acne: row.acne,
      wrinkles: row.wrinkles,
      pigmentation: row.pigmentation,
      hydration: row.hydration,
      texture: row.texture,
    },
  });
  if (slug === "overall") {
    const v = resolved.metrics.overall_score;
    return Number.isFinite(v) ? v : null;
  }
  const rag = resolved.resolvedRagParamValues;
  const bySlug: Record<SkinConcernSlug, number | undefined> = {
    "active-acne": rag.active_acne,
    pigmentation: rag.pigmentation,
    wrinkles: rag.wrinkles,
    "under-eye": rag.under_eye ?? resolved.metrics.hydration,
    "acne-scar": rag.acne_scar ?? resolved.metrics.texture,
    "sagging-volume": rag.sagging_volume,
    hydration: resolved.metrics.hydration,
    texture: resolved.metrics.texture,
  };
  const v = bySlug[slug];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const CONCERN_CONTEXT: Record<ScorePageSlug, string> = {
  overall:
    "Overall is a weighted mix of the six visible parameters. The lowest two usually move this number fastest.",
  "active-acne":
    "Breakouts respond to routine consistency and scan lighting - keep AM/PM logs so the next scan has context.",
  pigmentation:
    "Tone reads best in the same light each scan. Daily SPF is the habit most tightly tied to this score.",
  wrinkles:
    "Fine lines track with sleep and expression. Same camera distance between scans keeps this comparison honest.",
  "under-eye":
    "Under-eye reads puffiness and shadow. Sleep and salt the night before a scan can swing this more than skincare.",
  "acne-scar":
    "Scars change slowly. Look at months, not days - and keep the same angle so texture isn’t mistaken for lighting.",
  "sagging-volume":
    "Firmness is a slow metric. Jaw and cheek angle matter; match your last capture pose as closely as you can.",
  hydration:
    "This axis follows barrier feel more than one glass of water. Steady intake and a consistent scan time of day help.",
  texture:
    "Texture is sensitive to oil, pores, and how close the camera sits. Hold the same distance you used last time.",
};

const CONCERN_RECS: Record<ScorePageSlug, string[]> = {
  overall: [
    "Focus on the two lowest parameter scores first",
    "Keep weekly check-ins so habits can be matched to score moves",
    "Scan in the same light and distance each time",
  ],
  "active-acne": [
    "Log AM and PM routine days in the app",
    "Avoid picking - it confuses the next acne read",
    "Note high-stress weeks in your check-in",
  ],
  pigmentation: [
    "Wear SPF every morning, including near windows",
    "Keep scan lighting the same so tone changes are real",
    "Log high-sun days in your weekly check-in",
  ],
  wrinkles: [
    "Protect sleep the two nights before a scan",
    "Hold a relaxed face in the capture - no squint",
    "Keep the camera at the same distance as last time",
  ],
  "under-eye": [
    "Note sleep hours in your weekly check-in",
    "Scan at a similar time of day",
    "Skip heavy concealer for the capture",
  ],
  "acne-scar": [
    "Give scars months, not days, before judging change",
    "Match cheek angle to your previous scan",
    "Keep a steady PM routine so texture isn’t noise",
  ],
  "sagging-volume": [
    "Match jaw and cheek pose to your last scan",
    "Look at a 4-8 week window, not week-to-week noise",
    "Stay consistent with your AM/PM routine",
  ],
  hydration: [
    "Sip water across the day, not only at night",
    "Scan at a similar time of day",
    "Log dry or air-conditioned weeks in check-in",
  ],
  texture: [
    "Cleanse before capture so oil doesn’t read as texture",
    "Hold the same camera distance",
    "Stay on your routine most days this week",
  ],
};

export function defaultConcernRecommendations(slug: ScorePageSlug): string[] {
  return CONCERN_RECS[slug];
}

export function buildScoreAnalysis(input: {
  title: string;
  slug: ScorePageSlug;
  current100: number | null;
  previous100: number | null;
  scanCount: number;
  lastScanLabel: string | null;
  extraLines: string[];
  /** Change over the nearest comparison that clears the noise threshold (see scoreChange.ts). */
  change?: ScoreChange | null;
  /** True when a personalised note replaces the generic closing line. */
  omitGenericContext?: boolean;
}): string[] {
  const lines: string[] = [];
  const { title, current100, previous100, scanCount, lastScanLabel, extraLines, change } =
    input;

  if (current100 == null) {
    lines.push(`No ${title.toLowerCase()} score yet. Take a scan to set a baseline.`);
    return lines;
  }

  if (previous100 == null || scanCount < 2) {
    lines.push(
      `Baseline ${title.toLowerCase()} is ${current100}/100${
        lastScanLabel ? ` from ${lastScanLabel}` : ""
      }. A second scan will show whether this is moving.`
    );
  } else {
    // Move smaller than the detectable change is noise, not progress or decline.
    const resolved: ScoreChange | null =
      change ??
      computeScoreChange([
        { at: new Date(0), value: previous100 },
        { at: new Date(1), value: current100 },
      ]);
    const caption = describeScoreChange(resolved);
    if (resolved && resolved.direction === "up") {
      lines.push(
        `${title} improved to ${current100}/100. ${caption ?? ""}`.trim() + "."
      );
    } else if (resolved && resolved.direction === "down") {
      lines.push(
        `${title} moved to ${current100}/100. ${caption ?? ""}`.trim() +
          " - this is the metric to watch."
      );
    } else {
      lines.push(
        `${title} held steady at ${current100}/100 across your recent scans${
          lastScanLabel ? ` (latest ${lastScanLabel})` : ""
        }.`
      );
    }
  }

  for (const extra of extraLines.slice(0, 2)) {
    if (extra.trim()) lines.push(extra.trim());
  }

  if (!input.omitGenericContext) lines.push(CONCERN_CONTEXT[input.slug]);
  return lines;
}

export function trendDeltaLabel(
  current100: number | null,
  previous100: number | null,
  change?: ScoreChange | null
): string | null {
  if (change) return describeScoreChange(change);
  if (current100 == null || previous100 == null) return null;
  const d = current100 - previous100;
  if (d >= MIN_DETECTABLE_CHANGE) return `+${d} vs last scan`;
  if (d <= -MIN_DETECTABLE_CHANGE) return `${d} vs last scan`;
  return "Steady since your last scan";
}

export function toHundred(raw: number | null): number | null {
  if (raw == null) return null;
  return scoreOutOfHundred(raw);
}
