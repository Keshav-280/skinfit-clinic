export type JournalSyncPatch = {
  date: string;
  sleepHours?: number;
  stressLevel?: number;
  waterGlasses?: number;
};

type JournalSyncListener = (patch: JournalSyncPatch) => void;

const listeners = new Set<JournalSyncListener>();

/** Latest optimistic tracker patch — survives dashboard remounts until server confirms. */
let lastJournalPatch: JournalSyncPatch | null = null;

export function peekJournalSyncPatch(date: string): JournalSyncPatch | null {
  if (!lastJournalPatch || lastJournalPatch.date !== date) return null;
  return lastJournalPatch;
}

export function clearJournalSyncPatch(date: string): void {
  if (lastJournalPatch?.date === date) lastJournalPatch = null;
}

function mergeJournalSyncPatch(patch: JournalSyncPatch): JournalSyncPatch {
  if (lastJournalPatch?.date === patch.date) {
    lastJournalPatch = { ...lastJournalPatch, ...patch };
  } else {
    lastJournalPatch = patch;
  }
  return lastJournalPatch;
}

export function emitJournalUpdated(patch: JournalSyncPatch) {
  const merged = mergeJournalSyncPatch(patch);
  // Defer so subscribers (e.g. dashboard journal fields) never setState during
  // another screen's render/update cycle (tracker optimistic sync).
  queueMicrotask(() => {
    for (const listener of listeners) {
      listener(merged);
    }
  });
}

export function subscribeJournalUpdated(listener: JournalSyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
