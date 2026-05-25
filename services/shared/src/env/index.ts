import { resolve, isAbsolute } from "node:path";

/**
 * Database URL abstraction — local Postgres now, AWS RDS later.
 * Never log full connection strings.
 */

export function getDatabaseUrl(): string {
  const local = process.env.LOCAL_POSTGRES_URL?.trim();
  const legacy = process.env.DATABASE_URL?.trim();
  const rds = process.env.AWS_RDS_URL?.trim();
  const url = local || rds || legacy;
  if (!url) {
    throw new Error(
      "Database URL missing. Set LOCAL_POSTGRES_URL (docker) or DATABASE_URL (Neon)."
    );
  }
  return url;
}

export function getRedisUrl(): string {
  return (
    process.env.LOCAL_REDIS_URL?.trim() ||
    process.env.REDIS_URL?.trim() ||
    process.env.ELASTICACHE_URL?.trim() ||
    "redis://127.0.0.1:6379"
  );
}

export function getStorageRoot(): string {
  const raw =
    process.env.LOCAL_STORAGE_ROOT?.trim() ||
    process.env.STORAGE_ROOT?.trim() ||
    "/uploads";

  if (!raw) return "/uploads";
  if (isAbsolute(raw)) return raw;

  // Workspace tasks (e.g. ml-worker) may run from subdirectories.
  // Resolve relative storage roots from project root when provided.
  const base = process.env.PROJECT_ROOT?.trim() || process.cwd();
  return resolve(base, raw);
}

export function isAsyncScanEnabled(): boolean {
  return (
    process.env.SCAN_ASYNC_MODE === "1" ||
    process.env.SCAN_ASYNC_MODE === "true"
  );
}

export function getPublicUploadBaseUrl(): string {
  const explicit = process.env.PUBLIC_UPLOAD_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return `${app.replace(/\/$/, "")}/api/files`;
  return "http://localhost:3000/api/files";
}
