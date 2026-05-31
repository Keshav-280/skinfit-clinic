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
  history: (userId: string) => `history:${userId}`,
  scan: (userId: string, scanId: number) => `scan:${userId}:${scanId}`,
  scanPrefix: (userId: string) => `scan:${userId}:`,
  tracker: (userId: string, scanId: number) => `tracker:${userId}:${scanId}`,
  trackerPrefix: (userId: string) => `tracker:${userId}:`,
  skinProfile: (userId: string) => `skin-profile:${userId}`,
  skinIdentity: (userId: string) => `skin-identity:${userId}`,
  monthlyInsight: (userId: string) => `monthly-insight:${userId}`,
  hydrationInsight: (userId: string, dateYmd: string) =>
    `hydration-insight:${userId}:${dateYmd}`,
  hydrationInsightPrefix: (userId: string) => `hydration-insight:${userId}:`,
  report: (scanId: number) => `report:${scanId}`,
  session: (sessionId: string) => `session:${sessionId}`,
} as const;

export async function invalidateUserProfileCache(userId: string): Promise<void> {
  await getCache().del(CacheKeys.profile(userId));
}

export async function invalidateUserHomeCache(userId: string): Promise<void> {
  await getCache().delByPrefix(CacheKeys.homePrefix(userId));
}

export async function invalidateUserHistoryCache(userId: string): Promise<void> {
  const cache = getCache();
  await cache.del(CacheKeys.history(userId));
  await cache.del(`${CacheKeys.history(userId)}:visits`);
}

export async function invalidateUserScanCache(
  userId: string,
  scanId: number
): Promise<void> {
  const cache = getCache();
  await cache.del(CacheKeys.scan(userId, scanId));
  await cache.del(CacheKeys.tracker(userId, scanId));
}

export async function invalidateUserScanDerivedCaches(
  userId: string
): Promise<void> {
  const cache = getCache();
  await cache.delByPrefix(CacheKeys.scanPrefix(userId));
  await cache.delByPrefix(CacheKeys.trackerPrefix(userId));
  await cache.del(CacheKeys.history(userId));
}

export async function invalidateUserInsightsCache(userId: string): Promise<void> {
  const cache = getCache();
  await cache.del(CacheKeys.skinProfile(userId));
  await cache.del(CacheKeys.skinIdentity(userId));
  await cache.del(CacheKeys.monthlyInsight(userId));
  await cache.delByPrefix(CacheKeys.hydrationInsightPrefix(userId));
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
