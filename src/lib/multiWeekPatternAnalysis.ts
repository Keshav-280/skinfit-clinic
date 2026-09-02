/**
 * Real, number-grounded patterns computed across a patient's FULL scan and
 * weekly-check-in history — not single-week rules (see ragCorrelationStats.ts
 * for that) and not generic template copy. Every function here only returns
 * a fact when there's enough data to defend it; otherwise it returns null so
 * callers fall back to existing copy instead of fabricating a claim.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { scans, wellnessCheckins } from "@/src/db/schema";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";
import {
  kaiScoreFromScanRow,
  ragParamValuesFromScanRow,
} from "@/src/lib/resolveScanDisplayScores";
import { scoreOutOfTen } from "@/src/lib/clarityGrade";

type ScanPoint = {
  id: number;
  createdAt: Date;
  kai: number;
  params: Record<RagKaiParamKey, number | null>;
};

type CheckinPoint = {
  weekYmd: string;
  createdAt: Date;
  sleepHours: string | null;
  stressAnchor: string | null;
  stressLevel: number | null;
  water: string | null;
};

export type MultiWeekInsight = {
  kind: "baseline" | "trend" | "checkin_correlation" | "comovement" | "consistency";
  text: string;
  /** Set only for insights tied to one parameter (baseline, trend) — lets callers ground that parameter's own copy. */
  param?: RagKaiParamKey;
};

const MIN_GAP_DAYS_FOR_BASELINE = 10;
const MEANINGFUL_DELTA = 4; // points on 0-100 scale
const MIN_BUCKET_SIZE = 2; // weeks needed per side of a comparison

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

async function loadScanPoints(userId: string): Promise<ScanPoint[]> {
  const rows = await db
    .select({
      id: scans.id,
      createdAt: scans.createdAt,
      overallScore: scans.overallScore,
      scores: scans.scores,
      pigmentation: scans.pigmentation,
      acne: scans.acne,
      wrinkles: scans.wrinkles,
      hydration: scans.hydration,
      texture: scans.texture,
    })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt), asc(scans.id));

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    kai: kaiScoreFromScanRow(r),
    params: ragParamValuesFromScanRow(r) as Record<RagKaiParamKey, number | null>,
  }));
}

async function loadCheckinPoints(userId: string): Promise<CheckinPoint[]> {
  const rows = await db
    .select({
      weekYmd: wellnessCheckins.weekYmd,
      createdAt: wellnessCheckins.createdAt,
      sleepHours: wellnessCheckins.sleepHours,
      stressAnchor: wellnessCheckins.stressAnchor,
      stressLevel: wellnessCheckins.stressLevel,
      water: wellnessCheckins.water,
    })
    .from(wellnessCheckins)
    .where(
      and(
        eq(wellnessCheckins.userId, userId)
      )
    )
    .orderBy(asc(wellnessCheckins.weekYmd));
  return rows;
}

/** 1. Baseline: how far the latest scan has moved from the FIRST scan on record. */
function baselineInsight(scanPoints: ScanPoint[]): MultiWeekInsight | null {
  if (scanPoints.length < 2) return null;
  const first = scanPoints[0]!;
  const latest = scanPoints[scanPoints.length - 1]!;
  if (daysBetween(first.createdAt, latest.createdAt) < MIN_GAP_DAYS_FOR_BASELINE) {
    return null;
  }

  const paramDeltas = RAG_KAI_PARAM_KEYS.map((key) => {
    const f = first.params[key];
    const l = latest.params[key];
    if (typeof f !== "number" || typeof l !== "number") return null;
    return { key, delta: Math.round(l - f) };
  }).filter((d): d is { key: RagKaiParamKey; delta: number } => d != null);

  const best = [...paramDeltas].sort((a, b) => b.delta - a.delta)[0];
  if (!best || best.delta < MEANINGFUL_DELTA) return null;

  const label = RAG_KAI_PARAM_LABELS[best.key];
  const fromScore = scoreOutOfTen(first.params[best.key] ?? 0);
  const toScore = scoreOutOfTen(latest.params[best.key] ?? 0);
  return {
    kind: "baseline",
    param: best.key,
    text: `${label} is your biggest gain since your first scan on ${fmtDate(first.createdAt)} — up from ${fromScore}/10 to ${toScore}/10, the largest move of any parameter you're tracking.`,
  };
}

