import { parseOnboardingAge } from "@/src/lib/onboardingAgeOptions";
import type { ReferralSourceId } from "@/src/lib/onboardingReferralSource";

export type ConcernSeverity = "mild" | "moderate" | "severe";
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
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
] as const;

/**
 * Parent step → dependent follow-ups that should be skipped together.
 * - 1: concern follow-ups (severity, duration, triggers)
 * - 5: treatment details (only when prior treatment = no / skipped)
 */
export const QUESTIONNAIRE_SKIP_CASCADE: Record<number, readonly number[]> = {
  1: [2, 3, 4],
  5: [6],
};

/** Active steps given current answers (step 6 only when prior treatment = yes). */
export function getActiveQuestionnaireSteps(
  priorTx: "yes" | "no" | null
): number[] {
  if (priorTx === "no") {
    return [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
  }
  return [...QUESTIONNAIRE_STEPS_ALL];
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
  if (step >= 11) return 11;
  const active = getActiveQuestionnaireSteps(priorTx);
  return active.find((s) => s > step) ?? 11;
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
  return active.find((s) => s > lastStepInBlock) ?? active[active.length - 1] ?? 11;
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
      return { concern: null };
    case 2:
      return { severity: null };
    case 3:
      return { duration: null };
    case 4:
      return { triggers: [] };
    case 5:
      return { priorTx: null, txText: "", txDur: "" };
    case 6:
      return { txText: "", txDur: "" };
    case 7:
      return { sensitivity: null };
    case 8:
      return { sleep: null };
    case 9:
      return { water: null, diet: null, sun: null };
    case 10:
      return { skinType: null };
    case 11:
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
  concern: string | null;
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
      return { concern: d.primaryConcern };
    case 2:
      return { severity: d.concernSeverity };
    case 3:
      return { duration: d.concernDuration };
    case 4:
      return { triggers: [...d.triggers] };
    case 5:
      return { priorTx: d.priorTreatment, txText: "", txDur: "" };
    case 6:
      return {
        txText: d.treatmentHistoryText,
        txDur: d.treatmentHistoryDuration,
      };
    case 7:
      return { sensitivity: d.skinSensitivity };
    case 8:
      return { sleep: d.baselineSleep };
    case 9:
      return {
        water: d.baselineHydration,
        diet: d.baselineDietType,
        sun: d.baselineSunExposure,
      };
    case 10:
      return { skinType: d.skinType };
    case 11:
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

  return {
    age,
    gender: state.gender ?? d.gender,
    primaryConcern: state.concern ?? d.primaryConcern,
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
