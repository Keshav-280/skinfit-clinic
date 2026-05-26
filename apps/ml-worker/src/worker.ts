/**
 * ML / scan analysis worker — consumes BullMQ jobs only (not exposed to frontend).
 */
import "./load-env.js";
import { UnrecoverableError, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import schemaModule from "../../../src/db/schema.js";
import { getRedisUrl } from "../../../services/shared/src/env/index.js";
import {
  QUEUE_NAMES,
  isScanAnalysisRetryableError,
  scanJobHasAttemptsRemaining,
  setJobStatus,
} from "../../../services/shared/src/queue/index.js";
import { logger } from "../../../services/shared/src/logging/index.js";

const scanJobs =
  // tsx interop can wrap TS modules as default/module.exports.
  // Handle both shapes so job failure updates always work.
  (schemaModule as { scanJobs?: unknown }).scanJobs ??
  (schemaModule as { default?: { scanJobs?: unknown } }).default?.scanJobs ??
  (schemaModule as { "module.exports"?: { scanJobs?: unknown } })[
    "module.exports"
  ]?.scanJobs;

if (!scanJobs) {
  throw new Error("scanJobs schema export not found in worker runtime");
}

const connection = { url: getRedisUrl() };

async function runProcessScanJob(
  jobId: string,
  payload: {
    userId: string;
    scanName: string;
    imagePaths: Record<string, string>;
    faceCaptureImages: Array<{ label: string; imageUrl: string }>;
    primaryImageUrl: string;
  }
) {
  const mod = await import("../../../src/lib/scanPipeline/processScanJob.js");
  const fn =
    (mod as { processScanJob?: (typeof import("../../../src/lib/scanPipeline/processScanJob.js"))["processScanJob"] })
      .processScanJob ??
    (mod as { default?: { processScanJob?: unknown } }).default?.processScanJob;
  if (typeof fn !== "function") {
    throw new Error("processScanJob export not found");
  }
  return (fn as (id: string, p: typeof payload, d: typeof db) => Promise<{ scanId: number }>)(
    jobId,
    payload,
    db
  );
}

const worker = new Worker(
  QUEUE_NAMES.scanAnalysis,
  async (job) => {
    const { jobId, payload } = job.data as {
      jobId: string;
      payload: Parameters<typeof runProcessScanJob>[1];
    };
    logger.queue(QUEUE_NAMES.scanAnalysis, "processing", { jobId });
    await setJobStatus(jobId, "processing");
    try {
      const { scanId } = await runProcessScanJob(jobId, payload);
      await setJobStatus(jobId, "completed", { scanId });
      logger.queue(QUEUE_NAMES.scanAnalysis, "completed", { jobId, scanId });
      return { scanId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = isScanAnalysisRetryableError(msg);
      const willRetry =
        retryable && scanJobHasAttemptsRemaining(job);
      logger.error("scan_job_failed", {
        jobId,
        error: msg,
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts ?? 1,
        willRetry,
      });
      try {
        if (willRetry) {
          await db
            .update(scanJobs)
            .set({
              status: "processing",
              errorText: msg,
              updatedAt: new Date(),
            })
            .where(eq(scanJobs.id, jobId));
        } else {
          await db
            .update(scanJobs)
            .set({
              status: "failed",
              errorText: msg,
              updatedAt: new Date(),
            })
            .where(eq(scanJobs.id, jobId));
        }
      } catch (dbErr) {
        logger.error("scan_job_failed_status_update_error", {
          jobId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      }
      if (willRetry) {
        await setJobStatus(jobId, "processing", {
          lastError: msg,
          attempt: job.attemptsMade,
          maxAttempts: job.opts.attempts ?? 1,
        });
        throw err;
      }
      await setJobStatus(jobId, "failed", { error: msg });
      if (!retryable) {
        throw new UnrecoverableError(msg);
      }
      throw err;
    }
  },
  { connection, concurrency: 1 }
);

worker.on("ready", () => {
  logger.info("ml_worker_ready", { queue: QUEUE_NAMES.scanAnalysis });
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