/** 2. Trend: is a parameter accelerating, plateauing, or reversing across recent scans? */
function trendInsights(scanPoints: ScanPoint[]): MultiWeekInsight[] {
  if (scanPoints.length < 3) return [];
  const recent = scanPoints.slice(-4);
  const scanCount = recent.length;

  const decliners: { key: RagKaiParamKey; series: number[] }[] = [];
  const plateaued: { key: RagKaiParamKey; series: number[] }[] = [];

  for (const key of RAG_KAI_PARAM_KEYS) {
    const series = recent
      .map((p) => p.params[key])
      .filter((v): v is number => typeof v === "number");
    if (series.length < 3) continue;

    const mid = Math.floor(series.length / 2);
    const firstHalfAvg = series.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalfAvg =
      series.slice(mid).reduce((a, b) => a + b, 0) / (series.length - mid);
    const shift = secondHalfAvg - firstHalfAvg;

    const lastTwo = series.slice(-2);
    const isPlateaued =
      lastTwo.length === 2 && Math.abs(lastTwo[1]! - lastTwo[0]!) < 2 && Math.abs(shift) < 3;

    if (shift <= -MEANINGFUL_DELTA) {
      decliners.push({ key, series });
    } else if (isPlateaued) {
      plateaued.push({ key, series });
    }
  }

  // Decliners are the most actionable signal - surface up to 2, one card each.
  const out: MultiWeekInsight[] = decliners.slice(0, 2).map(({ key, series }) => ({
    kind: "trend",
    param: key,
    text: `${RAG_KAI_PARAM_LABELS[key]} has been trending down over your last ${series.length} scans (${series.map((v) => scoreOutOfTen(v)).join(" → ")} out of 10) — worth a closer look before your next visit.`,
  }));

  // Plateaued params rarely need a separate card each - fold them into one
  // sentence so the report doesn't repeat the same template phrasing.
  if (out.length < 2 && plateaued.length > 0) {
    const names = plateaued.map((p) => RAG_KAI_PARAM_LABELS[p.key]);
    const nameList =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    out.push({
      kind: "trend",
      param: plateaued.length === 1 ? plateaued[0]!.key : undefined,
      text: `${nameList} ${names.length === 1 ? "has" : "have"} held flat across your last ${scanCount} scans — if you want movement here, this is where changing your routine matters, not waiting it out.`,
    });
  }

  return out.slice(0, 2);
}

/** 3. Check-in correlation: bucket weeks by an actual logged answer, compare average score movement. */
function checkinCorrelationInsight(
  scanPoints: ScanPoint[],
  checkins: CheckinPoint[]
): MultiWeekInsight | null {
  if (scanPoints.length < 3 || checkins.length < 4) return null;

  // Pair each scan-to-scan kAI delta with the nearest check-in's sleep answer.
  const pairs: { sleepBand: "low" | "high" | null; delta: number }[] = [];
  for (let i = 1; i < scanPoints.length; i++) {
    const prev = scanPoints[i - 1]!;
    const cur = scanPoints[i]!;
    const delta = cur.kai - prev.kai;
    const nearestCheckin = checkins.reduce<CheckinPoint | null>((best, c) => {
      if (c.createdAt > cur.createdAt) return best;
      if (!best) return c;
      return daysBetween(c.createdAt, cur.createdAt) <
        daysBetween(best.createdAt, cur.createdAt)
        ? c
        : best;
    }, null);
    const sleepText = nearestCheckin?.sleepHours?.toLowerCase() ?? "";
    const band =
      sleepText.includes("<") || /\b[0-5]\b/.test(sleepText) || sleepText.includes("less")
        ? "low"
        : sleepText.includes("7") || sleepText.includes("8") || sleepText.includes("+")
          ? "high"
          : null;
    pairs.push({ sleepBand: band, delta });
  }

  const low = pairs.filter((p) => p.sleepBand === "low").map((p) => p.delta);
  const high = pairs.filter((p) => p.sleepBand === "high").map((p) => p.delta);
  if (low.length < MIN_BUCKET_SIZE || high.length < MIN_BUCKET_SIZE) return null;

  const avgLow = low.reduce((a, b) => a + b, 0) / low.length;
  const avgHigh = high.reduce((a, b) => a + b, 0) / high.length;
  const diff = avgHigh - avgLow;
  if (Math.abs(diff) < MEANINGFUL_DELTA) return null;

  const better = diff > 0 ? "7-8+ hours" : "under 6 hours";
  const worse = diff > 0 ? "under 6 hours" : "7-8+ hours";
  return {
    kind: "checkin_correlation",
    text: `In the ${low.length + high.length} weeks we can compare, your score moved about ${Math.abs(Math.round(diff))} points better on average in weeks you logged ${better} of sleep than weeks you logged ${worse} — sleep looks like a real lever for you, not just a guess.`,
  };
}

