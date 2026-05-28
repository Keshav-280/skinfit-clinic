import { Queue } from "bullmq";
import { getRedisUrl } from "../env/index";

const connection = { url: getRedisUrl() };

export const QUEUE_NAMES = {
  scanAnalysis: "scan-analysis",
  notifications: "notifications",
  reportGeneration: "report-generation",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

let scanQueue: Queue | null = null;
let notificationQueue: Queue | null = null;
let reportQueue: Queue | null = null;

export function getScanAnalysisQueue(): Queue {
  if (!scanQueue) {
    scanQueue = new Queue(QUEUE_NAMES.scanAnalysis, { connection });
  }
  return scanQueue;
}

export function getNotificationQueue(): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue(QUEUE_NAMES.notifications, { connection });
  }
  return notificationQueue;
}

export function getReportGenerationQueue(): Queue {
  if (!reportQueue) {
    reportQueue = new Queue(QUEUE_NAMES.reportGeneration, { connection });
  }
  return reportQueue;
}
