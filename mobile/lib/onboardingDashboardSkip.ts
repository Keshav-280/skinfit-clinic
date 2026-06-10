import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Explicit "Skip to dashboard" tap during onboarding. Web lets any signed-in
 * patient open /dashboard; this flag gives mobile the same behavior without
 * relaxing the gate for users who never chose to skip. Keyed by user id so a
 * different account on the same device still goes through onboarding.
 */
const KEY_PREFIX = "skinfit_onboarding_dashboard_skip_v1:";

const cache = new Map<string, boolean>();

export async function setOnboardingDashboardSkip(userId: string): Promise<void> {
  cache.set(userId, true);
  try {
    await AsyncStorage.setItem(`${KEY_PREFIX}${userId}`, "1");
  } catch {
    /* keep in-memory value */
  }
}

export async function getOnboardingDashboardSkip(userId: string): Promise<boolean> {
  const cached = cache.get(userId);
  if (cached != null) return cached;
  try {
    const value = (await AsyncStorage.getItem(`${KEY_PREFIX}${userId}`)) === "1";
    cache.set(userId, value);
    return value;
  } catch {
    return false;
  }
}
