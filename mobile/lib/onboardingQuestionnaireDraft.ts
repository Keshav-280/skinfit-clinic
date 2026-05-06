export const ONBOARDING_QUESTIONNAIRE_DRAFT_KEY =
  "skinfit_onboarding_questionnaire_v1";

/** Draft schema version (bump when step order or required fields change). */
export const ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA = 2 as const;

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
};

/** @deprecated v1 drafts are no longer loaded. */
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
