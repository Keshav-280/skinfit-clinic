import AsyncStorage from "@react-native-async-storage/async-storage";

/** Same key as web `src/lib/scheduleListArchive.ts` — device-local hide from schedule list. */
const STORAGE_KEY = "skinfit-schedule-archived-v1";

async function readSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

async function writeSet(ids: Set<string>) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export async function loadScheduleListArchivedIds(): Promise<Set<string>> {
  return readSet();
}

export async function archiveScheduleListItem(eventId: string): Promise<Set<string>> {
  const next = await readSet();
  next.add(eventId);
  await writeSet(next);
  return next;
}

export async function unarchiveScheduleListItem(eventId: string): Promise<Set<string>> {
  const next = await readSet();
  next.delete(eventId);
  await writeSet(next);
  return next;
}

export async function unarchiveScheduleListItems(eventIds: string[]): Promise<Set<string>> {
  const next = await readSet();
  for (const id of eventIds) next.delete(id);
  await writeSet(next);
  return next;
}