/** 4. Co-movement: do two parameters consistently move together, suggesting a shared driver? */
function comovementInsight(scanPoints: ScanPoint[]): MultiWeekInsight | null {
  if (scanPoints.length < 4) return null;

  const deltasByParam = new Map<RagKaiParamKey, number[]>();
  for (const key of RAG_KAI_PARAM_KEYS) {
    const series: number[] = [];
    for (let i = 1; i < scanPoints.length; i++) {
      const a = scanPoints[i - 1]!.params[key];
      const b = scanPoints[i]!.params[key];
      if (typeof a === "number" && typeof b === "number") {
        series.push(b - a);
      }
    }
    if (series.length >= 3) deltasByParam.set(key, series);
  }

  const keys = Array.from(deltasByParam.keys());
  let best: { a: RagKaiParamKey; b: RagKaiParamKey; agree: number; n: number } | null = null;

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const seriesA = deltasByParam.get(keys[i]!)!;
      const seriesB = deltasByParam.get(keys[j]!)!;
      const n = Math.min(seriesA.length, seriesB.length);
      if (n < 3) continue;
      let agree = 0;
      for (let k = 0; k < n; k++) {
        const sameDirection =
          Math.sign(seriesA[k]!) === Math.sign(seriesB[k]!) && seriesA[k] !== 0;
        if (sameDirection) agree += 1;
      }
      if (!best || agree / n > best.agree / best.n) {
        best = { a: keys[i]!, b: keys[j]!, agree, n };
      }
    }
  }

  if (!best || best.n < 3 || best.agree / best.n < 0.75 || best.agree < 3) return null;

  return {
    kind: "comovement",
    text: `${RAG_KAI_PARAM_LABELS[best.a]} and ${RAG_KAI_PARAM_LABELS[best.b]} have moved in the same direction in ${best.agree} of your last ${best.n} scans — when one shifts, the other usually does too, which points to a shared cause rather than two separate issues.`,
  };
}

/** 5. Consistency: do weeks with a submitted check-in correlate with steadier scores? */
function consistencyInsight(
  scanPoints: ScanPoint[],
  checkins: CheckinPoint[]
): MultiWeekInsight | null {
  if (scanPoints.length < 4 || checkins.length < 4) return null;

  const checkinWeeks = new Set(checkins.map((c) => c.weekYmd));
  const deltas: { hadCheckin: boolean; delta: number }[] = [];
  for (let i = 1; i < scanPoints.length; i++) {
    const cur = scanPoints[i]!;
    const weekStart = new Date(cur.createdAt);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekYmd = weekStart.toISOString().slice(0, 10);
    deltas.push({
      hadCheckin: checkinWeeks.has(weekYmd),
      delta: cur.kai - scanPoints[i - 1]!.kai,
    });
  }

  const withCheckin = deltas.filter((d) => d.hadCheckin).map((d) => Math.abs(d.delta));
  const withoutCheckin = deltas.filter((d) => !d.hadCheckin).map((d) => Math.abs(d.delta));
  if (withCheckin.length < MIN_BUCKET_SIZE || withoutCheckin.length < MIN_BUCKET_SIZE) {
    return null;
  }

  const avgSwingWith = withCheckin.reduce((a, b) => a + b, 0) / withCheckin.length;
  const avgSwingWithout =
    withoutCheckin.reduce((a, b) => a + b, 0) / withoutCheckin.length;

  if (avgSwingWithout - avgSwingWith < MEANINGFUL_DELTA / 2) return null;

  return {
    kind: "consistency",
    text: `Weeks you completed a check-in were noticeably steadier — your score swung by about ${Math.round(avgSwingWith)} points on average, versus ${Math.round(avgSwingWithout)} points in weeks you skipped it. Logging in seems to line up with more stable skin, not just more data for us.`,
  };
}

/**
 * Compute every defensible multi-week pattern for a patient. Returns an
 * empty array (never fabricated filler) when there isn't enough history.
 */
export async function computeMultiWeekInsights(
  userId: string
): Promise<MultiWeekInsight[]> {
  const [scanPoints, checkins] = await Promise.all([
    loadScanPoints(userId),
    loadCheckinPoints(userId),
  ]);

  const out: MultiWeekInsight[] = [];
  const baseline = baselineInsight(scanPoints);
  if (baseline) out.push(baseline);
  out.push(...trendInsights(scanPoints));
  const checkinCorrelation = checkinCorrelationInsight(scanPoints, checkins);
  if (checkinCorrelation) out.push(checkinCorrelation);
  const comovement = comovementInsight(scanPoints);
  if (comovement) out.push(comovement);
  const consistency = consistencyInsight(scanPoints, checkins);
  if (consistency) out.push(consistency);

  return out;
}
