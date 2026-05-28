import type { Job } from "bullmq";

/** BullMQ options for async scan jobs (web + mobile submit via POST /api/scans/submit). */
export const SCAN_ANALYSIS_QUEUE_JOB_OPTS = {
  removeOnComplete: 200,
  removeOnFail: 100,
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5000 },
} as const;

export function scanJobHasAttemptsRemaining(job: Job): boolean {
  const max = job.opts.attempts ?? 1;
  return job.attemptsMade < max;
}

/** Transient inference/network errors — safe to retry. Auth/validation fail fast. */
export function isScanAnalysisRetryableError(message: string): boolean {
  const m = message.toLowerCase();
  if (
    m.includes("401") ||
    m.includes("403") ||
    m.includes("invalid or missing x-api-key")
  ) {
    return false;
  }
  if (
    m.includes("face_analysis_service_url is required") ||
    m.includes("provide exactly") ||
    m.includes("empty or invalid")
  ) {
    return false;
  }
  if (m.includes("modulenotfounderror") || m.includes("importerror")) {
    return false;
  }
  if (
    m.includes("fetch failed") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("etimedout") ||
    m.includes("timeout") ||
    m.includes("socket hang up")
  ) {
    return true;
  }
  if (/http 5\d{2}/.test(m) || m.includes("internal server error")) {
    return true;
  }
  if (m.includes("503") || m.includes("502") || m.includes("504")) {
    return true;
  }
  return true;
}
