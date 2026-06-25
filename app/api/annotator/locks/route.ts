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
  pruneExpiredLocks,
  releaseImageLock,
  type AnnotatorCollaborationStore,
  type AnnotatorImageLock,
} from "@/src/lib/annotatorCollaboration";

type LocksMap = Record<string, AnnotatorImageLock>;

/**
 * Locks live in the same row as annotation shapes, but lock traffic is by far the
 * hottest path (acquire on every image switch, heartbeat every 10s/user, release
 * on leave). Reading/writing the full row would pull and rewrite the multi-MB
 * `per_user_shapes` blob on every one of those calls — the dominant cause of CPU
 * pinning, 504s and OOM under load. These helpers touch ONLY the `image_locks`
 * column, which also removes the lost-update race where a lock write would clobber
 * a concurrent shape save.
 */
async function loadLocks(): Promise<{ rowId: number | null; imageLocks: LocksMap }> {
  const [row] = await db
    .select({ id: annotatorState.id, imageLocks: annotatorState.imageLocks })
    .from(annotatorState)
    .where(eq(annotatorState.scope, ANNOTATOR_SCOPE))
    .limit(1);
  const locks =
    row?.imageLocks && typeof row.imageLocks === "object"
      ? (row.imageLocks as LocksMap)
      : {};
  return { rowId: row?.id ?? null, imageLocks: pruneExpiredLocks(locks) };
}

async function saveLocks(rowId: number | null, imageLocks: LocksMap) {
  if (rowId) {
    await db
      .update(annotatorState)
      .set({ imageLocks, updatedAt: new Date() })
      .where(eq(annotatorState.id, rowId));
    return;
  }
  await db.insert(annotatorState).values({
    scope: ANNOTATOR_SCOPE,
    perImageByCategory: {},
    annotations: [],
    currentIndex: 0,
    imageLocks,
  });
}

/** Lock helpers only read/write `imageLocks`; the rest of the store can be empty. */
function lockStore(imageLocks: LocksMap): AnnotatorCollaborationStore {
  return {
    perUserLabels: {},
    perUserShapes: {},
    imageLocks,
    userSyncAt: {},
    shapeTombstones: {},
  };
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

  const { rowId, imageLocks } = await loadLocks();
  const store = lockStore(imageLocks);

  if (action === "heartbeat") {
    const next = heartbeatImageLock(store, imageIndex, profile.id);
    await saveLocks(rowId, next.imageLocks);
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

  await saveLocks(rowId, next.imageLocks);
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

  const { rowId, imageLocks } = await loadLocks();
  const next = releaseImageLock(lockStore(imageLocks), imageIndex, profile.id);
  await saveLocks(rowId, next.imageLocks);

  return NextResponse.json({
    success: true,
    imageLocks: next.imageLocks,
  });
}
