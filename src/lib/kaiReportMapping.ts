/**
 * kAI Initial/Update report helpers — severity ↔ sub-grade, findings templates.
 * Internal 0–100 clarity is used for Position Bar only; never shown as a number.
 */

export type KaiGradeTone = "good" | "mid" | "low";

export type KaiSubGrade =
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "D+"
  | "D";

/** Severity 1–5 (higher = worse) → sub-grade letter. */
export function severityToSubGrade(severity: number): KaiSubGrade {
  const s = Math.max(1, Math.min(5, severity));
  if (s <= 1.0) return "A";
  if (s <= 1.5) return "A-";
  if (s <= 2.0) return "B+";
  if (s <= 2.5) return "B";
  if (s <= 3.0) return "B-";
  if (s <= 3.5) return "C+";
  if (s <= 4.0) return "C";
  if (s <= 4.5) return "D+";
  return "D";
}

/** Clarity 0–100 (higher = better) → approximate severity for sub-grade. */
export function clarityToSeverity(clarity: number): number {
  const c = Math.max(0, Math.min(100, clarity));
  return 1 + ((100 - c) / 100) * 4;
}

export function clarityToSubGrade(clarity: number): KaiSubGrade {
  return severityToSubGrade(clarityToSeverity(clarity));
}

export function subGradeTone(grade: string): KaiGradeTone {
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return "good";
  if (g.startsWith("B")) return "mid";
  if (g.startsWith("C")) return "mid";
  return "low";
}

/** Map clarity 0–100 → Position Bar % (0 = D end, 100 = A end). */
export function clarityToPosition(clarity: number): number {
  if (!Number.isFinite(clarity)) return 50;
  return Math.max(0, Math.min(100, Math.round(clarity)));
}

/** Overall letter for hero (coarse A–D from clarity). */
export function clarityToHeroGrade(clarity: number): string {
  const s = Math.max(0, Math.min(100, clarity));
  if (s >= 80) return "A";
  if (s >= 60) return "B";
  if (s >= 40) return "C";
  return "D";
}

export type ReportParameterKey =
  | "active_acne"
  | "acne_scars"
  | "pigmentation"
  | "wrinkles"
  | "under_eye"
  | "sagging_volume"
  | "skin_quality"
  | "texture";

export const REPORT_PARAMETER_META: Array<{
  key: ReportParameterKey;
  name: string;
  shortName: string;
  mfsKey:
    | "active_acne"
    | "acne_scars"
    | "pigmentation_model"
    | "wrinkle_severity"
    | "under_eye"
    | "sagging_volume"
    | "skin_quality";
  /** Prefer legacy clarity column when MFS missing. */
  legacyKey?: "acne" | "wrinkles" | "pigmentation" | "hydration" | "texture";
}> = [
  {
    key: "active_acne",
    name: "Active acne",
    shortName: "Active acne",
    mfsKey: "active_acne",
    legacyKey: "acne",
  },
  {
    key: "pigmentation",
    name: "Pigmentation",
    shortName: "Pigment",
    mfsKey: "pigmentation_model",
    legacyKey: "pigmentation",
  },
  {
    key: "wrinkles",
    name: "Fine lines",
    shortName: "Wrinkles",
    mfsKey: "wrinkle_severity",
    legacyKey: "wrinkles",
  },
  {
    key: "under_eye",
    name: "Under-eye",
    shortName: "Under-eye",
    mfsKey: "under_eye",
    legacyKey: "hydration",
  },
  {
    key: "acne_scars",
    name: "Acne scarring",
    shortName: "Scars",
    mfsKey: "acne_scars",
    legacyKey: "texture",
  },
  {
    key: "sagging_volume",
    name: "Sagging & volume",
    shortName: "Volume",
    mfsKey: "sagging_volume",
  },
  {
    key: "skin_quality",
    name: "Skin quality",
    shortName: "Quality",
    mfsKey: "skin_quality",
  },
];

/** Template finding until LLM findings land. */
export function templateFinding(name: string, severity: number): string {
  const grade = severityToSubGrade(severity);
  if (severity <= 1.2) {
    return `${name} looks clear on this capture — mapped as a clean baseline (${grade}).`;
  }
  if (severity <= 2.5) {
    return `Mild ${name.toLowerCase()} signal on this scan (${grade}). We'll watch this marker week to week.`;
  }
  if (severity <= 3.5) {
    return `Moderate ${name.toLowerCase()} findings (${grade}). This is one of the markers to prioritise in your plan.`;
  }
  return `Notable ${name.toLowerCase()} involvement (${grade}). This will frame your first clinic conversation.`;
}

