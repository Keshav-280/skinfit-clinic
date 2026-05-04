import type { dailyLogs } from "@/src/db/schema";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";

type LogRow = typeof dailyLogs.$inferSelect;

export type ScanWithParams = {
  id: number;
  createdAt: Date;
  overallScore: number;
  paramValues: Partial<Record<RagKaiParamKey, number>>;
};

export type DerivedSkinIdentity = {
  asOfDate: string;
  skinType: string | null;
  primaryConcern: string | null;
  primaryConcernKey: RagKaiParamKey | null;
  sensitivityIndex: number | null;
  uvSensitivity: string | null;
  hormonalCorrelation: string | null;
  signals: {
    skinType: string;
    primaryConcern: string;
    sensitivityIndex: string;
    uvSensitivity: string;
    hormonalCorrelation: string;
  };
  dataDepth: {
    scansConsidered: number;
    logsConsidered: number;
    windowDays: number;
  };
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mean(xs: number[]) {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Simple linear-regression slope (y per x-index). Positive = improving. */
function slope(ys: number[]) {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  if (den === 0) return 0;
  return num / den;
}

function pickPrimaryConcern(
  scansUpTo: ScanWithParams[]
): {
  key: RagKaiParamKey | null;
  label: string | null;
  rationale: string;
} {
  if (scansUpTo.length === 0) {
    return { key: null, label: null, rationale: "no scans yet" };
  }
  const recent = scansUpTo.slice(-4);
  const avgs: Array<{
    key: RagKaiParamKey;
    avg: number;
    slope: number;
    latest: number | null;
    count: number;
  }> = [];
  for (const key of RAG_KAI_PARAM_KEYS) {
    const series: number[] = [];
    for (const s of recent) {
      const v = s.paramValues[key];
      if (typeof v === "number") series.push(v);
    }
    if (series.length === 0) continue;
    avgs.push({
      key,
      avg: mean(series),
      slope: slope(series),
      latest: series[series.length - 1] ?? null,
      count: series.length,
    });
  }
  if (avgs.length === 0) {
    return { key: null, label: null, rationale: "no parameter scores" };
  }
  // Score = (lower avg is worse → concern) + penalize negative slope
  const ranked = [...avgs].sort((a, b) => {
    const pa = a.avg - a.slope * 4;
    const pb = b.avg - b.slope * 4;
    return pa - pb;
  });
  const top = ranked[0];
  return {
    key: top.key,
    label: RAG_KAI_PARAM_LABELS[top.key],
    rationale: `lowest recent avg ${Math.round(top.avg)} over last ${top.count} scans${
      top.slope < -0.3 ? `, trending down (${top.slope.toFixed(2)}/scan)` : ""
    }${
      top.slope > 0.3 ? `, but trending up (${top.slope.toFixed(2)}/scan)` : ""
    }`,
  };
}

function deriveUvSensitivity(
  logsUpTo: LogRow[],
  scansUpTo: ScanWithParams[],
  baseline: string | null
): { value: string; rationale: string } {
  const recentLogs = logsUpTo.slice(0, 60);
  if (recentLogs.length === 0) {
    return {
      value: baseline ?? "n/a",
      rationale: baseline
        ? `from onboarding (${baseline})`
        : "no data yet",
    };
  }
  const high = recentLogs.filter((l) => l.sunExposure === "high").length;
  const mod = recentLogs.filter((l) => l.sunExposure === "moderate").length;
  const total = recentLogs.length;
  const highPct = (high / total) * 100;

  // Correlate high-UV days with pigmentation regressions
  let pigmentDropsOnHighUv = 0;
  let pigmentImproveOnLowUv = 0;
  if (scansUpTo.length >= 2) {
    for (let i = 1; i < scansUpTo.length; i += 1) {
      const prev = scansUpTo[i - 1].paramValues.pigmentation;
      const cur = scansUpTo[i].paramValues.pigmentation;
      if (typeof prev !== "number" || typeof cur !== "number") continue;
      const scanDate = scansUpTo[i].createdAt;
      const weekStart = new Date(scanDate);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekLogs = recentLogs.filter(
        (l) =>
          l.date.getTime() >= weekStart.getTime() &&
          l.date.getTime() <= scanDate.getTime()
      );
      const weekHigh = weekLogs.filter((l) => l.sunExposure === "high").length;
      const delta = cur - prev;
      if (weekHigh >= 2 && delta <= -2) pigmentDropsOnHighUv += 1;
      if (weekHigh === 0 && delta >= 2) pigmentImproveOnLowUv += 1;
    }
  }

  let value: string;
  if (highPct >= 30 || pigmentDropsOnHighUv >= 2) value = "High";
  else if (highPct >= 10 || mod / total >= 0.3) value = "Moderate";
  else value = "Low";

  return {
    value,
    rationale: `${high}/${total} high-UV days logged (${Math.round(highPct)}%), ${pigmentDropsOnHighUv} pigmentation drops on high-UV weeks, ${pigmentImproveOnLowUv} improvements on low-UV weeks`,
  };
}

function deriveHormonalCorrelation(
  scansUpTo: ScanWithParams[],
  baseline: string | null
): { value: string; rationale: string } {
  const acne: number[] = [];
  for (const s of scansUpTo) {
    const v = s.paramValues.active_acne;
    if (typeof v === "number") acne.push(v);
  }
  if (acne.length < 4) {
    return {
      value: baseline ?? "Monitoring",
      rationale: `only ${acne.length} acne data points — need 4+ to confirm a pattern`,
    };
  }
  // Look for repeating dips (period ~3-5 scans assuming weekly scans ~ monthly cycle)
  let dips = 0;
  let ups = 0;
  for (let i = 1; i < acne.length; i += 1) {
    const d = acne[i] - acne[i - 1];
    if (d <= -3) dips += 1;
    if (d >= 3) ups += 1;
  }
  const oscillation = dips >= 2 && ups >= 2;
  const variance =
    acne.reduce((s, v) => s + (v - mean(acne)) ** 2, 0) / acne.length;
  const sd = Math.sqrt(variance);

  let value: string;
  if (oscillation || sd >= 8) value = "Detected";
  else if (dips + ups >= 2) value = "Monitoring";
  else value = "Not indicated";

  return {
    value,
    rationale: `acne sd=${sd.toFixed(1)}, ${dips} large dips & ${ups} large jumps across ${acne.length} scans${
      oscillation ? " → oscillating pattern" : ""
    }`,
  };
}

function deriveSensitivityIndex(
  logsUpTo: LogRow[],
  scansUpTo: ScanWithParams[],
  baseline: number | null
): { value: number; rationale: string } {
  let score = baseline ?? 5;
  const recentLogs = logsUpTo.slice(0, 30);
  const highStress = recentLogs.filter(
    (l) => typeof l.stressLevel === "number" && l.stressLevel >= 7
  ).length;
  const journalFlags = recentLogs.filter(
    (l) =>
      l.journalEntry &&
      /(flare|reaction|irritat|itchy|red|stinging|burn|rash|sensitiv)/i.test(
        l.journalEntry
      )
  ).length;

  // Variance of the last 4 kAI-ish averages
  const last4 = scansUpTo.slice(-4).map((s) => {
    const vals = RAG_KAI_PARAM_KEYS.map((k) => s.paramValues[k]).filter(
      (v): v is number => typeof v === "number"
    );
    return vals.length > 0 ? mean(vals) : null;
  });
  const cleaned = last4.filter((x): x is number => x != null);
  const sd =
    cleaned.length >= 2
      ? Math.sqrt(
          cleaned.reduce((s, v) => s + (v - mean(cleaned)) ** 2, 0) /
            cleaned.length
        )
      : 0;

  let adj = 0;
  if (journalFlags >= 2) adj += 2;
  else if (journalFlags >= 1) adj += 1;
  if (highStress >= 5) adj += 1;
  if (sd >= 6) adj += 1;
  if (sd < 2 && journalFlags === 0 && highStress <= 1) adj -= 1;

  score = Math.max(0, Math.min(10, Math.round(score + adj)));
  return {
    value: score,
    rationale: `baseline=${baseline ?? "5 (default)"}, +${journalFlags} sensitivity-related journal flags, ${highStress} high-stress days, score variance sd=${sd.toFixed(1)} → final ${score}/10`,
  };
}

function fmtSkinType(skinType: string | null): {
  value: string | null;
  rationale: string;
} {
  if (!skinType) {
    return { value: null, rationale: "not set in onboarding" };
  }
  return { value: skinType, rationale: `from onboarding profile` };
}

export function deriveSkinIdentityAt(params: {
  asOfDate: Date;
  baseline: {
    skinType: string | null;
    primaryConcern: string | null;
    sensitivityIndex: number | null;
    uvSensitivity: string | null;
    hormonalCorrelation: string | null;
  };
  scans: ScanWithParams[];
  logs: LogRow[];
}): DerivedSkinIdentity {
  const scansUpTo = params.scans.filter(
    (s) => s.createdAt.getTime() <= params.asOfDate.getTime()
  );
  const logsUpTo = params.logs
    .filter((l) => l.date.getTime() <= params.asOfDate.getTime())
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const skinTypeInfo = fmtSkinType(params.baseline.skinType);
  const concern = pickPrimaryConcern(scansUpTo);
  const uv = deriveUvSensitivity(logsUpTo, scansUpTo, params.baseline.uvSensitivity);
  const hormonal = deriveHormonalCorrelation(
    scansUpTo,
    params.baseline.hormonalCorrelation
  );
  const sens = deriveSensitivityIndex(
    logsUpTo,
    scansUpTo,
    params.baseline.sensitivityIndex
  );

  // Fallbacks so we never show nothing when scans exist
  const primaryConcernLabel =
    concern.label ?? params.baseline.primaryConcern ?? null;
  const primaryConcernKey = concern.key;

  return {
    asOfDate: ymd(params.asOfDate),
    skinType: skinTypeInfo.value,
    primaryConcern: primaryConcernLabel,
    primaryConcernKey,
    sensitivityIndex: sens.value,
    uvSensitivity: uv.value === "n/a" ? null : uv.value,
    hormonalCorrelation: hormonal.value,
    signals: {
      skinType: skinTypeInfo.rationale,
      primaryConcern: concern.rationale,
      sensitivityIndex: sens.rationale,
      uvSensitivity: uv.rationale,
      hormonalCorrelation: hormonal.rationale,
    },
    dataDepth: {
      scansConsidered: scansUpTo.length,
      logsConsidered: logsUpTo.length,
      windowDays: Math.max(
        0,
        Math.round(
          logsUpTo.length > 0
            ? (params.asOfDate.getTime() -
                logsUpTo[logsUpTo.length - 1].date.getTime()) /
                (24 * 60 * 60 * 1000)
            : 0
        )
      ),
    },
  };
}
