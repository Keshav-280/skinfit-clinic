import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { annotatorState } from "@/src/db/schema";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";
import { getSessionUserProfileFromRequest } from "@/src/lib/auth/get-session";
import {
  ANNOTATOR_SCOPE,
  acquireImageLock,
  heartbeatImageLock,
  parseCollaborationStore,
  pruneExpiredLocks,
  releaseImageLock,
  storeToDbColumns,
} from "@/src/lib/annotatorCollaboration";

async function loadAndPruneStore() {
  const [row] = await db
    .select({
      id: annotatorState.id,
      perImageByCategory: annotatorState.perImageByCategory,
      annotations: annotatorState.annotations,
      perUserLabels: annotatorState.perUserLabels,
      perUserShapes: annotatorState.perUserShapes,
      imageLocks: annotatorState.imageLocks,
      userSyncAt: annotatorState.userSyncAt,
    })
    .from(annotatorState)
    .where(eq(annotatorState.scope, ANNOTATOR_SCOPE))
    .limit(1);

  const store = parseCollaborationStore(row as Parameters<typeof parseCollaborationStore>[0]);
  return {
    rowId: row?.id ?? null,
    store: { ...store, imageLocks: pruneExpiredLocks(store.imageLocks) },
  };
}

async function saveStore(rowId: number | null, store: ReturnType<typeof parseCollaborationStore>) {
  const data = storeToDbColumns(store);
  if (rowId) {
    await db.update(annotatorState).set(data).where(eq(annotatorState.id, rowId));
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

/** Acquire or refresh exclusive edit lock on an image index. */
export async function POST(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const profile = await getSessionUserProfileFromRequest(req);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { imageIndex?: number; action?: "acquire" | "heartbeat" }
    | null;

  const imageIndex = Math.max(0, Math.floor(body?.imageIndex ?? 0));
  const action = body?.action === "heartbeat" ? "heartbeat" : "acquire";

  const { rowId, store } = await loadAndPruneStore();

  if (action === "heartbeat") {
    const next = heartbeatImageLock(store, imageIndex, profile.id);
    await saveStore(rowId, next);
    const lock = next.imageLocks[String(imageIndex)] ?? null;
    return NextResponse.json({
      success: Boolean(lock && lock.userId === profile.id),
      lock,
      imageLocks: next.imageLocks,
    });
  }

  const { store: next, lock, conflict } = acquireImageLock(store, imageIndex, {
    id: profile.id,
    name: profile.name,
  });

  if (conflict) {
    return NextResponse.json(
      {
        success: false,
        error: "IMAGE_LOCKED",
        lock: conflict,
        imageLocks: next.imageLocks,
      },
      { status: 409 }
    );
  }

  await saveStore(rowId, next);
  return NextResponse.json({
    success: true,
    lock,
    imageLocks: next.imageLocks,
  });
}

/** Release lock when leaving an image or closing the tab. */
export async function DELETE(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const profile = await getSessionUserProfileFromRequest(req);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const imageIndex = Math.max(0, Math.floor(Number(url.searchParams.get("imageIndex") ?? 0)));

  const { rowId, store } = await loadAndPruneStore();
  const next = releaseImageLock(store, imageIndex, profile.id);
  await saveStore(rowId, next);

  return NextResponse.json({
    success: true,
    imageLocks: next.imageLocks,
  });
}
