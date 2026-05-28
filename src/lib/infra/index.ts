/**
 * Infrastructure layer — re-exported for Next.js API routes and workers.
 * Source of truth: services/shared (local-first, cloud-ready abstractions).
 */

export {
  getStorage,
  createPresignedUpload,
  assertSafeStoragePath,
  type StorageProvider,
  type PresignedUpload,
} from "../../../services/shared/src/storage/index";
export {
  getCache,
  cacheAside,
  CacheKeys,
  invalidateUserProfileCache,
  invalidateUserHomeCache,
} from "../../../services/shared/src/cache/index";
export {
  getScanAnalysisQueue,
  getJobStatus,
  setJobStatus,
  QUEUE_NAMES,
  SCAN_ANALYSIS_QUEUE_JOB_OPTS,
} from "../../../services/shared/src/queue/index";
export {
  publishNotification,
  onNotification,
} from "../../../services/shared/src/notifications/index";
export { logger } from "../../../services/shared/src/logging/index";
export {
  getDatabaseUrl,
  getRedisUrl,
  getStorageRoot,
  isAsyncScanEnabled,
  getPublicUploadBaseUrl,
} from "../../../services/shared/src/env/index";
export type {
  JobStatus,
  ScanJobPayload,
  ScanCaptureImageRef,
  StorageObjectKind,
} from "../../../services/shared/src/types/index";