export function defaultInitialActions(topConcern: string): string[] {
  const c = topConcern.toLowerCase();
  if (c.includes("acne")) {
    return [
      "Switch to a cream cleanser if you use a foaming wash — over-drying often worsens breakouts on dry or combination skin.",
      "Sunscreen at 9am, reapply by early afternoon. UV drives post-acne marks as much as new lesions.",
      "Don't start a new active before your consult — sequencing matters more than stacking.",
    ];
  }
  if (c.includes("pigment") || c.includes("melasma")) {
    return [
      "Sunscreen every morning and a midday reapply on outdoor days — pigmentation tracking depends on UV control.",
      "Keep your current brightening routine steady this week; changing products muddies the next scan.",
      "Note heat exposure (commute, kitchen) — it matters as much as sun for melasma in Indian conditions.",
    ];
  }
  if (c.includes("wrinkle") || c.includes("line")) {
    return [
      "Daily sunscreen and a simple moisturiser twice a day — barrier care is the foundation before actives.",
      "Limit late screens where you can; sleep position and screen hours show up on fine lines over months.",
      "Hold off on stacking new retinoids until your consult sequences them with your skin type.",
    ];
  }
  return [
    "Keep capture conditions consistent next week — same lighting, no glasses, same distance.",
    "Sunscreen daily; it's the highest-leverage free step across most concerns.",
    "Bring this baseline to your consult so sequencing starts from real markers, not guesswork.",
  ];
}

export function pickTopConcernName(
  rows: Array<{ name: string; severity: number }>
): string {
  if (rows.length === 0) return "skin quality";
  const sorted = [...rows].sort((a, b) => b.severity - a.severity);
  return sorted[0]?.name ?? "skin quality";
}

export function initialReportHeadline(
  rows: Array<{ name: string; severity: number }>
): string {
  const sorted = [...rows].sort((a, b) => b.severity - a.severity);
  if (sorted.length === 0) {
    return "Your baseline is set. We'll watch these markers closely on your next scan.";
  }
  if (sorted.length === 1) {
    return `Your baseline is set. ${sorted[0]!.name} is the marker we'll watch most closely.`;
  }
  return `Your baseline is set. ${sorted[0]!.name} and ${sorted[1]!.name.toLowerCase()} are the two markers we'll watch most closely.`;
}

export type KaiReportParamRow = {
  key: ReportParameterKey;
  name: string;
  shortName: string;
  severity: number;
  grade: KaiSubGrade;
  gradeColor: KaiGradeTone;
  finding: string;
  concernChipId:
    | "acne"
    | "acne_scars"
    | "pigmentation"
    | "wrinkles"
    | "under_eye"
    | "sagging_volume"
    | null;
};

function concernChipForKey(
  key: ReportParameterKey
): KaiReportParamRow["concernChipId"] {
  switch (key) {
    case "active_acne":
      return "acne";
    case "acne_scars":
      return "acne_scars";
    case "pigmentation":
      return "pigmentation";
    case "wrinkles":
      return "wrinkles";
    case "under_eye":
      return "under_eye";
    case "sagging_volume":
      return "sagging_volume";
    default:
      return null;
  }
}

/** Build parameter rows from clinical severities + legacy 0–100 clarity columns. */
export function buildKaiReportParamRows(input: {
  clinical?: {
    active_acne?: number | null;
    acne_scars?: number | null;
    skin_quality?: number | null;
    wrinkle_severity?: number | null;
    sagging_volume?: number | null;
    under_eye?: number | null;
    pigmentation_model?: number | null;
  } | null;
  legacy?: {
    acne?: number;
    wrinkles?: number;
    pigmentation?: number;
    hydration?: number;
    texture?: number;
  };
}): KaiReportParamRow[] {
  const rows: KaiReportParamRow[] = [];
  for (const meta of REPORT_PARAMETER_META) {
    const rawMfs = input.clinical?.[meta.mfsKey];
    let severity: number | null =
      typeof rawMfs === "number" && Number.isFinite(rawMfs) ? rawMfs : null;
    if (severity == null && meta.legacyKey && input.legacy) {
      const clarity = input.legacy[meta.legacyKey];
      if (typeof clarity === "number" && Number.isFinite(clarity) && clarity > 0) {
        severity = clarityToSeverity(clarity);
      }
    }
    if (severity == null || !Number.isFinite(severity)) continue;
    const grade = severityToSubGrade(severity);
    rows.push({
      key: meta.key,
      name: meta.name,
      shortName: meta.shortName,
      severity,
      grade,
      gradeColor: subGradeTone(grade),
      finding: templateFinding(meta.name, severity),
      concernChipId: concernChipForKey(meta.key),
    });
  }
  return rows;
}

/** Spec: only show parameters with severity score &gt; 1 (issue present). */
export function filterScoredReportParams(
  rows: KaiReportParamRow[]
): KaiReportParamRow[] {
  const scored = rows.filter((r) => r.severity > 1);
  return scored.length > 0 ? scored : rows;
}
