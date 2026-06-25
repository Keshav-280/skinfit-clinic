import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { annotatorState } from "@/src/db/schema";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";
import { getSessionUserProfileFromRequest } from "@/src/lib/auth/get-session";
import {
  ANNOTATOR_SCOPE,
  allShapesMerged,
  applyUserSync,
  clearCollaborationStore,
  deleteShapeFromUser,
  labelsForUser,
  mergedLabelsForExport,
  mergedLabelsFromCollaborationData,
  parseCollaborationStore,
  peerShapesForImage,
  peerImageIndices,
  pruneExpiredLocks,
  shapesForUser,
  storeToDbColumns,
} from "@/src/lib/annotatorCollaboration";
import { isAnnotatorAdminEmail } from "@/src/lib/annotatorAdmins";
import { allowAnnotatorHeavyGet } from "@/src/lib/annotatorRateLimit";
import type { AnnotatorShape } from "@/src/lib/annotatorAnnotations";

type AnnotationShape = {
  id: string;
  imageIndex: number;
  category: string;
  spec: string;
  severity: string;
  color: string;
  type: "path" | "line";
  points: Array<{ x: number; y: number }>;
};

type PerImageByCategoryShape = Record<
  string,
  Record<string, { spec?: string; grade?: string; score?: number }>
>;

async function loadCollaborationRow() {
  const [row] = await db
    .select({
      id: annotatorState.id,
      scope: annotatorState.scope,
      perImageByCategory: annotatorState.perImageByCategory,
      annotations: annotatorState.annotations,
      perUserLabels: annotatorState.perUserLabels,
      perUserShapes: annotatorState.perUserShapes,
      imageLocks: annotatorState.imageLocks,
      userSyncAt: annotatorState.userSyncAt,
      shapeTombstones: annotatorState.shapeTombstones,
      updatedAt: annotatorState.updatedAt,
    })
    .from(annotatorState)
    .where(eq(annotatorState.scope, ANNOTATOR_SCOPE))
    .limit(1);
  return row ?? null;
}

/** Lightweight row for background polls — avoids loading ~80MB of shape JSON. */
async function loadCollaborationSyncRow() {
  const [row] = await db
    .select({
      imageLocks: annotatorState.imageLocks,
      userSyncAt: annotatorState.userSyncAt,
      updatedAt: annotatorState.updatedAt,
    })
    .from(annotatorState)
    .where(eq(annotatorState.scope, ANNOTATOR_SCOPE))
    .limit(1);
  return row ?? null;
}

async function loadCollaborationPeersRow() {
  const [row] = await db
    .select({
      perUserShapes: annotatorState.perUserShapes,
      shapeTombstones: annotatorState.shapeTombstones,
      userSyncAt: annotatorState.userSyncAt,
    })
    .from(annotatorState)
    .where(eq(annotatorState.scope, ANNOTATOR_SCOPE))
    .limit(1);
  return row ?? null;
}

type PeerShapeSqlRow = {
  user_id: string;
  shape: AnnotatorShape;
};

/** Peer shapes for one image — filtered in Postgres, never loads the full per_user_shapes blob into Node. */
async function loadPeerShapesForImageFromDb(userId: string, imageIndex: number) {
  const result = await db.execute<PeerShapeSqlRow>(sql`
    SELECT
      u.key AS user_id,
      shape AS shape
    FROM annotator_state s,
         jsonb_each(s.per_user_shapes) AS u(key, shapes),
         jsonb_array_elements(u.shapes) AS shape
    WHERE s.scope = ${ANNOTATOR_SCOPE}
      AND u.key <> ${userId}
      AND (shape->>'imageIndex')::int = ${imageIndex}
  `);
  return (result.rows ?? []).map((row) => ({
    ...row.shape,
    userId: row.user_id,
  }));
}

/** Distinct peer image indices — DB-side scan, no multi-MB json transfer to Node. */
async function loadPeerImageIndicesFromDb(userId: string): Promise<number[]> {
  const result = await db.execute<{ image_index: number }>(sql`
    SELECT DISTINCT (shape->>'imageIndex')::int AS image_index
    FROM annotator_state s,
         jsonb_each(s.per_user_shapes) AS u(key, shapes),
         jsonb_array_elements(u.shapes) AS shape
    WHERE s.scope = ${ANNOTATOR_SCOPE}
      AND u.key <> ${userId}
      AND (shape->>'imageIndex') ~ '^[0-9]+$'
    ORDER BY image_index
  `);
  return (result.rows ?? [])
    .map((row) => row.image_index)
    .filter((n) => Number.isFinite(n));
}

