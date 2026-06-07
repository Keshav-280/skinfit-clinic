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
