import type { CacheProvider } from "./types";
import { RedisCacheProvider } from "./redis";

let cache: CacheProvider | null = null;

export function getCache(): CacheProvider {
  if (!cache) cache = new RedisCacheProvider();
  return cache;
}

export const CacheKeys = {
  profile: (userId: string) => `profile:${userId}`,
  home: (userId: string, dateYmd: string) => `home:${userId}:${dateYmd}`,
  homePrefix: (userId: string) => `home:${userId}:`,
  report: (scanId: number) => `report:${scanId}`,
  session: (sessionId: string) => `session:${sessionId}`,
} as const;

export async function invalidateUserProfileCache(userId: string): Promise<void> {
  await getCache().del(CacheKeys.profile(userId));
}

export async function invalidateUserHomeCache(userId: string): Promise<void> {
  await getCache().delByPrefix(CacheKeys.homePrefix(userId));
}

/** Cache-aside: check Redis → fallback → store. */
export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const c = getCache();
  const hit = await c.get<T>(key);
  if (hit != null) return hit;
  const value = await fetcher();
  await c.set(key, value, ttlSeconds);
  return value;
}

export type { CacheProvider } from "./types";
