export const ONBOARDING_CONCERN_IDS = [
  "acne",
  "pigmentation",
  "ageing",
  "hair",
  "general",
] as const;

export type OnboardingConcernId = (typeof ONBOARDING_CONCERN_IDS)[number];

export const ONBOARDING_CONCERN_LABELS: Record<OnboardingConcernId, string> = {
  acne: "Acne & breakouts",
  pigmentation: "Pigmentation & dark spots",
  ageing: "Ageing & wrinkles",
  hair: "Hair loss & scalp",
  general: "General skin health",
};

const CONCERN_ID_SET = new Set<string>(ONBOARDING_CONCERN_IDS);

export function isOnboardingConcernId(value: string): value is OnboardingConcernId {
  return CONCERN_ID_SET.has(value);
}

/** Normalize API / draft / legacy single-value input into validated concern ids. */
export function normalizeOnboardingConcerns(
  input: unknown,
  legacySingle?: string | null
): OnboardingConcernId[] {
  const raw: string[] = [];
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string" && isOnboardingConcernId(item)) {
        raw.push(item);
      }
    }
  } else if (typeof input === "string" && isOnboardingConcernId(input)) {
    raw.push(input);
  }
  if (raw.length === 0 && typeof legacySingle === "string" && isOnboardingConcernId(legacySingle)) {
    raw.push(legacySingle);
  }
  return [...new Set(raw)] as OnboardingConcernId[];
}

export function primaryOnboardingConcern(
  concerns: readonly string[]
): OnboardingConcernId {
  const first = concerns.find(isOnboardingConcernId);
  return first ?? "general";
}

export function formatOnboardingConcernLabels(
  concerns: readonly string[]
): string {
  return concerns
    .filter(isOnboardingConcernId)
    .map((id) => ONBOARDING_CONCERN_LABELS[id])
    .join(", ");
}

export function userConcernsFromProfile(user: {
  concerns?: string[] | null;
  primaryConcern?: string | null;
}): OnboardingConcernId[] {
  const fromArray = normalizeOnboardingConcerns(user.concerns);
  if (fromArray.length > 0) return fromArray;
  return normalizeOnboardingConcerns(null, user.primaryConcern);
}
