export const ONBOARDING_MIN_AGE = 1;
export const ONBOARDING_MAX_AGE = 120;

export const ONBOARDING_AGE_OPTIONS: number[] = Array.from(
  { length: ONBOARDING_MAX_AGE - ONBOARDING_MIN_AGE + 1 },
  (_, i) => ONBOARDING_MIN_AGE + i
);

export function parseOnboardingAge(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) return null;
  if (n < ONBOARDING_MIN_AGE || n > ONBOARDING_MAX_AGE) return null;
  return n;
}
