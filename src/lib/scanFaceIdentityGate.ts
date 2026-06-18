import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import type { FaceCaptureRef } from "@/src/lib/resolveScanImageUrl";
import {
  cosineSimilarity,
  extractFaceEmbedding,
  faceIdentityMatchThreshold,
  isFaceIdentityVerificationEnabled,
} from "@/src/lib/faceIdentityInference";
import { BASELINE_ONBOARDING_SCAN_NAME } from "@/src/lib/onboardingConstants";
import { getStorage, logger } from "@/src/lib/infra";

export const FACE_IDENTITY_ERROR_CODES = {
  MISMATCH: "FACE_IDENTITY_MISMATCH",
  NOT_DETECTED: "FACE_NOT_DETECTED",
  SERVICE_UNAVAILABLE: "FACE_IDENTITY_SERVICE_UNAVAILABLE",
  REFERENCE_REQUIRED: "FACE_IDENTITY_REFERENCE_REQUIRED",
} as const;

export type FaceIdentityErrorCode =
  (typeof FACE_IDENTITY_ERROR_CODES)[keyof typeof FACE_IDENTITY_ERROR_CODES];

export type ScanFaceIdentityGateResult =
  | {
      ok: true;
      action: "reference_set" | "legacy_reference_set" | "verified" | "skipped";
      similarity?: number;
    }
  | {
      ok: false;
      code: FaceIdentityErrorCode;
      message: string;
      similarity?: number;
    };

const USER_MESSAGES: Record<FaceIdentityErrorCode, string> = {
  [FACE_IDENTITY_ERROR_CODES.MISMATCH]:
    "This scan doesn't match the person who completed onboarding. Please use your own account, or contact support if you need to reset your baseline.",
  [FACE_IDENTITY_ERROR_CODES.NOT_DETECTED]:
    "We couldn't detect a clear face in your front photo. Retake the centre shot with your face centered and well lit.",
  [FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE]:
    "Face verification is temporarily unavailable. Please try again in a few minutes.",
  [FACE_IDENTITY_ERROR_CODES.REFERENCE_REQUIRED]:
    "Complete your onboarding baseline scan first before taking another scan.",
};

function bufferFromDataUri(dataUri: string): Buffer | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUri.trim());
  if (!m) return null;
  try {
    return Buffer.from(m[2]!, "base64");
  } catch {
    return null;
  }
}

function centreCaptureFromScan(row: {
  imageUrl: string | null;
  faceCaptureImages: unknown;
}): FaceCaptureRef | null {
  const captures = (row.faceCaptureImages ?? []) as FaceCaptureRef[];
  return (
    captures.find((c) => c.label === "centre") ??
    captures.find((c) => c.label === "center") ??
    (row.imageUrl
      ? { label: "centre", imageUrl: row.imageUrl }
      : captures[0] ?? null)
  );
}

async function readCentreImageFromCapture(
  capture: FaceCaptureRef
): Promise<Buffer | null> {
  if (capture.dataUri) {
    return bufferFromDataUri(capture.dataUri);
  }
  const url = capture.imageUrl ?? capture.previewUrl ?? "";
  if (!url) return null;

  const path = storagePathFromFileUrl(url);
  if (path) {
    try {
      return await getStorage().read(path);
    } catch {
      return null;
    }
  }

  if (url.startsWith("scans/") || url.startsWith("masks/")) {
    try {
      return await getStorage().read(url);
    } catch {
      return null;
    }
  }

  return null;
}

async function countUserScans(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scans)
    .where(eq(scans.userId, userId));
  return row?.count ?? 0;
}

async function findReferenceScanRow(userId: string) {
  const [baseline] = await db
    .select({
      imageUrl: scans.imageUrl,
      faceCaptureImages: scans.faceCaptureImages,
    })
    .from(scans)
    .where(
      and(
        eq(scans.userId, userId),
        eq(scans.scanName, BASELINE_ONBOARDING_SCAN_NAME)
      )
    )
    .orderBy(asc(scans.createdAt))
    .limit(1);

  if (baseline) return baseline;

  const [first] = await db
    .select({
      imageUrl: scans.imageUrl,
      faceCaptureImages: scans.faceCaptureImages,
    })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt))
    .limit(1);

  return first ?? null;
}

function isBaselineOnboardingScan(scanName: string): boolean {
  return scanName.trim() === BASELINE_ONBOARDING_SCAN_NAME;
}

function storagePathFromFileUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const apiPrefix = "/api/files/";
  if (trimmed.startsWith(apiPrefix)) {
    return decodeURIComponent(trimmed.slice(apiPrefix.length));
  }
  try {
    const u = new URL(trimmed, "http://local");
    if (u.pathname.startsWith(apiPrefix)) {
      return decodeURIComponent(u.pathname.slice(apiPrefix.length));
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function readCentreImageBuffer(args: {
  centreImagePath?: string;
  centreImageJpeg?: Buffer;
}): Promise<Buffer> {
  if (args.centreImageJpeg?.length) return args.centreImageJpeg;
  if (!args.centreImagePath) {
    throw new Error("centre_image_missing");
  }
  const storage = getStorage();
  return storage.read(args.centreImagePath);
}

async function loadUserFaceReference(userId: string): Promise<{
  embedding: number[] | null;
  imagePath: string | null;
}> {
  const [row] = await db
    .select({
      embedding: users.faceReferenceEmbedding,
      imagePath: users.faceReferenceImagePath,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    embedding: row?.embedding ?? null,
    imagePath: row?.imagePath ?? null,
  };
}

async function saveUserFaceReference(args: {
  userId: string;
  embedding: number[];
  imagePath: string;
}): Promise<void> {
  await db
    .update(users)
    .set({
      faceReferenceEmbedding: args.embedding,
      faceReferenceImagePath: args.imagePath,
      faceReferenceSetAt: new Date(),
    })
    .where(eq(users.id, args.userId));
}

async function backfillReferenceFromFirstScan(
  userId: string
): Promise<{ embedding: number[]; imagePath: string } | null> {
  const scanRow = await findReferenceScanRow(userId);
  if (!scanRow) return null;

  const centre = centreCaptureFromScan(scanRow);
  if (!centre) return null;

  const jpeg = await readCentreImageFromCapture(centre);
  if (!jpeg?.length) return null;

  const extracted = await extractFaceEmbedding(jpeg);
  if (!extracted.ok) return null;

  const imagePath =
    storagePathFromFileUrl(centre.imageUrl ?? "") ??
    (centre.imageUrl?.startsWith("scans/") ? centre.imageUrl : null) ??
    "legacy-backfill-centre";

  await saveUserFaceReference({
    userId,
    embedding: extracted.embedding,
    imagePath,
  });

  return { embedding: extracted.embedding, imagePath };
}

/**
 * Verify the centre photo against the user's onboarding face reference.
 * Sets the reference on the first onboarding baseline when none exists.
 */
export async function enforceScanFaceIdentity(args: {
  userId: string;
  scanName: string;
  centreImagePath?: string;
  centreImageJpeg?: Buffer;
}): Promise<ScanFaceIdentityGateResult> {
  const logBase = { userId: args.userId, scanName: args.scanName };
  logger.info("face_identity_check_start", logBase);

  if (!isFaceIdentityVerificationEnabled()) {
    logger.info("face_identity_skipped", {
      ...logBase,
      reason: "FACE_IDENTITY_VERIFICATION disabled",
    });
    return { ok: true, action: "skipped" };
  }

  let reference = await loadUserFaceReference(args.userId);
  if (!reference.embedding?.length) {
    const backfilled = await backfillReferenceFromFirstScan(args.userId);
    if (backfilled) {
      reference = {
        embedding: backfilled.embedding,
        imagePath: backfilled.imagePath,
      };
      logger.info("face_identity_reference_backfilled", {
        ...logBase,
        imagePath: backfilled.imagePath,
      });
    }
  }

  const centrePath = args.centreImagePath ?? "";
  const priorScanCount = await countUserScans(args.userId);
  const establishingBaseline =
    !reference.embedding?.length && isBaselineOnboardingScan(args.scanName);
  const legacyBootstrap =
    !reference.embedding?.length &&
    !establishingBaseline &&
    priorScanCount > 0;

  if (!reference.embedding?.length && !establishingBaseline && !legacyBootstrap) {
    logger.warn("face_identity_blocked", {
      ...logBase,
      code: FACE_IDENTITY_ERROR_CODES.REFERENCE_REQUIRED,
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.REFERENCE_REQUIRED,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.REFERENCE_REQUIRED],
    };
  }

  let jpeg: Buffer;
  try {
    jpeg = await readCentreImageBuffer(args);
  } catch (err) {
    logger.error("face_identity_image_read_failed", {
      ...logBase,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE],
    };
  }

  let extracted: Awaited<ReturnType<typeof extractFaceEmbedding>>;
  try {
    extracted = await extractFaceEmbedding(jpeg);
  } catch (err) {
    logger.error("face_identity_embed_error", {
      ...logBase,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE],
    };
  }

  if (!extracted.ok) {
    const code = extracted.faceDetected
      ? FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE
      : FACE_IDENTITY_ERROR_CODES.NOT_DETECTED;
    logger.warn("face_identity_blocked", {
      ...logBase,
      code,
      reason: extracted.error,
      faceDetected: extracted.faceDetected,
    });
    return {
      ok: false,
      code,
      message: USER_MESSAGES[code],
    };
  }

  if (establishingBaseline || legacyBootstrap) {
    await saveUserFaceReference({
      userId: args.userId,
      embedding: extracted.embedding,
      imagePath: centrePath || "onboarding-centre-inline",
    });
    const action = establishingBaseline
      ? "reference_set"
      : "legacy_reference_set";
    logger.info("face_identity_reference_set", { ...logBase, action });
    return { ok: true, action };
  }

  const similarity = cosineSimilarity(
    reference.embedding!,
    extracted.embedding
  );
  const threshold = faceIdentityMatchThreshold();
  if (similarity < threshold) {
    logger.warn("face_identity_blocked", {
      ...logBase,
      code: FACE_IDENTITY_ERROR_CODES.MISMATCH,
      similarity: Number(similarity.toFixed(4)),
      threshold,
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.MISMATCH,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.MISMATCH],
      similarity,
    };
  }

  logger.info("face_identity_verified", {
    ...logBase,
    similarity: Number(similarity.toFixed(4)),
    threshold,
  });
  return { ok: true, action: "verified", similarity };
}

export async function cleanupUploadedScanImages(
  imagePaths: Record<string, string>
): Promise<void> {
  const storage = getStorage();
  await Promise.all(
    Object.values(imagePaths).map((path) =>
      storage.delete(path).catch(() => undefined)
    )
  );
}
