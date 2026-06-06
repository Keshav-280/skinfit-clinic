const STORAGE_KEY = "skinfit-schedule-archived-v1";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

function writeSet(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function loadScheduleListArchivedIds(): Set<string> {
  return readSet();
}

export function archiveScheduleListItem(eventId: string): Set<string> {
  const next = readSet();
  next.add(eventId);
  writeSet(next);
  return next;
}

export function unarchiveScheduleListItem(eventId: string): Set<string> {
  const next = readSet();
  next.delete(eventId);
  writeSet(next);
  return next;
}

export function unarchiveScheduleListItems(eventIds: string[]): Set<string> {
  const next = readSet();
  for (const id of eventIds) next.delete(id);
  writeSet(next);
  return next;
}
