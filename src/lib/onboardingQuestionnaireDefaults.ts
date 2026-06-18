import { parseOnboardingAge } from "@/src/lib/onboardingAgeOptions";
import {
  normalizeOnboardingConcerns,
  primaryOnboardingConcern,
  type OnboardingConcernId,
} from "@/src/lib/onboardingConcerns";
import type { ReferralSourceId } from "@/src/lib/onboardingReferralSource";

export type ConcernSeverity = "mild" | "moderate" | "severe";
export type OverallSkinHealth = "maintenance" | "need_improve" | "ongoing_concerns";

export const OVERALL_SKIN_HEALTH_OPTIONS: ReadonlyArray<{
  id: OverallSkinHealth;
  label: string;
}> = [
  { id: "maintenance", label: "Maintenance" },
  { id: "need_improve", label: "Need to improve" },
  { id: "ongoing_concerns", label: "Ongoing concerns" },
];

export const ONBOARDING_QUESTIONNAIRE_LAST_STEP = 12;
export type ConcernDuration = "recent" | "ongoing" | "chronic";
export type SkinSensitivity = "low" | "moderate" | "high";
export type BaselineSleep = "under5" | "5to6" | "7to8" | "8plus";
export type BaselineHydration = "under1l" | "1to1_5l" | "1_5to2l" | "2lplus";
export type BaselineDietType = "vegetarian" | "vegan" | "nonveg" | "mixed";
export type BaselineSunExposure = "minimal" | "low" | "moderate" | "high";

export const ONBOARDING_QUESTIONNAIRE_DEFAULTS = {
  age: 30,
  gender: "prefer_not_say",
  primaryConcern: "general",
  overallSkinHealth: "maintenance" as OverallSkinHealth,
  concernSeverity: "mild",
  concernDuration: "ongoing",
  triggers: ["unsure"],
  priorTreatment: "no",
  treatmentHistoryText: "Not specified",
  treatmentHistoryDuration: "under1m",
  skinSensitivity: "moderate",
  baselineSleep: "7to8",
  baselineHydration: "1to1_5l",
  baselineDietType: "mixed",
  baselineSunExposure: "moderate",
  skinType: "Normal",
  referralSource: "other" as ReferralSourceId,
  referralSourceOther: "Prefer not to say",
} as const;

export const QUESTIONNAIRE_STEPS_ALL = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const;

/**
 * Parent step → dependent follow-ups that should be skipped together.
 * - 1: concern follow-ups (severity, duration, triggers) — not overall skin health (step 2)
 * - 6: treatment details (only when prior treatment = no / skipped)
 */
export const QUESTIONNAIRE_SKIP_CASCADE: Record<number, readonly number[]> = {
  1: [3, 4, 5],
  6: [7],
};

