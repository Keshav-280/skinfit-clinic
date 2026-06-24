import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
  peerShapes,
  pruneExpiredLocks,
  shapesForUser,
  storeToDbColumns,
} from "@/src/lib/annotatorCollaboration";
import { isAnnotatorAdminEmail } from "@/src/lib/annotatorAdmins";

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
      updatedAt: annotatorState.updatedAt,
    })
    .from(annotatorState)
    .where(eq(annotatorState.scope, ANNOTATOR_SCOPE))
    .limit(1);
  return row ?? null;
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

  const row = await loadCollaborationRow();
  let store = parseCollaborationStore(row as Parameters<typeof parseCollaborationStore>[0]);
  store = { ...store, imageLocks: pruneExpiredLocks(store.imageLocks) };

  if (merged) {
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

  return NextResponse.json({
    success: true,
    state: {
      perImageByCategory: labelsForUser(store, profile.id),
      annotations: shapesForUser(store, profile.id),
      imageLocks: store.imageLocks,
      peerAnnotations: peerShapes(store, profile.id),
      currentUser: {
        id: profile.id,
        name: profile.name,
        isAnnotatorAdmin,
      },
      updatedAt: row?.updatedAt ?? null,
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
    return NextResponse.json({
      success: true,
      imageLocks: store.imageLocks,
      peerAnnotations: peerShapes(store, profile.id),
    });
  }

  store = applyUserSync(store, profile.id, {
    perImageByCategory: body.perImageByCategory,
    annotations: body.annotations as Parameters<typeof applyUserSync>[2]["annotations"],
    allowEmptyAnnotations: body.allowEmptyAnnotations === true,
  });

  await persistCollaborationStore(store);

  return NextResponse.json({
    success: true,
    imageLocks: store.imageLocks,
  });
}
