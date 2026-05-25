import AsyncStorage from "@react-native-async-storage/async-storage";

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

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeScanJobNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  for (const l of listeners) l();
}

export async function getPendingScanJobs(): Promise<PendingScanJob[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PENDING);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingScanJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setPendingScanJobs(items: PendingScanJob[]) {
  await AsyncStorage.setItem(KEY_PENDING, JSON.stringify(items));
  notifyListeners();
}

export async function addPendingScanJob(jobId: string, scanName?: string) {
  const list = (await getPendingScanJobs()).filter((j) => j.jobId !== jobId);
  list.push({
    jobId,
    scanName: scanName?.trim() || undefined,
    queuedAt: new Date().toISOString(),
  });
  await setPendingScanJobs(list);
}

export async function removePendingScanJob(jobId: string) {
  await setPendingScanJobs(
    (await getPendingScanJobs()).filter((j) => j.jobId !== jobId)
  );
}

export async function hasSeenCompletedScan(scanId: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SEEN);
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    return Array.isArray(ids) && ids.includes(scanId);
  } catch {
    return false;
  }
}

export async function markSeenCompletedScan(scanId: number) {
  try {
    const raw = await AsyncStorage.getItem(KEY_SEEN);
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    const next = Array.isArray(ids) ? ids.filter((n) => Number.isFinite(n)) : [];
    if (!next.includes(scanId)) next.push(scanId);
    await AsyncStorage.setItem(KEY_SEEN, JSON.stringify(next.slice(-120)));
  } catch {
    // ignore
  }
}

export async function getUnreadReadyScans(): Promise<ReadyScanNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_READY);
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

async function setUnreadReadyScans(items: ReadyScanNotification[]) {
  await AsyncStorage.setItem(KEY_READY, JSON.stringify(items.slice(-40)));
  notifyListeners();
}

export async function addUnreadReadyScan(
  scanId: number,
  title?: string
): Promise<boolean> {
  const existing = await getUnreadReadyScans();
  if (existing.some((r) => r.scanId === scanId)) return false;
  const label =
    title?.trim() || "Your full scan report is ready to view";
  await setUnreadReadyScans([
    { scanId, title: label, readyAt: new Date().toISOString() },
    ...existing,
  ]);
  return true;
}

export async function dismissUnreadReadyScan(scanId: number) {
  const existing = await getUnreadReadyScans();
  const next = existing.filter((r) => r.scanId !== scanId);
  if (next.length === existing.length) return;
  await setUnreadReadyScans(next);
  await markSeenCompletedScan(scanId);
}

export async function getUnreadReadyScanCount(): Promise<number> {
  return (await getUnreadReadyScans()).length;
}
