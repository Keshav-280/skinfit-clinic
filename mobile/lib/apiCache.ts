import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@skf_cache:";
let _userId: string | null = null;

/** Must be called on sign-in / token restore so cache keys are user-scoped. */
export function setCacheUserId(userId: string | null) {
  _userId = userId;
}

function fullKey(key: string): string {
  return _userId ? `${PREFIX}${_userId}:${key}` : `${PREFIX}${key}`;
}

type CacheEntry<T> = { data: T; ts: number };

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(fullKey(key));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    await AsyncStorage.setItem(fullKey(key), JSON.stringify(entry));
  } catch {}
}

export async function getCacheAge(key: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(fullKey(key));
    if (!raw) return Infinity;
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    return Date.now() - entry.ts;
  } catch {
    return Infinity;
  }
}

/** Wipes all app caches (profile, chat, inbox cursors, drafts). Call on sign-out. */
export async function clearAllAppCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(
      (k) =>
        k.startsWith(PREFIX) ||
        k.startsWith("skinfit-chat") ||
        k.startsWith("skinfit.clinic") ||
        k.startsWith("skinfit.doctor") ||
        k.startsWith("skinfit_onboarding")
    );
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {}
}

/** @deprecated Use clearAllAppCaches instead. */
export const clearProfileCache = clearAllAppCaches;
