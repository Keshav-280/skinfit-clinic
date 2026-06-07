import { normalizeOnboardingQuestionnaireStep } from "@/src/lib/onboardingQuestionnaireDefaults";

/** Web: localStorage. Native: AsyncStorage with same key. */
export const ONBOARDING_QUESTIONNAIRE_DRAFT_KEY = "skinfit_onboarding_questionnaire_v1";

/** Draft schema version (bump when step order or required fields change). */
export const ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA = 3 as const;

export type OnboardingQuestionnaireDraftV2 = {
  v: typeof ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA;
  step: number;
  ageInput: string;
  gender: string | null;
  concern: string | null;
  severity: string | null;
  duration: string | null;
  triggers: string[];
  priorTx: string | null;
  txText: string;
  txDur: string;
  sensitivity: string | null;
  sleep: string | null;
  water: string | null;
  diet: string | null;
  sun: string | null;
  skinType?: string | null;
  referralSource?: string | null;
  referralOther?: string;
  skippedSteps?: number[];
  /** Unix ms — used to merge local vs server drafts without losing back navigation. */
  updatedAt?: number;
};

const VALID_GENDERS = new Set([
  "female",
  "male",
  "other",
  "prefer_not_say",
]);

const VALID_CONCERNS = new Set([
  "acne",
  "pigmentation",
  "ageing",
  "hair",
  "general",
]);

const VALID_SEVERITY = new Set(["mild", "moderate", "severe"]);
const VALID_DURATION = new Set(["recent", "ongoing", "chronic"]);
const VALID_PRIOR_TX = new Set(["yes", "no"]);
const VALID_SENSITIVITY = new Set(["low", "moderate", "high"]);
const VALID_SLEEP = new Set(["under5", "5to6", "7to8", "8plus"]);
const VALID_WATER = new Set(["under1l", "1to1_5l", "1_5to2l", "2lplus"]);
const VALID_DIET = new Set(["vegetarian", "vegan", "nonveg", "mixed"]);
const VALID_SUN = new Set(["minimal", "low", "moderate", "high"]);
const VALID_SKIN_TYPES = new Set([
  "Dry",
  "Oily",
  "Combination",
  "Normal",
  "Sensitive",
]);

/** Validate and normalize a stored draft (localStorage or DB). */
export function parseOnboardingQuestionnaireDraft(
  raw: unknown
): OnboardingQuestionnaireDraftV2 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (d.v !== ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA) return null;
  if (typeof d.step !== "number" || d.step < 0 || d.step > 11) return null;

  const triggers = Array.isArray(d.triggers)
    ? d.triggers.filter((x): x is string => typeof x === "string")
    : [];

  const skippedSteps = Array.isArray(d.skippedSteps)
    ? d.skippedSteps.filter(
        (n): n is number => typeof n === "number" && Number.isInteger(n)
      )
    : [];

  const gender =
    typeof d.gender === "string" && VALID_GENDERS.has(d.gender)
      ? d.gender
      : null;
  const concern =
    typeof d.concern === "string" && VALID_CONCERNS.has(d.concern)
      ? d.concern
      : null;
  const severity =
    typeof d.severity === "string" && VALID_SEVERITY.has(d.severity)
      ? d.severity
      : null;
  const duration =
    typeof d.duration === "string" && VALID_DURATION.has(d.duration)
      ? d.duration
      : null;
  const priorTx =
    typeof d.priorTx === "string" && VALID_PRIOR_TX.has(d.priorTx)
      ? d.priorTx
      : null;
  const sensitivity =
    typeof d.sensitivity === "string" && VALID_SENSITIVITY.has(d.sensitivity)
      ? d.sensitivity
      : null;
  const sleep =
    typeof d.sleep === "string" && VALID_SLEEP.has(d.sleep) ? d.sleep : null;
  const water =
    typeof d.water === "string" && VALID_WATER.has(d.water) ? d.water : null;
  const diet =
    typeof d.diet === "string" && VALID_DIET.has(d.diet) ? d.diet : null;
  const sun =
    typeof d.sun === "string" && VALID_SUN.has(d.sun) ? d.sun : null;
  const skinType =
    typeof d.skinType === "string" && VALID_SKIN_TYPES.has(d.skinType)
      ? d.skinType
      : null;

  return {
    v: ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA,
    step: d.step,
    ageInput: typeof d.ageInput === "string" ? d.ageInput : "",
    gender,
    concern,
    severity,
    duration,
    triggers,
    priorTx,
    txText: typeof d.txText === "string" ? d.txText : "",
    txDur: typeof d.txDur === "string" ? d.txDur : "",
    sensitivity,
    sleep,
    water,
    diet,
    sun,
    skinType,
    referralSource:
      typeof d.referralSource === "string" ? d.referralSource : null,
    referralOther:
      typeof d.referralOther === "string" ? d.referralOther : "",
    skippedSteps,
    updatedAt:
      typeof d.updatedAt === "number" && Number.isFinite(d.updatedAt)
        ? d.updatedAt
        : undefined,
  };
}

function pickRicherString(a: string, b: string): string {
  const at = a.trim();
  const bt = b.trim();
  if (!at) return bt;
  if (!bt) return at;
  return at.length >= bt.length ? at : bt;
}

