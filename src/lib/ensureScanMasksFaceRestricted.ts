import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { decodeDataUrlImage } from "@/src/lib/dataUrlImage";
import {
  ACNE_MASK_FACE_CLIP_VERSION,
  acneMaskNeedsFaceClip,
} from "@/src/lib/acneMaskFaceClip";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import {
  getStorage,
  invalidateUserScanCache,
  invalidateUserScanDerivedCaches,
  logger,
} from "@/src/lib/infra";
import { parseScanAcneMaskDataUri } from "@/src/lib/parseClinicalScores";
import { storageRelativePathFromRef } from "@/src/lib/publicFileUrl";
import { restrictMaskDataUriToFace } from "@/src/lib/restrictMaskToFace";
import type { FaceCaptureRef } from "@/src/lib/resolveScanImageUrl";
import {
  persistDataUriToStorage,
  resolveCaptureImageSrc,
} from "@/src/lib/resolveScanImageUrl";

const CENTRE_IDX = FACE_SCAN_CAPTURE_STEPS.findIndex((s) => s.id === "centre");

function scoresRecord(scores: unknown): Record<string, unknown> {
  if (!scores || typeof scores !== "object") return {};
  return scores as Record<string, unknown>;
}

async function readImageRef(ref: string): Promise<Buffer | null> {
  if (ref.startsWith("data:")) {
    return decodeDataUrlImage(ref)?.buffer ?? null;
  }
  const rel = storageRelativePathFromRef(ref);
  if (!rel) return null;
  try {
    return await getStorage().read(rel);
  } catch {
    return null;
  }
}

async function loadCaptureJpeg(
  captures: FaceCaptureRef[] | null | undefined,
  index: number,
  fallbackPrimary?: string | null
): Promise<Buffer | null> {
  const entry = captures?.[index];
  const src = entry ? resolveCaptureImageSrc(entry) : null;
  if (src) {
    const buf = await readImageRef(src);
    if (buf) return buf;
  }
  if (index === CENTRE_IDX && fallbackPrimary) {
    return readImageRef(fallbackPrimary);
  }
  return null;
}

function bufferToMaskDataUri(buf: Buffer): string {
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function storedOriginalUrl(scores: Record<string, unknown>): string | undefined {
  const url = scores.acneMaskOriginalUrl;
  return typeof url === "string" && url.trim() ? url.trim() : undefined;
}

/**
 * One-time acne mask face clip (v2): hard boundary only, preserves inference heatmap on skin.
 * Wrinkle masks are never modified here.
 */
export async function ensureScanMasksFaceRestricted(input: {
  userId: string;
  scanId: number;
  scores: unknown;
  faceCaptureImages?: FaceCaptureRef[] | null;
  primaryImageUrl?: string | null;
}): Promise<unknown> {
  const scores = scoresRecord(input.scores);
  const currentAcneRef = parseScanAcneMaskDataUri(scores);
  const needsAcne =
    Boolean(currentAcneRef) && acneMaskNeedsFaceClip(scores);

  if (!needsAcne) return input.scores;

  const centreJpeg = await loadCaptureJpeg(
    input.faceCaptureImages,
    CENTRE_IDX,
    input.primaryImageUrl
  );

  if (!centreJpeg) {
    logger.warn("acne_mask_face_restrict_skipped", {
      scanId: input.scanId,
      reason: "no_centre_image",
    });
    return input.scores;
  }

  const storage = getStorage();
  const upload = storage.upload.bind(storage);
  const nextScores: Record<string, unknown> = { ...scores };

  const originalRef = storedOriginalUrl(scores) ?? currentAcneRef;
  if (!originalRef) {
    logger.warn("acne_mask_face_restrict_skipped", {
      scanId: input.scanId,
      reason: "no_mask_ref",
    });
    return input.scores;
  }

  if (
    !storedOriginalUrl(scores) &&
    scores.acneMaskFaceRestricted !== true &&
    currentAcneRef
  ) {
    nextScores.acneMaskOriginalUrl = currentAcneRef;
  }

  const maskBuf = await readImageRef(originalRef);
  if (!maskBuf) {
    logger.warn("acne_mask_face_restrict_skipped", {
      scanId: input.scanId,
      reason: "mask_read_failed",
    });
    return input.scores;
  }

  try {
    const restricted = await restrictMaskDataUriToFace(
      bufferToMaskDataUri(maskBuf),
      centreJpeg,
      "acne"
    );
    const url = restricted
      ? await persistDataUriToStorage(restricted, "masks", upload)
      : undefined;
    if (!url) return input.scores;

    nextScores.acneMaskUrl = url;
    delete nextScores.acneMaskDataUri;
    nextScores.acneMaskFaceClipVersion = ACNE_MASK_FACE_CLIP_VERSION;
    nextScores.acneMaskFaceRestricted = true;
  } catch (err) {
    logger.warn("acne_mask_face_restrict_failed", {
      scanId: input.scanId,
      error: String(err),
    });
    return input.scores;
  }

  await db
    .update(scans)
    .set({ scores: nextScores })
    .where(eq(scans.id, input.scanId));

  await Promise.all([
    invalidateUserScanCache(input.userId, input.scanId),
    invalidateUserScanDerivedCaches(input.userId),
  ]);

  return nextScores;
}