/** Active steps given current answers (step 7 only when prior treatment = yes). */
export function getActiveQuestionnaireSteps(
  priorTx: "yes" | "no" | null
): number[] {
  if (priorTx === "yes") {
    return [...QUESTIONNAIRE_STEPS_ALL];
  }
  return [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
}

export function isQuestionnaireStepActive(
  step: number,
  priorTx: "yes" | "no" | null
): boolean {
  return getActiveQuestionnaireSteps(priorTx).includes(step);
}

/** Snap invalid / bypassed steps to the next active step. */
export function normalizeOnboardingQuestionnaireStep(
  step: number,
  priorTx: "yes" | "no" | null
): number {
  const active = getActiveQuestionnaireSteps(priorTx);
  if (active.includes(step)) return step;
  const next = active.find((s) => s >= step);
  if (next !== undefined) return next;
  return active[active.length - 1] ?? 0;
}

export function isOnboardingQuestionnaireStepComplete(
  step: number,
  state: OnboardingQuestionnaireFormState,
  skippedSteps: number[]
): boolean {
  if (skippedSteps.includes(step)) return true;

  switch (step) {
    case 0:
      return parseOnboardingAge(state.ageInput) != null && state.gender != null;
    case 1:
      return state.concerns.length > 0;
    case 2:
      return state.overallSkinHealth != null;
    case 3:
      return state.severity != null;
    case 4:
      return state.duration != null;
    case 5:
      return state.triggers.length > 0;
    case 6:
      return state.priorTx != null;
    case 7:
      if (state.priorTx !== "yes") return true;
      return state.txText.trim().length >= 10 && state.txDur.trim().length > 0;
    case 8:
      return state.sensitivity != null;
    case 9:
      return state.sleep != null;
    case 10:
      return state.water != null && state.diet != null && state.sun != null;
    case 11:
      return state.skinType != null;
    case 12:
      if (state.referralSource == null) return false;
      if (state.referralSource === "other") {
        return state.referralOther.trim().length >= 3;
      }
      return true;
    default:
      return false;
  }
}

/** First unanswered step in the active flow (used when resuming from profile). */
export function firstIncompleteOnboardingQuestionnaireStep(
  state: OnboardingQuestionnaireFormState,
  skippedSteps: number[],
  priorTx: "yes" | "no" | null
): number {
  const active = getActiveQuestionnaireSteps(priorTx);
  // Skipped steps come first: a resume should land on the earliest question
  // the patient still owes an answer for, even if it has a default applied.
  for (const step of active) {
    if (skippedSteps.includes(step)) return step;
    if (!isOnboardingQuestionnaireStepComplete(step, state, skippedSteps)) {
      return step;
    }
  }
  return active[active.length - 1] ?? 0;
}

export type QuestionnaireEntryMode = "start" | "resume";

export function resolveOnboardingQuestionnaireEntryStep(
  state: OnboardingQuestionnaireFormState,
  skippedSteps: number[],
  priorTx: "yes" | "no" | null,
  entry: QuestionnaireEntryMode | null
): number {
  if (entry === "start") return 0;
  return firstIncompleteOnboardingQuestionnaireStep(state, skippedSteps, priorTx);
}

export function questionnaireProgress(
  step: number,
  priorTx: "yes" | "no" | null
): { displayStep: number; totalSteps: number } {
  const active = getActiveQuestionnaireSteps(priorTx);
  const normalized = normalizeOnboardingQuestionnaireStep(step, priorTx);
  const ix = active.indexOf(normalized);
  return {
    displayStep: ix >= 0 ? ix + 1 : 1,
    totalSteps: active.length,
  };
}

export function nextOnboardingQuestionnaireStep(
  step: number,
  priorTx: "yes" | "no" | null
): number {
  if (step >= ONBOARDING_QUESTIONNAIRE_LAST_STEP) return ONBOARDING_QUESTIONNAIRE_LAST_STEP;
  const active = getActiveQuestionnaireSteps(priorTx);
  return active.find((s) => s > step) ?? ONBOARDING_QUESTIONNAIRE_LAST_STEP;
}

export function prevOnboardingQuestionnaireStep(
  step: number,
  priorTx: "yes" | "no" | null
): number {
  if (step <= 0) return 0;
  const active = getActiveQuestionnaireSteps(priorTx);
  return [...active].reverse().find((s) => s < step) ?? 0;
}

/** First active step after a block of steps (used after skip cascades). */
export function stepAfterQuestionnaireBlock(
  lastStepInBlock: number,
  priorTx: "yes" | "no" | null
): number {
  const active = getActiveQuestionnaireSteps(priorTx);
  return active.find((s) => s > lastStepInBlock) ?? active[active.length - 1] ?? ONBOARDING_QUESTIONNAIRE_LAST_STEP;
}

export function expandSkippedStepsForSkip(
  step: number,
  skippedSteps: number[]
): number[] {
  const result = new Set(skippedSteps);
  result.add(step);
  for (const dependent of QUESTIONNAIRE_SKIP_CASCADE[step] ?? []) {
    result.add(dependent);
  }
  return [...result].sort((a, b) => a - b);
}

/**
 * Patient-facing count of skipped questions still to finish.
 *
 * A skipped parent step (e.g. concerns) cascades to its dependents (severity,
 * duration, triggers). Those dependents are not independently answerable, so
 * they should NOT be counted as separate "remaining questions" — otherwise one
 * skip action inflates the count (e.g. skipping concerns shows "4 questions").
 * We count each skipped step once, minus dependents whose parent was also skipped.
 */
export function countOutstandingSkippedQuestions(
  skippedSteps: number[]
): number {
  const skipped = new Set(skippedSteps);
  const coveredByParent = new Set<number>();
  for (const [parent, dependents] of Object.entries(QUESTIONNAIRE_SKIP_CASCADE)) {
    if (!skipped.has(Number(parent))) continue;
    for (const dependent of dependents) {
      if (skipped.has(dependent)) coveredByParent.add(dependent);
    }
  }
  return [...skipped].filter((s) => !coveredByParent.has(s)).length;
}

/** Ensure saved drafts include cascaded skips for any skipped parent step. */
export function reconcileSkippedSteps(skippedSteps: number[]): number[] {
  const result = new Set(skippedSteps);
  for (const [parent, dependents] of Object.entries(QUESTIONNAIRE_SKIP_CASCADE)) {
    const parentStep = Number(parent);
    if (!result.has(parentStep)) continue;
    for (const dependent of dependents) {
      result.add(dependent);
    }
  }
  return [...result].sort((a, b) => a - b);
}

/** Drop skip marks when the patient re-answers a step (or its skip block). */
export function removeSkippedStepsForAnswer(
  step: number,
  skippedSteps: number[]
): number[] {
  const toRemove = new Set<number>([step]);
  for (const dependent of QUESTIONNAIRE_SKIP_CASCADE[step] ?? []) {
    toRemove.add(dependent);
  }
  for (const [parent, dependents] of Object.entries(QUESTIONNAIRE_SKIP_CASCADE)) {
    const parentStep = Number(parent);
    if (dependents.includes(step) || step === parentStep) {
      toRemove.add(parentStep);
      for (const dependent of dependents) {
        toRemove.add(dependent);
      }
    }
  }
  return skippedSteps.filter((s) => !toRemove.has(s)).sort((a, b) => a - b);
}

/** Clear fields filled by skip defaults so back navigation prompts a real answer. */
export function clearOnboardingStepFields(
  step: number
): Partial<OnboardingQuestionnaireFormState> {
  switch (step) {
    case 0:
      return { ageInput: "", gender: null };
    case 1:
      return { concerns: [] };
    case 2:
      return { overallSkinHealth: null };
    case 3:
      return { severity: null };
    case 4:
      return { duration: null };
    case 5:
      return { triggers: [] };
    case 6:
      return { priorTx: null, txText: "", txDur: "" };
    case 7:
      return { txText: "", txDur: "" };
    case 8:
      return { sensitivity: null };
    case 9:
      return { sleep: null };
    case 10:
      return { water: null, diet: null, sun: null };
    case 11:
      return { skinType: null };
    case 12:
      return { referralSource: null, referralOther: "" };
    default:
      return {};
  }
}

export function clearOnboardingStepBlockFields(
  step: number
): Partial<OnboardingQuestionnaireFormState> {
  const steps = [step, ...(QUESTIONNAIRE_SKIP_CASCADE[step] ?? [])];
  let patch: Partial<OnboardingQuestionnaireFormState> = {};
  for (const s of steps) {
    patch = { ...patch, ...clearOnboardingStepFields(s) };
  }
  return patch;
}

export function prepareQuestionnaireNext(
  activeStep: number,
  priorTx: "yes" | "no" | null,
  skippedSteps: number[]
): { nextStep: number; nextSkipped: number[] } {
  return {
    nextSkipped: removeSkippedStepsForAnswer(activeStep, skippedSteps),
    nextStep: nextOnboardingQuestionnaireStep(activeStep, priorTx),
  };
}

export function prepareQuestionnaireBack(
  activeStep: number,
  priorTx: "yes" | "no" | null,
  skippedSteps: number[]
): {
  prevStep: number;
  nextSkipped: number[];
  clearPatch: Partial<OnboardingQuestionnaireFormState>;
} {
  const prevStep = prevOnboardingQuestionnaireStep(activeStep, priorTx);
  const wasSkipped = skippedSteps.includes(prevStep);
  return {
    prevStep,
    nextSkipped: removeSkippedStepsForAnswer(prevStep, skippedSteps),
    clearPatch: wasSkipped ? clearOnboardingStepBlockFields(prevStep) : {},
  };
}

/** Apply skip defaults for a step and any cascaded dependents. */
export function mergeOnboardingStepSkipPatches(
  step: number
): Partial<OnboardingQuestionnaireFormState> {
  const steps = [step, ...(QUESTIONNAIRE_SKIP_CASCADE[step] ?? [])];
  let patch: Partial<OnboardingQuestionnaireFormState> = {};
  for (const s of steps) {
    patch = { ...patch, ...applyOnboardingStepSkip(s) };
  }
  return patch;
}

export function nextOnboardingQuestionnaireStepAfterSkip(
  step: number,
  priorTx: "yes" | "no" | null,
  patch: Partial<OnboardingQuestionnaireFormState>
): number {
  const effectivePriorTx =
    patch.priorTx === "yes" || patch.priorTx === "no" ? patch.priorTx : priorTx;
  const cascade = QUESTIONNAIRE_SKIP_CASCADE[step];
  if (cascade?.length) {
    return stepAfterQuestionnaireBlock(
      cascade[cascade.length - 1],
      effectivePriorTx
    );
  }
  return nextOnboardingQuestionnaireStep(step, effectivePriorTx);
}

export type OnboardingQuestionnaireFormState = {
  ageInput: string;
  gender: string | null;
  concerns: OnboardingConcernId[];
  overallSkinHealth: OverallSkinHealth | null;
  severity: ConcernSeverity | null;
  duration: ConcernDuration | null;
  triggers: string[];
  priorTx: "yes" | "no" | null;
  txText: string;
  txDur: string;
  sensitivity: SkinSensitivity | null;
  sleep: BaselineSleep | null;
  water: BaselineHydration | null;
  diet: BaselineDietType | null;
  sun: BaselineSunExposure | null;
  skinType: string | null;
  referralSource: ReferralSourceId | null;
  referralOther: string;
};

/** Defaults applied when the patient taps Skip on a step. */
export function applyOnboardingStepSkip(
  step: number
): Partial<OnboardingQuestionnaireFormState> {
  const d = ONBOARDING_QUESTIONNAIRE_DEFAULTS;
  switch (step) {
    case 0:
      return { ageInput: String(d.age), gender: d.gender };
    case 1:
      return { concerns: [d.primaryConcern] };
    case 2:
      return { overallSkinHealth: d.overallSkinHealth };
    case 3:
      return { severity: d.concernSeverity };
    case 4:
      return { duration: d.concernDuration };
    case 5:
      return { triggers: [...d.triggers] };
    case 6:
      return { priorTx: d.priorTreatment, txText: "", txDur: "" };
    case 7:
      return {
        txText: d.treatmentHistoryText,
        txDur: d.treatmentHistoryDuration,
      };
    case 8:
      return { sensitivity: d.skinSensitivity };
    case 9:
      return { sleep: d.baselineSleep };
    case 10:
      return {
        water: d.baselineHydration,
        diet: d.baselineDietType,
        sun: d.baselineSunExposure,
      };
    case 11:
      return { skinType: d.skinType };
    case 12:
      return {
        referralSource: d.referralSource,
        referralOther: d.referralSourceOther,
      };
    default:
      return {};
  }
}

export function buildOnboardingQuestionnairePayload(
  state: OnboardingQuestionnaireFormState,
  options?: { skippedSteps?: number[] }
) {
  const d = ONBOARDING_QUESTIONNAIRE_DEFAULTS;
  const age = parseOnboardingAge(state.ageInput) ?? d.age;
  const priorTx = state.priorTx ?? d.priorTreatment;
  const triggers =
    state.triggers.length > 0 ? state.triggers : [...d.triggers];
  const referralSource = state.referralSource ?? d.referralSource;
  const referralOther =
    referralSource === "other"
      ? state.referralOther.trim().length >= 3
        ? state.referralOther.trim()
        : d.referralSourceOther
      : undefined;

  const concerns =
    state.concerns.length > 0
      ? state.concerns
      : normalizeOnboardingConcerns(null, d.primaryConcern);
  const primaryConcern = primaryOnboardingConcern(concerns);

  return {
    age,
    gender: state.gender ?? d.gender,
    primaryConcerns: concerns,
    primaryConcern,
    overallSkinHealth: state.overallSkinHealth ?? d.overallSkinHealth,
    concernSeverity: state.severity ?? d.concernSeverity,
    concernDuration: state.duration ?? d.concernDuration,
    triggers,
    priorTreatment: priorTx,
    treatmentHistoryText:
      priorTx === "yes"
        ? state.txText.trim().length >= 10
          ? state.txText.trim()
          : d.treatmentHistoryText
        : undefined,
    treatmentHistoryDuration:
      priorTx === "yes"
        ? state.txDur.trim() || d.treatmentHistoryDuration
        : undefined,
    skinSensitivity: state.sensitivity ?? d.skinSensitivity,
    baselineSleep: state.sleep ?? d.baselineSleep,
    baselineHydration: state.water ?? d.baselineHydration,
    baselineDietType: state.diet ?? d.baselineDietType,
    baselineSunExposure: state.sun ?? d.baselineSunExposure,
    skinType: state.skinType ?? d.skinType,
    referralSource,
    referralSourceOther: referralOther,
    skippedSteps: options?.skippedSteps ?? [],
  };
}
