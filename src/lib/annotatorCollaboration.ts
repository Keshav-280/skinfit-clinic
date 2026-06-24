import type { AnnotatorShape } from "@/src/lib/annotatorAnnotations";

export const ANNOTATOR_SCOPE = "default";
export const ANNOTATOR_LOCK_TTL_MS = 30_000;
export const ANNOTATOR_LOCK_HEARTBEAT_MS = 10_000;

export type AnnotatorImageLock = {
  userId: string;
  userName: string;
  expiresAt: string;
};

export type AnnotatorLabelEntry = {
  spec?: string;
  grade?: string;
  score?: number;
};

export type AnnotatorCollaborationRow = {
  id?: number;
  scope?: string;
  perImageByCategory?: Record<string, Record<string, AnnotatorLabelEntry>> | null;
  annotations?: AnnotatorShape[] | null;
  perUserLabels?: Record<string, Record<string, Record<string, AnnotatorLabelEntry>>> | null;
  perUserShapes?: Record<string, AnnotatorShape[]> | null;
  imageLocks?: Record<string, AnnotatorImageLock> | null;
  userSyncAt?: Record<string, string> | null;
  shapeTombstones?: Record<string, string[]> | null;
  currentIndex?: number;
  updatedAt?: Date;
};

export type AnnotatorCollaborationStore = {
  perUserLabels: Record<string, Record<string, Record<string, AnnotatorLabelEntry>>>;
  perUserShapes: Record<string, AnnotatorShape[]>;
  imageLocks: Record<string, AnnotatorImageLock>;
  userSyncAt: Record<string, string>;
  shapeTombstones: Record<string, string[]>;
};

function emptyStore(): AnnotatorCollaborationStore {
  return {
    perUserLabels: {},
    perUserShapes: {},
    imageLocks: {},
    userSyncAt: {},
    shapeTombstones: {},
  };
}

export function parseCollaborationStore(row: AnnotatorCollaborationRow | null | undefined): AnnotatorCollaborationStore {
  const store = emptyStore();
  if (!row) return store;

  if (row.perUserLabels && typeof row.perUserLabels === "object") {
    store.perUserLabels = { ...row.perUserLabels };
  }
  if (row.perUserShapes && typeof row.perUserShapes === "object") {
    store.perUserShapes = { ...row.perUserShapes };
  }
  if (row.imageLocks && typeof row.imageLocks === "object") {
    store.imageLocks = { ...row.imageLocks };
  }
  if (row.userSyncAt && typeof row.userSyncAt === "object") {
    store.userSyncAt = { ...row.userSyncAt };
  }
  if (row.shapeTombstones && typeof row.shapeTombstones === "object") {
    store.shapeTombstones = { ...row.shapeTombstones };
  }

  const hasCollaborativeData =
    Object.keys(store.perUserShapes).length > 0 || Object.keys(store.perUserLabels).length > 0;

  if (!hasCollaborativeData && (row.annotations?.length || row.perImageByCategory)) {
    store.perUserShapes.__legacy__ = Array.isArray(row.annotations) ? row.annotations : [];
    store.perUserLabels.__legacy__ = row.perImageByCategory ?? {};
    store.userSyncAt.__legacy__ = new Date().toISOString();
  }

  return store;
}

export function pruneExpiredLocks(
  locks: Record<string, AnnotatorImageLock>,
  now = Date.now()
): Record<string, AnnotatorImageLock> {
  const out: Record<string, AnnotatorImageLock> = {};
  for (const [idx, lock] of Object.entries(locks)) {
    const exp = Date.parse(lock.expiresAt);
    if (Number.isFinite(exp) && exp > now) out[idx] = lock;
  }
  return out;
}

export function mergeSparseUserLabels(
  existing: Record<string, Record<string, AnnotatorLabelEntry>> | undefined,
  incoming: Record<string, Record<string, AnnotatorLabelEntry>> | undefined
): Record<string, Record<string, AnnotatorLabelEntry>> {
  const out = { ...(existing ?? {}) };
  if (!incoming) return out;
  for (const [imageKey, patch] of Object.entries(incoming)) {
    out[imageKey] = { ...(out[imageKey] ?? {}), ...patch };
  }
  return out;
}

export function shapesForUser(
  store: AnnotatorCollaborationStore,
  userId: string
): AnnotatorShape[] {
  return store.perUserShapes[userId] ?? [];
}

