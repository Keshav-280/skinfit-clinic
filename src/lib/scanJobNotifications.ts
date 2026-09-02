/** Client-side tracking for async scan jobs until report is fully ready. */

export type PendingScanJob = {
  jobId: string;
  scanName?: string;
  queuedAt: string;
};

export type ReadyScanNotification = {
  scanId: number;
  title: string;
  readyAt: string;
};

const KEY_PENDING = "skinfit.scanJobs.pending.v1";
const KEY_SEEN = "skinfit.scanJobs.seen.v1";
const KEY_READY = "skinfit.scanJobs.ready.v1";

export const SCAN_JOBS_CHANGED_EVENT = "skinfit:scan-jobs-changed";
export const SCAN_READY_CHANGED_EVENT = "skinfit:scan-ready-changed";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function dispatchChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SCAN_JOBS_CHANGED_EVENT));
  }
}

function dispatchReadyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SCAN_READY_CHANGED_EVENT));
  }
}

export function getPendingScanJobs(): PendingScanJob[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY_PENDING);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingScanJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setPendingScanJobs(items: PendingScanJob[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEY_PENDING, JSON.stringify(items));
  dispatchChanged();
}

export function addPendingScanJob(jobId: string, scanName?: string) {
  const list = getPendingScanJobs().filter((j) => j.jobId !== jobId);
  list.push({
    jobId,
    scanName: scanName?.trim() || undefined,
    queuedAt: new Date().toISOString(),
  });
  setPendingScanJobs(list);
}

export function removePendingScanJob(jobId: string) {
  setPendingScanJobs(getPendingScanJobs().filter((j) => j.jobId !== jobId));
}

export function hasSeenCompletedScan(scanId: number): boolean {
  if (!canUseStorage()) return false;
  try {
    const raw = window.localStorage.getItem(KEY_SEEN);
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    return Array.isArray(ids) && ids.includes(scanId);
  } catch {
    return false;
  }
}

export function markSeenCompletedScan(scanId: number) {
  if (!canUseStorage()) return;
  try {
    const raw = window.localStorage.getItem(KEY_SEEN);
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    const next = Array.isArray(ids) ? ids.filter((n) => Number.isFinite(n)) : [];
    if (!next.includes(scanId)) next.push(scanId);
    window.localStorage.setItem(KEY_SEEN, JSON.stringify(next.slice(-120)));
  } catch {
    // ignore
  }
}

export function getUnreadReadyScans(): ReadyScanNotification[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY_READY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReadyScanNotification[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) =>
        typeof r.scanId === "number" &&
        r.scanId > 0 &&
        typeof r.title === "string" &&
        r.title.length > 0
    );
  } catch {
    return [];
  }
}

function setUnreadReadyScans(items: ReadyScanNotification[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEY_READY, JSON.stringify(items.slice(-40)));
  dispatchReadyChanged();
}

/** Bell + notifications page - returns true if newly added. */
export function addUnreadReadyScan(
  scanId: number,
  title?: string
): boolean {
  const existing = getUnreadReadyScans();
  if (existing.some((r) => r.scanId === scanId)) return false;
  const label =
    title?.trim() || "Your full scan report is ready to view";
  setUnreadReadyScans([
    {
      scanId,
      title: label,
      readyAt: new Date().toISOString(),
    },
    ...existing,
  ]);
  return true;
}

export function dismissUnreadReadyScan(scanId: number) {
  const next = getUnreadReadyScans().filter((r) => r.scanId !== scanId);
  if (next.length === getUnreadReadyScans().length) return;
  setUnreadReadyScans(next);
  markSeenCompletedScan(scanId);
}

export function getUnreadReadyScanCount(): number {
  return getUnreadReadyScans().length;
}
