import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@skf_cache:";

type CacheEntry<T> = { data: T; ts: number };

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
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
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {}
}

export async function getCacheAge(key: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return Infinity;
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    return Date.now() - entry.ts;
  } catch {
    return Infinity;
  }
}

export async function clearProfileCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {}
}