export function labelsForUser(
  store: AnnotatorCollaborationStore,
  userId: string
): Record<string, Record<string, AnnotatorLabelEntry>> {
  return store.perUserLabels[userId] ?? {};
}

export function peerShapes(
  store: AnnotatorCollaborationStore,
  userId: string
): Array<AnnotatorShape & { userId: string }> {
  const out: Array<AnnotatorShape & { userId: string }> = [];
  for (const [uid, shapes] of Object.entries(store.perUserShapes)) {
    if (uid === userId) continue;
    for (const shape of shapes) {
      out.push({ ...shape, userId: uid });
    }
  }
  return out;
}

export function allShapesMerged(
  store: AnnotatorCollaborationStore
): Array<AnnotatorShape & { userId: string }> {
  const out: Array<AnnotatorShape & { userId: string }> = [];
  for (const [uid, shapes] of Object.entries(store.perUserShapes)) {
    for (const shape of shapes) {
      out.push({ ...shape, userId: uid });
    }
  }
  return out;
}

/** Pick one label set per image for export (user with latest sync who touched that image). */
export function mergedLabelsForExport(
  store: AnnotatorCollaborationStore
): Record<string, Record<string, AnnotatorLabelEntry>> {
  const imageIndices = new Set<string>();
  for (const labels of Object.values(store.perUserLabels)) {
    for (const idx of Object.keys(labels)) imageIndices.add(idx);
  }

  const out: Record<string, Record<string, AnnotatorLabelEntry>> = {};
  for (const imageKey of imageIndices) {
    let bestUser: string | null = null;
    let bestTs = 0;
    for (const [userId, labels] of Object.entries(store.perUserLabels)) {
      if (!labels[imageKey]) continue;
      const ts = Date.parse(store.userSyncAt[userId] ?? "") || 0;
      const hasShapes = (store.perUserShapes[userId] ?? []).some(
        (s) => String(s.imageIndex) === imageKey
      );
      const score = ts + (hasShapes ? 1 : 0);
      if (score >= bestTs) {
        bestTs = score;
        bestUser = userId;
      }
    }
    if (bestUser) {
      out[imageKey] = { ...store.perUserLabels[bestUser]![imageKey] };
    }
  }
  return out;
}

export function acquireImageLock(
  store: AnnotatorCollaborationStore,
  imageIndex: number,
  user: { id: string; name: string },
  now = Date.now()
): { store: AnnotatorCollaborationStore; lock: AnnotatorImageLock; conflict: AnnotatorImageLock | null } {
  const key = String(imageIndex);
  const locks = pruneExpiredLocks(store.imageLocks, now);
  const existing = locks[key];
  if (existing && existing.userId !== user.id) {
    return { store: { ...store, imageLocks: locks }, lock: existing, conflict: existing };
  }
  const lock: AnnotatorImageLock = {
    userId: user.id,
    userName: user.name,
    expiresAt: new Date(now + ANNOTATOR_LOCK_TTL_MS).toISOString(),
  };
  return {
    store: { ...store, imageLocks: { ...locks, [key]: lock } },
    lock,
    conflict: null,
  };
}

export function releaseImageLock(
  store: AnnotatorCollaborationStore,
  imageIndex: number,
  userId: string
): AnnotatorCollaborationStore {
  const key = String(imageIndex);
  const locks = pruneExpiredLocks(store.imageLocks);
  const existing = locks[key];
  if (!existing || existing.userId !== userId) {
    return { ...store, imageLocks: locks };
  }
  const next = { ...locks };
  delete next[key];
  return { ...store, imageLocks: next };
}

export function heartbeatImageLock(
  store: AnnotatorCollaborationStore,
  imageIndex: number,
  userId: string,
  now = Date.now()
): AnnotatorCollaborationStore {
  const key = String(imageIndex);
  const locks = pruneExpiredLocks(store.imageLocks, now);
  const existing = locks[key];
  if (!existing || existing.userId !== userId) {
    return { ...store, imageLocks: locks };
  }
  return {
    ...store,
    imageLocks: {
      ...locks,
      [key]: {
        ...existing,
        expiresAt: new Date(now + ANNOTATOR_LOCK_TTL_MS).toISOString(),
      },
    },
  };
}

export function tombstoneSetForUser(
  store: AnnotatorCollaborationStore,
  userId: string
): Set<string> {
  return new Set(store.shapeTombstones[userId] ?? []);
}

