import Redis from "ioredis";
import type { CacheProvider } from "./types";
import { getRedisUrl } from "../env/index";
import { logger } from "../logging/index";

export class RedisCacheProvider implements CacheProvider {
  private client: Redis;

  constructor(url?: string) {
    this.client = new Redis(url ?? getRedisUrl(), {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    if (this.client.status === "wait") await this.client.connect();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn("cache_get_miss", { key, error: String(err) });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      logger.warn("cache_set_failed", { key, error: String(err) });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      /* noop */
    }
  }
}
