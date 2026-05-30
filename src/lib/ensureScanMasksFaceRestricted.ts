import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { decodeDataUrlImage } from "@/src/lib/dataUrlImage";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import {
  getStorage,
  invalidateUserScanCache,
  invalidateUserScanDerivedCaches,
  logger,
} from "@/src/lib/infra";
import {
  parseScanAcneMaskDataUri,
  parseScanWrinkleMaskDataUri,
} from "@/src/lib/parseClinicalScores";
import { storageRelativePathFromRef } from "@/src/lib/publicFileUrl";
import { restrictMaskDataUriToFace } from "@/src/lib/restrictMaskToFace";
import type { FaceCaptureRef } from "@/src/lib/resolveScanImageUrl";
import {
  persistDataUriToStorage,
  resolveCaptureImageSrc,
} from "@/src/lib/resolveScanImageUrl";

const CENTRE_IDX = FACE_SCAN_CAPTURE_STEPS.findIndex((s) => s.id === "centre");
const SMILING_IDX = FACE_SCAN_CAPTURE_STEPS.findIndex((s) => s.id === "smiling");

function scoresRecord(scores: unknown): Record<string, unknown> {
  if (!scores || typeof scores !== "object") return {};
  return scores as Record<string, unknown>;
}

function isFlagged(scores: Record<string, unknown>, key: string): boolean {
  return scores[key] === true;
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

/**
 * One-time backfill: clip stored acne/wrinkle masks to face skin and persist new URLs.
 * Skips scans already marked with `*MaskFaceRestricted` in `scans.scores`.
 */
export async function ensureScanMasksFaceRestricted(input: {
  userId: string;
  scanId: number;
  scores: unknown;
  faceCaptureImages?: FaceCaptureRef[] | null;
  primaryImageUrl?: string | null;
}): Promise<unknown> {
  const scores = scoresRecord(input.scores);
  const needsAcne =
    !isFlagged(scores, "acneMaskFaceRestricted") &&
    Boolean(parseScanAcneMaskDataUri(scores));
  const needsWrinkle =
    !isFlagged(scores, "wrinkleMaskFaceRestricted") &&
    Boolean(parseScanWrinkleMaskDataUri(scores));

  if (!needsAcne && !needsWrinkle) return input.scores;

  const centreJpeg = needsAcne
    ? await loadCaptureJpeg(
        input.faceCaptureImages,
        CENTRE_IDX,
        input.primaryImageUrl
      )
    : null;
  const smilingJpeg = needsWrinkle
    ? await loadCaptureJpeg(input.faceCaptureImages, SMILING_IDX, null)
    : null;

  if (needsAcne && !centreJpeg) {
    logger.warn("acne_mask_face_restrict_skipped", {
      scanId: input.scanId,
      reason: "no_centre_image",
    });
  }
  if (needsWrinkle && !smilingJpeg) {
    logger.warn("wrinkle_mask_face_restrict_skipped", {
      scanId: input.scanId,
      reason: "no_smiling_image",
    });
  }

  const storage = getStorage();
  const upload = storage.upload.bind(storage);
  const nextScores: Record<string, unknown> = { ...scores };
  let changed = false;

  if (needsAcne && centreJpeg) {
    const acneRef = parseScanAcneMaskDataUri(scores)!;
    const maskBuf = await readImageRef(acneRef);
    if (!maskBuf) {
      logger.warn("acne_mask_face_restrict_skipped", {
        scanId: input.scanId,
        reason: "mask_read_failed",
      });
    } else {
      try {
        const restricted = await restrictMaskDataUriToFace(
          bufferToMaskDataUri(maskBuf),
          centreJpeg,
          "acne"
        );
        const url = restricted
          ? await persistDataUriToStorage(restricted, "masks", upload)
          : undefined;
        if (url) {
          nextScores.acneMaskUrl = url;
          delete nextScores.acneMaskDataUri;
          nextScores.acneMaskFaceRestricted = true;
          changed = true;
        }
      } catch (err) {
        logger.warn("acne_mask_face_restrict_failed", {
          scanId: input.scanId,
          error: String(err),
        });
      }
    }
  }

  if (needsWrinkle && smilingJpeg) {
    const wrinkleRef = parseScanWrinkleMaskDataUri(scores)!;
    const maskBuf = await readImageRef(wrinkleRef);
    if (!maskBuf) {
      logger.warn("wrinkle_mask_face_restrict_skipped", {
        scanId: input.scanId,
        reason: "mask_read_failed",
      });
    } else {
      try {
        const restricted = await restrictMaskDataUriToFace(
          bufferToMaskDataUri(maskBuf),
          smilingJpeg,
          "wrinkle"
        );
        const url = restricted
          ? await persistDataUriToStorage(restricted, "masks", upload)
          : undefined;
        if (url) {
          nextScores.wrinkleMaskUrl = url;
          delete nextScores.wrinkleMaskDataUri;
          nextScores.wrinkleMaskFaceRestricted = true;
          changed = true;
        }
      } catch (err) {
        logger.warn("wrinkle_mask_face_restrict_failed", {
          scanId: input.scanId,
          error: String(err),
        });
      }
    }
  }

  if (!changed) return input.scores;

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
