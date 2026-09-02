/** When async jobs appear stuck, surface a failed status instead of polling forever. */

const PENDING_STALE_MS = 8 * 60 * 1000;
const PROCESSING_STALE_MS = 12 * 60 * 1000;

export function scanJobStaleMessage(
  status: string,
  updatedAt: Date | null | undefined,
  createdAt: Date | null | undefined
): string | null {
  const now = Date.now();
  if (status === "pending") {
    const since = createdAt?.getTime() ?? updatedAt?.getTime();
    if (since != null && now - since > PENDING_STALE_MS) {
      return "Scan is waiting in the queue too long. The analysis worker may be offline - try again in a minute or contact support.";
    }
  }
  if (status === "processing") {
    const since = updatedAt?.getTime() ?? createdAt?.getTime();
    if (since != null && now - since > PROCESSING_STALE_MS) {
      return "Scan analysis timed out. Try submitting again - if this keeps happening, the ML service may need a restart.";
    }
  }
  return null;
}