function pickNullable<T>(a: T | null, b: T | null): T | null {
  return a ?? b;
}

function pickTriggers(a: string[], b: string[]): string[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  return a.length >= b.length ? a : b;
}

/** Merge field-by-field so answers are not lost when step counters differ. */
export function mergeOnboardingQuestionnaireDrafts(
  local: OnboardingQuestionnaireDraftV2 | null,
  server: OnboardingQuestionnaireDraftV2 | null
): OnboardingQuestionnaireDraftV2 | null {
  if (!local) return server;
  if (!server) return local;

  const localTs = local.updatedAt ?? 0;
  const serverTs = server.updatedAt ?? 0;
  const preferLocal = localTs >= serverTs;

  const priorTx = pickNullable(local.priorTx, server.priorTx) as
    | "yes"
    | "no"
    | null;
  const merged: OnboardingQuestionnaireDraftV2 = {
    v: ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA,
    step: preferLocal ? local.step : server.step,
    ageInput: pickRicherString(local.ageInput, server.ageInput),
    gender: pickNullable(local.gender, server.gender),
    concern: pickNullable(local.concern, server.concern),
    severity: pickNullable(local.severity, server.severity),
    duration: pickNullable(local.duration, server.duration),
    triggers: pickTriggers(local.triggers, server.triggers),
    priorTx,
    txText: pickRicherString(local.txText, server.txText),
    txDur: pickRicherString(local.txDur, server.txDur),
    sensitivity: pickNullable(local.sensitivity, server.sensitivity),
    sleep: pickNullable(local.sleep, server.sleep),
    water: pickNullable(local.water, server.water),
    diet: pickNullable(local.diet, server.diet),
    sun: pickNullable(local.sun, server.sun),
    skinType: pickNullable(local.skinType ?? null, server.skinType ?? null),
    referralSource: pickNullable(
      local.referralSource ?? null,
      server.referralSource ?? null
    ),
    referralOther: pickRicherString(
      local.referralOther ?? "",
      server.referralOther ?? ""
    ),
    skippedSteps: preferLocal
      ? [...(local.skippedSteps ?? [])]
      : [...(server.skippedSteps ?? [])],
    updatedAt: Math.max(localTs, serverTs, Date.now()),
  };

  merged.step = normalizeOnboardingQuestionnaireStep(
    merged.step,
    priorTx === "yes" || priorTx === "no" ? priorTx : null
  );

  return merged;
}

export function buildOnboardingQuestionnaireDraft(
  fields: Omit<OnboardingQuestionnaireDraftV2, "v">
): OnboardingQuestionnaireDraftV2 {
  return {
    v: ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA,
    updatedAt: Date.now(),
    ...fields,
  };
}

export type OnboardingQuestionnaireDraftSetters = {
  setStep: (step: number) => void;
  setAgeInput: (value: string) => void;
  setGender: (value: string | null) => void;
  setConcern: (value: string | null) => void;
  setSeverity: (value: string | null) => void;
  setDuration: (value: string | null) => void;
  setTriggers: (value: string[]) => void;
  setPriorTx: (value: string | null) => void;
  setTxText: (value: string) => void;
  setTxDur: (value: string) => void;
  setSensitivity: (value: string | null) => void;
  setSleep: (value: string | null) => void;
  setWater: (value: string | null) => void;
  setDiet: (value: string | null) => void;
  setSun: (value: string | null) => void;
  setSkinType: (value: string | null) => void;
  setReferralSource: (value: string | null) => void;
  setReferralOther: (value: string) => void;
  setSkippedSteps: (value: number[]) => void;
};

/** Hydrate questionnaire form state from a saved draft. */
export function applyOnboardingQuestionnaireDraft(
  d: OnboardingQuestionnaireDraftV2,
  set: OnboardingQuestionnaireDraftSetters
): void {
  set.setStep(
    normalizeOnboardingQuestionnaireStep(
      d.step,
      d.priorTx === "yes" || d.priorTx === "no" ? d.priorTx : null
    )
  );
  set.setAgeInput(d.ageInput);
  set.setGender(d.gender);
  set.setConcern(d.concern);
  set.setSeverity(d.severity);
  set.setDuration(d.duration);
  set.setTriggers(d.triggers);
  set.setPriorTx(d.priorTx);
  set.setTxText(d.txText);
  set.setTxDur(d.txDur);
  set.setSensitivity(d.sensitivity);
  set.setSleep(d.sleep);
  set.setWater(d.water);
  set.setDiet(d.diet);
  set.setSun(d.sun);
  set.setSkinType(d.skinType ?? null);
  set.setReferralSource(d.referralSource ?? null);
  set.setReferralOther(d.referralOther ?? "");
  set.setSkippedSteps(d.skippedSteps ?? []);
}

/** @deprecated Loaded only for migration; v1 drafts are discarded. */
export type OnboardingQuestionnaireDraftV1 = {
  v: 1;
  step: number;
  concern: string | null;
  severity: string | null;
  duration: string | null;
  triggers: string[];
  priorTx: string | null;
  txText: string;
  txDur: string;
  sensitivity: string | null;
  sleep: string | null;
  water: string | null;
  diet: string | null;
  sun: string | null;
  skinType?: string | null;
};