export function addShapeTombstone(
  store: AnnotatorCollaborationStore,
  userId: string,
  shapeId: string
): AnnotatorCollaborationStore {
  const existing = store.shapeTombstones[userId] ?? [];
  if (existing.includes(shapeId)) return store;
  return {
    ...store,
    shapeTombstones: {
      ...store.shapeTombstones,
      [userId]: [...existing, shapeId],
    },
  };
}

function filterTombstonedShapes(
  store: AnnotatorCollaborationStore,
  userId: string,
  shapes: AnnotatorShape[]
): AnnotatorShape[] {
  const tombstones = tombstoneSetForUser(store, userId);
  if (tombstones.size === 0) return shapes;
  return shapes.filter((s) => !tombstones.has(s.id));
}

/** Merge client shapes when server was updated after the client's last sync (e.g. admin delete). */
export function mergeShapesWhenServerNewer(
  server: AnnotatorShape[],
  incoming: AnnotatorShape[]
): AnnotatorShape[] {
  const byId = new Map(server.map((s) => [s.id, s]));
  for (const shape of incoming) {
    byId.set(shape.id, shape);
  }
  return [...byId.values()];
}

export function applyUserSync(
  store: AnnotatorCollaborationStore,
  userId: string,
  payload: {
    perImageByCategory?: Record<string, Record<string, AnnotatorLabelEntry>>;
    annotations?: AnnotatorShape[];
    /** Allow clearing this user's shapes to empty. Without it, an empty array
     * never overwrites existing non-empty shapes (guards against bad loads /
     * stale tabs silently wiping saved annotations). */
    allowEmptyAnnotations?: boolean;
    /** Client's last known server sync time for this user (ISO). */
    clientSyncedAt?: string;
  },
  syncedAt = new Date().toISOString()
): AnnotatorCollaborationStore {
  const next = { ...store };
  if (payload.annotations) {
    const existing = next.perUserShapes[userId] ?? [];
    let incoming = filterTombstonedShapes(next, userId, payload.annotations);

    const clientTs = payload.clientSyncedAt ? Date.parse(payload.clientSyncedAt) : Number.NaN;
    const serverTs = Date.parse(next.userSyncAt[userId] ?? "") || 0;
    const serverNewer =
      typeof payload.clientSyncedAt === "string" &&
      Number.isFinite(clientTs) &&
      serverTs > clientTs;

    if (serverNewer) {
      incoming = filterTombstonedShapes(next, userId, incoming);
      next.perUserShapes = {
        ...next.perUserShapes,
        [userId]: mergeShapesWhenServerNewer(existing, incoming),
      };
    } else {
      const wouldClearNonEmpty = incoming.length === 0 && existing.length > 0;
      if (!wouldClearNonEmpty || payload.allowEmptyAnnotations) {
        next.perUserShapes = { ...next.perUserShapes, [userId]: incoming };
      }
    }
  }
  if (payload.perImageByCategory) {
    next.perUserLabels = {
      ...next.perUserLabels,
      [userId]: mergeSparseUserLabels(next.perUserLabels[userId], payload.perImageByCategory),
    };
  }
  next.userSyncAt = { ...next.userSyncAt, [userId]: syncedAt };
  return next;
}

/** Remove one shape from a collaborator's bucket (annotator admin action). */
export function deleteShapeFromUser(
  store: AnnotatorCollaborationStore,
  ownerUserId: string,
  shapeId: string,
  syncedAt = new Date().toISOString()
): AnnotatorCollaborationStore {
  const shapes = store.perUserShapes[ownerUserId];
  if (!shapes?.length) return store;
  const filtered = shapes.filter((s) => s.id !== shapeId);
  if (filtered.length === shapes.length) return store;
  const withTombstone = addShapeTombstone(
    {
      ...store,
      perUserShapes: { ...store.perUserShapes, [ownerUserId]: filtered },
      userSyncAt: { ...store.userSyncAt, [ownerUserId]: syncedAt },
    },
    ownerUserId,
    shapeId
  );
  return withTombstone;
}

export function clearCollaborationStore(): AnnotatorCollaborationStore {
  return emptyStore();
}

export function storeToDbColumns(store: AnnotatorCollaborationStore) {
  return {
    perUserLabels: store.perUserLabels,
    perUserShapes: store.perUserShapes,
    imageLocks: store.imageLocks,
    userSyncAt: store.userSyncAt,
    shapeTombstones: store.shapeTombstones,
    updatedAt: new Date(),
  };
}
