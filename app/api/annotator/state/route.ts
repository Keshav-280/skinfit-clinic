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
  parseCollaborationStore,
  peerShapesForImage,
  peerImageIndices,
  pruneExpiredLocks,
  shapesForUser,
  storeToDbColumns,
} from "@/src/lib/annotatorCollaboration";
import { isAnnotatorAdminEmail } from "@/src/lib/annotatorAdmins";
import { allowAnnotatorHeavyGet, annotatorClientIp } from "@/src/lib/annotatorRateLimit";

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

type UserSliceRow = {
  image_locks: Record<string, { userId: string; userName: string; expiresAt: string }> | null;
  user_sync_at: Record<string, string> | null;
  updated_at: Date | null;
  user_labels: Record<string, Record<string, { spec?: string; grade?: string }>> | null;
  user_shapes: AnnotationShape[] | null;
  user_tombstones: string[] | null;
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

  if (peersOnly) {
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

    const rateKey = `${annotatorClientIp(req)}:peers`;
    if (!allowAnnotatorHeavyGet(rateKey, 12)) return heavyGetDenied(req);

    const row = await loadCollaborationPeersRow();
    let store = parseCollaborationStore(row as Parameters<typeof parseCollaborationStore>[0]);
    store = { ...store, imageLocks: pruneExpiredLocks(store.imageLocks) };
    const peerAnnotations = peerShapesForImage(store, profile.id, imageIndexParam);
    return NextResponse.json({
      success: true,
      state: {
        peerAnnotations,
        peerImageIndices: peerImageIndices(store, profile.id),
        peerSyncAt: peerSyncAtForUser(store.userSyncAt, profile.id),
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
    const rateKey = `${annotatorClientIp(req)}:state`;
    if (!allowAnnotatorHeavyGet(rateKey, 12)) return heavyGetDenied(req);

    const peersRow = await loadCollaborationPeersRow();
    const peerStore = parseCollaborationStore(
      peersRow as Parameters<typeof parseCollaborationStore>[0]
    );
    peerAnnotations = peerShapesForImage(peerStore, profile.id, imageIndexParam);
    peerIndices = peerImageIndices(peerStore, profile.id);
  }

  return NextResponse.json({
    success: true,
    state: {
      perImageByCategory: labelsForUser(userStore, profile.id),
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

  const row = await loadCollaborationRow();
  let store = parseCollaborationStore(row as Parameters<typeof parseCollaborationStore>[0]);
  store = {
    ...store,
    imageLocks: pruneExpiredLocks(store.imageLocks),
  };

  if (body.deletePeerShape) {
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
    store = deleteShapeFromUser(store, ownerUserId, shapeId);
    await persistCollaborationStore(store);
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

  store = applyUserSync(store, profile.id, {
    perImageByCategory: body.perImageByCategory,
    annotations: body.annotations as Parameters<typeof applyUserSync>[2]["annotations"],
    allowEmptyAnnotations: body.allowEmptyAnnotations === true,
    clientSyncedAt:
      typeof body.clientSyncedAt === "string" ? body.clientSyncedAt : undefined,
  });

  await persistCollaborationStore(store);

  return NextResponse.json({
    success: true,
    imageLocks: store.imageLocks,
    userSyncedAt: store.userSyncAt[profile.id] ?? null,
  });
}
