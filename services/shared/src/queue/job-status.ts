import type { JobStatus } from "../types/index";
import { getCache } from "../cache/index";

const PREFIX = "job:status:";

export async function setJobStatus(
  jobId: string,
  status: JobStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const cache = getCache();
  await cache.set(
    `${PREFIX}${jobId}`,
    { status, updatedAt: new Date().toISOString(), ...extra },
    86_400
  );
}

export async function getJobStatus(jobId: string): Promise<{
  status: JobStatus;
  scanId?: number;
  error?: string;
  updatedAt?: string;
} | null> {
  const cache = getCache();
  return cache.get(`${PREFIX}${jobId}`);
}
