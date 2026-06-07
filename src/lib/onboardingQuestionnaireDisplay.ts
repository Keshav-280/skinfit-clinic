/** Human-readable labels for doctor portal / staff views of onboarding answers. */

import {
  formatReferralSourceAnswer,
  type ReferralSourceAnswer,
} from "@/src/lib/onboardingReferralSource";

const QUESTION_TITLES: Record<string, string> = {
  PROFILE_01: "About you",
  REF_01: "How they heard about us",
  CONCERN_01: "Primary concern",
  HEALTH_01: "Overall skin health",
  SEV_01: "Severity",
  DUR_01: "Duration",
  TRIG_01: "Triggers",
  TX_01: "Prior treatment",
  TX_02: "Treatment history",
  SENS_01: "Skin sensitivity",
  LIFE_01: "Sleep",
  LIFE_02a: "Daily water",
  LIFE_02b: "Diet",
  LIFE_02c: "Sun exposure",
  FLAG_CHRONIC_CONCERN: "Chronic concern flag",
  FLAG_HIGH_SENSITIVITY: "High sensitivity flag",
  NOTE_Q4_TRIGGERS_UNSURE: "Triggers note",
  NOTE_Q7_SLEEP: "Sleep note",
};

const CONCERN_LABELS: Record<string, string> = {
  acne: "Acne & breakouts",
  pigmentation: "Pigmentation & dark spots",
  ageing: "Ageing & wrinkles",
  hair: "Hair loss & scalp",
  general: "General skin health",
};

const TRIGGER_LABELS: Record<string, string> = {
  hormonal: "Hormonal (cycle, PCOS, pregnancy)",
  diet: "Diet",
  stress: "Stress & poor sleep",
  environmental: "Environment (sun, pollution, humidity)",
  products: "Products or ingredients",
  unsure: "Not sure — kAI will learn from journal",
};

const GENERIC_VALUE_LABELS: Record<string, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  recent: "Recent — under 3 months",
  ongoing: "Ongoing — 3 months to 1 year",
  chronic: "Chronic — over 1 year",
  yes: "Yes — tried treatments or seen a doctor",
  no: "No — first time seeking treatment",
  high: "High — frequent redness or reactions",
  under5: "Under 5 hours",
  "5to6": "5–6 hours",
  "7to8": "7–8 hours",
  "8plus": "8+ hours",
  under1l: "Under 1L",
  "1to1_5l": "1–1.5L",
  "1_5to2l": "1.5–2L",
  "2lplus": "2L+",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  nonveg: "Non-vegetarian",
  mixed: "Mixed",
  under1m: "Under 1 month",
  "1to3m": "1–3 months",
  "3to6m": "3–6 months",
  "6to12m": "6–12 months",
  over1y: "Over 1 year",
  female: "Female",
  male: "Male",
  other: "Other",
  prefer_not_say: "Prefer not to say",
  maintenance: "Maintenance",
  need_improve: "Need to improve",
  ongoing_concerns: "Ongoing concerns",
};

const DISPLAY_ORDER = [
  "PROFILE_01",
  "REF_01",
  "CONCERN_01",
  "HEALTH_01",
  "SEV_01",
  "DUR_01",
  "TRIG_01",
  "TX_01",
  "TX_02",
  "SENS_01",
  "LIFE_01",
  "LIFE_02a",
  "LIFE_02b",
  "LIFE_02c",
  "FLAG_CHRONIC_CONCERN",
  "FLAG_HIGH_SENSITIVITY",
  "NOTE_Q4_TRIGGERS_UNSURE",
  "NOTE_Q7_SLEEP",
];

export type QuestionnaireDisplayKind = "text" | "tags" | "alert" | "note";

export type QuestionnaireDisplay = {
  title: string;
  kind: QuestionnaireDisplayKind;
  body: string;
  tags: string[];
};

const SENSITIVITY_LABELS: Record<string, string> = {
  low: "Low — rarely reacts",
  moderate: "Moderate — occasional irritation",
  high: "High — frequent redness or reactions",
};

const SUN_LABELS: Record<string, string> = {
  minimal: "Minimal (mostly indoors)",
  low: "Low (~30 min)",
  moderate: "Moderate (1–2 hrs)",
  high: "High (2+ hrs)",
};

