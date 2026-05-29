/**
 * ML / scan analysis worker — consumes BullMQ jobs only (not exposed to frontend).
 */
import "./load-env.js";
import { UnrecoverableError, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { scanJobs } from "../../../src/db/schema.js";
import { getRedisUrl } from "../../../services/shared/src/env/index.js";
import {
  QUEUE_NAMES,
  isScanAnalysisRetryableError,
  scanJobHasAttemptsRemaining,
  setJobStatus,
} from "../../../services/shared/src/queue/index.js";
import { logger } from "../../../services/shared/src/logging/index.js";
import { publishNotification } from "../../../services/shared/src/notifications/index.js";
import { processScanJob } from "../../../src/lib/scanPipeline/processScanJob.js";
import { initWorkerSentry, Sentry } from "./sentry.js";
import { notificationWorker } from "./notificationWorker.js";

const connection = { url: getRedisUrl() };
initWorkerSentry();

const worker = new Worker(
  QUEUE_NAMES.scanAnalysis,
  async (job) => {
    const { jobId, payload } = job.data as {
      jobId: string;
      payload: Parameters<typeof processScanJob>[1];
    };
    logger.queue(QUEUE_NAMES.scanAnalysis, "processing", { jobId });
    await setJobStatus(jobId, "processing");
    try {
      const { scanId } = await processScanJob(jobId, payload, db);
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
      Sentry.captureException(err, {
        tags: { queue: QUEUE_NAMES.scanAnalysis, stage: "worker" },
        extra: { jobId, attempt: job.attemptsMade, willRetry },
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

      void publishNotification("scan.failed", payload.userId, {
        jobId,
        error: msg,
        scanName: payload.scanName ?? null,
      }).catch((e) => {
        logger.warn("scan_failed_notification_publish_error", {
          jobId,
          error: e instanceof Error ? e.message : String(e),
        });
      });
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

notificationWorker.on("ready", () => {
  logger.info("notification_worker_ready", { queue: QUEUE_NAMES.notifications });
});

worker.on("error", (err) => {
  logger.error("ml_worker_error", { error: err.message });
  Sentry.captureException(err, {
    tags: { queue: QUEUE_NAMES.scanAnalysis, stage: "worker_event" },
  });
});

process.on("SIGTERM", async () => {
  await Promise.all([worker.close(), notificationWorker.close()]);
  process.exit(0);
});
