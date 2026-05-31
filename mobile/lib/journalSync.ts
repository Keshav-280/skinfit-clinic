export type JournalSyncPatch = {
  date: string;
  sleepHours?: number;
  stressLevel?: number;
  waterGlasses?: number;
};

type JournalSyncListener = (patch: JournalSyncPatch) => void;

const listeners = new Set<JournalSyncListener>();

export function emitJournalUpdated(patch: JournalSyncPatch) {
  for (const listener of listeners) {
    listener(patch);
  }
}

export function subscribeJournalUpdated(listener: JournalSyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