function labelValue(raw: string, questionId: string): string {
  if (questionId === "CONCERN_01" && CONCERN_LABELS[raw]) return CONCERN_LABELS[raw];
  if (questionId === "SENS_01" && SENSITIVITY_LABELS[raw]) return SENSITIVITY_LABELS[raw];
  if (questionId === "LIFE_02c" && SUN_LABELS[raw]) return SUN_LABELS[raw];
  if (GENERIC_VALUE_LABELS[raw]) return GENERIC_VALUE_LABELS[raw];
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function questionTitle(questionId: string): string {
  return (
    QUESTION_TITLES[questionId] ??
    questionId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatOnboardingAnswer(
  questionId: string,
  answer: unknown
): QuestionnaireDisplay {
  const title = questionTitle(questionId);

  if (questionId.startsWith("NOTE_")) {
    const text =
      typeof answer === "string"
        ? answer
        : JSON.stringify(answer);
    return { title, kind: "note", body: text, tags: [] };
  }

  if (questionId.startsWith("FLAG_")) {
    const rec = asRecord(answer);
    const body =
      (typeof rec?.label === "string" && rec.label) ||
      (typeof answer === "string" ? answer : "Flagged for clinician review");
    return { title, kind: "alert", body, tags: [] };
  }

  if (questionId === "PROFILE_01") {
    const rec = asRecord(answer);
    const age = rec?.age;
    const gender = rec?.gender;
    const parts: string[] = [];
    if (typeof age === "number") parts.push(`Age ${age}`);
    if (typeof gender === "string") parts.push(labelValue(gender, questionId));
    return {
      title,
      kind: "text",
      body: parts.length ? parts.join(" · ") : "—",
      tags: [],
    };
  }

  if (questionId === "REF_01") {
    const rec = asRecord(answer);
    const source = typeof rec?.source === "string" ? rec.source : null;
    if (!source) {
      return { title, kind: "text", body: "—", tags: [] };
    }
    const other = typeof rec?.other === "string" ? rec.other : undefined;
    return {
      title,
      kind: "text",
      body: formatReferralSourceAnswer({
        source: source as ReferralSourceAnswer["source"],
        other,
      }),
      tags: [],
    };
  }

  if (questionId === "TX_02") {
    const rec = asRecord(answer);
    const text = typeof rec?.text === "string" ? rec.text.trim() : "";
    const dur =
      typeof rec?.duration === "string"
        ? labelValue(rec.duration, questionId)
        : "";
    const parts = [text, dur].filter(Boolean);
    return { title, kind: "text", body: parts.join(" · ") || "—", tags: [] };
  }

  if (questionId === "TRIG_01" && Array.isArray(answer)) {
    const tags = answer
      .filter((x): x is string => typeof x === "string")
      .map((id) => TRIGGER_LABELS[id] ?? labelValue(id, questionId));
    return {
      title,
      kind: "tags",
      body: tags.length ? "" : "—",
      tags,
    };
  }

  if (typeof answer === "string") {
    return {
      title,
      kind: "text",
      body: labelValue(answer, questionId),
      tags: [],
    };
  }

  if (typeof answer === "number" || typeof answer === "boolean") {
    return { title, kind: "text", body: String(answer), tags: [] };
  }

  if (Array.isArray(answer)) {
    const tags = answer.map((x) =>
      typeof x === "string" ? labelValue(x, questionId) : JSON.stringify(x)
    );
    return { title, kind: "tags", body: "", tags };
  }

  const rec = asRecord(answer);
  if (rec) {
    const parts = Object.entries(rec)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? labelValue(v, questionId) : String(v)}`)
      .join(" · ");
    return { title, kind: "text", body: parts || "—", tags: [] };
  }

  return { title, kind: "text", body: "—", tags: [] };
}

export function sortQuestionnaireAnswers<T extends { questionId: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const ia = DISPLAY_ORDER.indexOf(a.questionId);
    const ib = DISPLAY_ORDER.indexOf(b.questionId);
    const ao = ia >= 0 ? ia : DISPLAY_ORDER.length + 1;
    const bo = ib >= 0 ? ib : DISPLAY_ORDER.length + 2;
    if (ao !== bo) return ao - bo;
    return a.questionId.localeCompare(b.questionId);
  });
}

export function isQuestionnaireAlert(questionId: string): boolean {
  return questionId.startsWith("FLAG_");
}

export function isQuestionnaireNote(questionId: string): boolean {
  return questionId.startsWith("NOTE_");
}

export function referralSourceFromQuestionnaireAnswers(
  rows: Array<{ questionId: string; answer: unknown }>
): string | null {
  const row = rows.find((r) => r.questionId === "REF_01");
  if (!row) return null;
  const display = formatOnboardingAnswer("REF_01", row.answer);
  return display.body && display.body !== "—" ? display.body : null;
}
