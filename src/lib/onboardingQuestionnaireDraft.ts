/** Web: localStorage. Native: AsyncStorage with same key. */
export const ONBOARDING_QUESTIONNAIRE_DRAFT_KEY = "skinfit_onboarding_questionnaire_v1";

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
};