type UserSliceRow = {
  image_locks: Record<string, { userId: string; userName: string; expiresAt: string }> | null;
  user_sync_at: Record<string, string> | null;
  updated_at: Date | null;
  user_labels: Record<string, Record<string, { spec?: string; grade?: string }>> | null;
  user_shapes: AnnotatorShape[] | null;
  user_tombstones: string[] | null;
};

type UserLabelsSliceRow = {
  image_locks: Record<string, { userId: string; userName: string; expiresAt: string }> | null;
  user_sync_at: Record<string, string> | null;
  updated_at: Date | null;
  user_labels: Record<string, Record<string, { spec?: string; grade?: string }>> | null;
};

/** Read only one user's slice — avoids loading the full ~80MB perUserShapes blob. */
async function loadCollaborationUserRow(userId: string) {
  const result = await db.execute<UserSliceRow>(sql`
    SELECT
      image_locks,
      user_sync_at,
      updated_at,
      per_user_labels->${userId} AS user_labels,
      per_user_shapes->${userId} AS user_shapes,
      shape_tombstones->${userId} AS user_tombstones
    FROM annotator_state
    WHERE scope = ${ANNOTATOR_SCOPE}
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

/** Labels + locks only — fast first paint (no shape JSON). */
async function loadCollaborationUserLabelsRow(userId: string) {
  const result = await db.execute<UserLabelsSliceRow>(sql`
    SELECT
      image_locks,
      user_sync_at,
      updated_at,
      per_user_labels->${userId} AS user_labels
    FROM annotator_state
    WHERE scope = ${ANNOTATOR_SCOPE}
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

function storeFromUserSlice(row: UserSliceRow | null, userId: string) {
  return parseCollaborationStore({
    perUserLabels: row?.user_labels ? { [userId]: row.user_labels } : {},
    perUserShapes: row?.user_shapes ? { [userId]: row.user_shapes } : {},
    imageLocks: row?.image_locks ?? {},
    userSyncAt: row?.user_sync_at ?? {},
    shapeTombstones: row?.user_tombstones ? { [userId]: row.user_tombstones } : {},
    updatedAt: row?.updated_at ?? undefined,
  });
}

function heavyGetDenied(req: Request) {
  return NextResponse.json(
    { error: "RATE_LIMITED", retryAfterSec: 5 },
    { status: 429, headers: { "Retry-After": "5", "Cache-Control": "no-store" } }
  );
}

function peerSyncAtForUser(
  userSyncAt: Record<string, string> | null | undefined,
  userId: string
): Record<string, string> {
  if (!userSyncAt || typeof userSyncAt !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, ts] of Object.entries(userSyncAt)) {
    if (id !== userId && typeof ts === "string" && ts) out[id] = ts;
  }
  return out;
}

/** Merged annotator grades for admin review — labels + sync only, no shape JSON transfer. */
async function loadMergedLabelsForAdmin() {
  const [labelsRow] = await db.execute<{
    per_user_labels: Record<
      string,
      Record<string, Record<string, { spec?: string; grade?: string; score?: number }>>
    > | null;
    user_sync_at: Record<string, string> | null;
  }>(sql`
    SELECT per_user_labels, user_sync_at
    FROM annotator_state
    WHERE scope = ${ANNOTATOR_SCOPE}
    LIMIT 1
  `);

  const indicesResult = await db.execute<{ user_id: string; image_index: number }>(sql`
    SELECT u.key AS user_id, (shape->>'imageIndex')::int AS image_index
    FROM annotator_state s,
         jsonb_each(s.per_user_shapes) AS u(key, shapes),
         jsonb_array_elements(u.shapes) AS shape
    WHERE s.scope = ${ANNOTATOR_SCOPE}
      AND (shape->>'imageIndex') ~ '^[0-9]+$'
  `);

  const shapeIndicesByUser = new Map<string, Set<string>>();
  for (const row of indicesResult.rows ?? []) {
    if (!row.user_id || !Number.isFinite(row.image_index)) continue;
    let set = shapeIndicesByUser.get(row.user_id);
    if (!set) {
      set = new Set();
      shapeIndicesByUser.set(row.user_id, set);
    }
    set.add(String(row.image_index));
  }

  return mergedLabelsFromCollaborationData(
    labelsRow?.per_user_labels ?? {},
    labelsRow?.user_sync_at ?? {},
    (userId, imageKey) => shapeIndicesByUser.get(userId)?.has(imageKey) ?? false
  );
}

async function persistCollaborationStore(
  store: ReturnType<typeof parseCollaborationStore>
) {
  const data = storeToDbColumns(store);
  const [existing] = await db
    .select({ id: annotatorState.id })
    .from(annotatorState)
    .where(eq(annotatorState.scope, ANNOTATOR_SCOPE))
    .limit(1);

  if (existing) {
    await db
      .update(annotatorState)
      .set({
        ...data,
        perImageByCategory: {},
        annotations: [],
      })
      .where(eq(annotatorState.id, existing.id));
  } else {
    await db.insert(annotatorState).values({
      scope: ANNOTATOR_SCOPE,
      perImageByCategory: {},
      annotations: [],
      currentIndex: 0,
      ...data,
    });
  }
}

/**
 * Persist ONLY one user's slice via a jsonb_set upsert.
 *
 * The previous save path loaded the full ~5MB row into Node, parsed it (blocking
 * the single event loop — the OOM stack traces were inside V8's JSON parser),
 * mutated one user's slice, then serialized and wrote the whole row back. That
 * was a top crash driver AND a lost-update race: two users saving concurrently
 * each wrote a full row, so the second writer clobbered the first user's slice
 * with its own stale copy. Writing only `ARRAY[userId]` keys means concurrent
 * saves touch disjoint jsonb paths and can no longer overwrite each other.
 */
async function persistUserSlice(
  userId: string,
  store: ReturnType<typeof parseCollaborationStore>
) {
  const shapes = JSON.stringify(store.perUserShapes[userId] ?? []);
  const labels = JSON.stringify(store.perUserLabels[userId] ?? {});
  const syncAt = JSON.stringify(store.userSyncAt[userId] ?? null);
  const tombstones = JSON.stringify(store.shapeTombstones[userId] ?? []);

  await db.execute(sql`
    INSERT INTO annotator_state (scope, per_user_shapes, per_user_labels, user_sync_at, shape_tombstones)
    VALUES (
      ${ANNOTATOR_SCOPE},
      jsonb_build_object(${userId}::text, ${shapes}::jsonb),
      jsonb_build_object(${userId}::text, ${labels}::jsonb),
      jsonb_build_object(${userId}::text, ${syncAt}::jsonb),
      jsonb_build_object(${userId}::text, ${tombstones}::jsonb)
    )
    ON CONFLICT (scope) DO UPDATE SET
      per_user_shapes = jsonb_set(coalesce(annotator_state.per_user_shapes, '{}'::jsonb), ARRAY[${userId}]::text[], ${shapes}::jsonb, true),
      per_user_labels = jsonb_set(coalesce(annotator_state.per_user_labels, '{}'::jsonb), ARRAY[${userId}]::text[], ${labels}::jsonb, true),
      user_sync_at = jsonb_set(coalesce(annotator_state.user_sync_at, '{}'::jsonb), ARRAY[${userId}]::text[], ${syncAt}::jsonb, true),
      shape_tombstones = jsonb_set(coalesce(annotator_state.shape_tombstones, '{}'::jsonb), ARRAY[${userId}]::text[], ${tombstones}::jsonb, true),
      updated_at = now()
  `);
}

export async function GET(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const profile = await getSessionUserProfileFromRequest(req);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAnnotatorAdmin = isAnnotatorAdminEmail(profile.email);

  const url = new URL(req.url);
  const merged = url.searchParams.get("merged") === "1";
  const syncOnly = url.searchParams.get("sync") === "1";
  const peersOnly = url.searchParams.get("peers") === "1";
  const hydrateOnly = url.searchParams.get("hydrate") === "1";
  const imageIndexRaw = url.searchParams.get("imageIndex");
  const imageIndexParam =
    imageIndexRaw !== null && Number.isFinite(Number.parseInt(imageIndexRaw, 10))
      ? Number.parseInt(imageIndexRaw, 10)
      : null;

  if (syncOnly) {
    const row = await loadCollaborationSyncRow();
    const userSyncAt =
      row?.userSyncAt && typeof row.userSyncAt === "object" ? row.userSyncAt : {};
    const imageLocks = pruneExpiredLocks(
      row?.imageLocks && typeof row.imageLocks === "object" ? row.imageLocks : {}
    );
    return NextResponse.json({
      success: true,
      state: {
        imageLocks,
        userSyncedAt: userSyncAt[profile.id] ?? null,
        updatedAt: row?.updatedAt ?? null,
        peerSyncAt: peerSyncAtForUser(userSyncAt, profile.id),
      },
    });
  }

  if (hydrateOnly) {
    const row = await loadCollaborationUserLabelsRow(profile.id);
    const imageLocks = pruneExpiredLocks(
      row?.image_locks && typeof row.image_locks === "object" ? row.image_locks : {}
    );
    const userSyncAt =
      row?.user_sync_at && typeof row.user_sync_at === "object" ? row.user_sync_at : {};
    const mergedPerImageByCategory = isAnnotatorAdmin
      ? await loadMergedLabelsForAdmin()
      : undefined;
    return NextResponse.json({
      success: true,
      state: {
        perImageByCategory: row?.user_labels ?? {},
        ...(mergedPerImageByCategory ? { mergedPerImageByCategory } : {}),
        annotations: [],
        imageLocks,
        peerAnnotations: [],
        peerImageIndices: [],
        currentUser: {
          id: profile.id,
          name: profile.name,
          isAnnotatorAdmin,
        },
        userSyncedAt: userSyncAt[profile.id] ?? null,
        updatedAt: row?.updated_at ?? null,
      },
    });
  }

  if (peersOnly) {
    const indicesOnly = url.searchParams.get("peerIndices") === "1";

    if (indicesOnly) {
      const syncRow = await loadCollaborationSyncRow();
      const userSyncAt =
        syncRow?.userSyncAt && typeof syncRow.userSyncAt === "object"
          ? syncRow.userSyncAt
          : {};
      return NextResponse.json({
        success: true,
        state: {
          peerAnnotations: [],
          peerImageIndices: await loadPeerImageIndicesFromDb(profile.id),
          peerSyncAt: peerSyncAtForUser(userSyncAt, profile.id),
        },
      });
    }

    // Stale tabs without imageIndex: instant empty response, no DB shape load.
    if (imageIndexParam === null) {
      const row = await loadCollaborationSyncRow();
      const userSyncAt =
        row?.userSyncAt && typeof row.userSyncAt === "object" ? row.userSyncAt : {};
      return NextResponse.json({
        success: true,
        state: {
          peerAnnotations: [],
          peerImageIndices: [],
          peerSyncAt: peerSyncAtForUser(userSyncAt, profile.id),
        },
      });
    }

    // Key by user (not IP): all annotators share one office IP, so IP-keying
    // made colleagues throttle each other into 429 storms.
    const rateKey = `${profile.id}:peers`;
    if (!allowAnnotatorHeavyGet(rateKey, 30)) return heavyGetDenied(req);

    const syncRow = await loadCollaborationSyncRow();
    const userSyncAt =
      syncRow?.userSyncAt && typeof syncRow.userSyncAt === "object"
        ? syncRow.userSyncAt
        : {};
    const peerAnnotations = await loadPeerShapesForImageFromDb(
      profile.id,
      imageIndexParam
    );
    return NextResponse.json({
      success: true,
      state: {
        peerAnnotations,
        peerSyncAt: peerSyncAtForUser(userSyncAt, profile.id),
      },
    });
  }

  if (merged) {
    const row = await loadCollaborationRow();
    let store = parseCollaborationStore(row as Parameters<typeof parseCollaborationStore>[0]);
    store = { ...store, imageLocks: pruneExpiredLocks(store.imageLocks) };
    return NextResponse.json({
      success: true,
      state: {
        perImageByCategory: mergedLabelsForExport(store),
        annotations: allShapesMerged(store),
        imageLocks: store.imageLocks,
        collaborators: Object.keys(store.perUserShapes).filter((id) => id !== profile.id),
      },
    });
  }

  // Default GET: user slice only (cheap). Peers loaded only when imageIndex is set.
  const userRow = await loadCollaborationUserRow(profile.id);
  const userStore = storeFromUserSlice(userRow, profile.id);
  const imageLocks = pruneExpiredLocks(userStore.imageLocks);

  let peerAnnotations: ReturnType<typeof peerShapesForImage> = [];
  let peerIndices: number[] = [];

  if (imageIndexParam !== null) {
    const rateKey = `${profile.id}:state`;
    if (!allowAnnotatorHeavyGet(rateKey, 30)) return heavyGetDenied(req);

    const [peers, indices] = await Promise.all([
      loadPeerShapesForImageFromDb(profile.id, imageIndexParam),
      loadPeerImageIndicesFromDb(profile.id),
    ]);
    peerAnnotations = peers;
    peerIndices = indices;
  }

  const mergedPerImageByCategory = isAnnotatorAdmin
    ? await loadMergedLabelsForAdmin()
    : undefined;

  return NextResponse.json({
    success: true,
    state: {
      perImageByCategory: labelsForUser(userStore, profile.id),
      ...(mergedPerImageByCategory ? { mergedPerImageByCategory } : {}),
      annotations: shapesForUser(userStore, profile.id),
      imageLocks,
      peerAnnotations,
      peerImageIndices: peerIndices,
      currentUser: {
        id: profile.id,
        name: profile.name,
        isAnnotatorAdmin,
      },
      userSyncedAt: userStore.userSyncAt[profile.id] ?? null,
      updatedAt: userRow?.updated_at ?? null,
    },
  });
}

export async function PUT(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const profile = await getSessionUserProfileFromRequest(req);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        perImageByCategory?: PerImageByCategoryShape;
        annotations?: AnnotationShape[];
        allowEmptyAnnotations?: boolean;
        clearAll?: boolean;
        deletePeerShape?: { shapeId: string; ownerUserId: string };
        imageIndex?: number;
        clientSyncedAt?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
  }

  if (body.clearAll) {
    if (!isAnnotatorAdminEmail(profile.email)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    await persistCollaborationStore(clearCollaborationStore());
    return NextResponse.json({ success: true });
  }

  if (body.deletePeerShape) {
    // Admin-only, rare: full-row read is acceptable here (needs the peer's
    // shapes + all peers' indices for the response), but the WRITE is scoped to
    // the owner's key so it can't clobber a concurrent save by another user.
    if (!isAnnotatorAdminEmail(profile.email)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const { shapeId, ownerUserId } = body.deletePeerShape;
    if (
      typeof shapeId !== "string" ||
      !shapeId ||
      typeof ownerUserId !== "string" ||
      !ownerUserId ||
      ownerUserId === profile.id
    ) {
      return NextResponse.json({ error: "INVALID_DELETE_PEER_SHAPE" }, { status: 400 });
    }
    const row = await loadCollaborationRow();
    let store = parseCollaborationStore(row as Parameters<typeof parseCollaborationStore>[0]);
    store = { ...store, imageLocks: pruneExpiredLocks(store.imageLocks) };
    store = deleteShapeFromUser(store, ownerUserId, shapeId);
    await persistUserSlice(ownerUserId, store);
    const peerAnnotations =
      typeof body.imageIndex === "number"
        ? peerShapesForImage(store, profile.id, body.imageIndex)
        : [];
    return NextResponse.json({
      success: true,
      imageLocks: store.imageLocks,
      peerAnnotations,
      peerImageIndices: peerImageIndices(store, profile.id),
    });
  }

  // Hot save path: read + write ONLY this user's slice (no full-row load/parse).
  const userRow = await loadCollaborationUserRow(profile.id);
  let store = storeFromUserSlice(userRow, profile.id);
  store = applyUserSync(store, profile.id, {
    perImageByCategory: body.perImageByCategory,
    annotations: body.annotations as Parameters<typeof applyUserSync>[2]["annotations"],
    allowEmptyAnnotations: body.allowEmptyAnnotations === true,
    clientSyncedAt:
      typeof body.clientSyncedAt === "string" ? body.clientSyncedAt : undefined,
  });

  await persistUserSlice(profile.id, store);

  const imageLocks = pruneExpiredLocks(
    userRow?.image_locks && typeof userRow.image_locks === "object"
      ? userRow.image_locks
      : {}
  );

  return NextResponse.json({
    success: true,
    imageLocks,
    userSyncedAt: store.userSyncAt[profile.id] ?? null,
  });
}
