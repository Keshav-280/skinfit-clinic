import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db/client";
import { scans, users } from "@/src/db/schema";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import type { FaceCaptureRef } from "@/src/lib/resolveScanImageUrl";
import {
  cosineSimilarity,
  extractFaceEmbedding,
  faceIdentityMatchThreshold,
  faceIdentityMatchThresholdForLabel,
  faceIdentityProfileMatchThreshold,
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

export type FaceIdentityImageInput = {
  label: string;
  path?: string;
  jpeg?: Buffer;
};

export type FaceIdentityImageCheck = {
  label: string;
  title: string;
  matched: boolean;
  faceDetected: boolean;
  similarity?: number;
  /** Minimum cosine similarity required for this angle. */
  threshold?: number;
  /** Debug: raw failure reason from the face embedding service. */
  error?: string;
  /** Debug: size of the JPEG buffer fed to the detector (bytes). */
  bytes?: number;
};

export type ScanFaceIdentityGateResult =
  | {
      ok: true;
      action: "reference_set" | "legacy_reference_set" | "verified" | "skipped";
      similarity?: number;
      imageChecks?: FaceIdentityImageCheck[];
    }
  | {
      ok: false;
      code: FaceIdentityErrorCode;
      message: string;
      similarity?: number;
      imageChecks?: FaceIdentityImageCheck[];
    };

const USER_MESSAGES: Record<FaceIdentityErrorCode, string> = {
  [FACE_IDENTITY_ERROR_CODES.MISMATCH]:
    "This photo doesn't look like the same person as your profile photo. Please retake your photos.",
  [FACE_IDENTITY_ERROR_CODES.NOT_DETECTED]:
    "We couldn't see your face clearly. Please retake with your face centered and well lit.",
  [FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE]:
    "We couldn't verify your photo right now. Please try again in a few minutes.",
  [FACE_IDENTITY_ERROR_CODES.REFERENCE_REQUIRED]:
    "Please complete your profile photo scan first.",
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

function titleForCaptureLabel(label: string): string {
  return (
    FACE_SCAN_CAPTURE_STEPS.find((step) => step.id === label)?.title ?? label
  );
}

export function buildFaceIdentityInputsFromPaths(
  imagePaths: Record<string, string>
): FaceIdentityImageInput[] {
  return FACE_SCAN_CAPTURE_STEPS.map((step) => ({
    label: step.id,
    path: imagePaths[step.id],
  })).filter((input) => Boolean(input.path));
}

export function buildFaceIdentityInputsFromJpegs(
  jpegs: Partial<Record<string, Buffer>>
): FaceIdentityImageInput[] {
  return FACE_SCAN_CAPTURE_STEPS.map((step) => ({
    label: step.id,
    jpeg: jpegs[step.id],
  })).filter((input) => input.jpeg?.length);
}

function resolveFaceIdentityImages(args: {
  centreImagePath?: string;
  centreImageJpeg?: Buffer;
  images?: FaceIdentityImageInput[];
}): FaceIdentityImageInput[] {
  if (args.images?.length) return args.images;
  if (args.centreImageJpeg?.length || args.centreImagePath) {
    return [
      {
        label: "centre",
        path: args.centreImagePath,
        jpeg: args.centreImageJpeg,
      },
    ];
  }
  return [];
}

async function readImageBuffer(input: FaceIdentityImageInput): Promise<Buffer> {
  if (input.jpeg?.length) return input.jpeg;
  if (!input.path) throw new Error("image_missing");
  return getStorage().read(input.path);
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

async function verifyImagesAgainstReference(
  referenceEmbedding: number[],
  images: FaceIdentityImageInput[]
): Promise<{
  imageChecks: FaceIdentityImageCheck[];
  worstSimilarity: number;
  allMatch: boolean;
  anyFaceDetected: boolean;
}> {
  const imageChecks: FaceIdentityImageCheck[] = [];
  let worstSimilarity = 1;
  let anyFaceDetected = false;

  for (const image of images) {
    const title = titleForCaptureLabel(image.label);
    const threshold = faceIdentityMatchThresholdForLabel(image.label);
    let jpeg: Buffer;
    try {
      jpeg = await readImageBuffer(image);
    } catch (err) {
      imageChecks.push({
        label: image.label,
        title,
        matched: false,
        faceDetected: false,
        threshold,
        error: `read_failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    let extracted: Awaited<ReturnType<typeof extractFaceEmbedding>>;
    try {
      extracted = await extractFaceEmbedding(jpeg);
    } catch (err) {
      imageChecks.push({
        label: image.label,
        title,
        matched: false,
        faceDetected: false,
        threshold,
        bytes: jpeg.length,
        error: `embed_threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    if (!extracted.ok) {
      imageChecks.push({
        label: image.label,
        title,
        matched: false,
        faceDetected: extracted.faceDetected,
        threshold,
        bytes: jpeg.length,
        error: extracted.error,
      });
      if (extracted.faceDetected) anyFaceDetected = true;
      continue;
    }

    anyFaceDetected = true;
    const similarity = cosineSimilarity(referenceEmbedding, extracted.embedding);
    if (similarity < worstSimilarity) worstSimilarity = similarity;
    const matched = similarity >= threshold;
    imageChecks.push({
      label: image.label,
      title,
      matched,
      faceDetected: true,
      similarity: Number(similarity.toFixed(4)),
      threshold,
      bytes: jpeg.length,
    });
  }

  const allMatch =
    imageChecks.length > 0 && imageChecks.every((check) => check.matched);

  return {
    imageChecks,
    worstSimilarity: imageChecks.length > 0 ? worstSimilarity : -1,
    allMatch,
    anyFaceDetected,
  };
}

/**
 * Verify all five capture angles against the onboarding face reference.
 * Sets the reference from the front photo on the first onboarding baseline.
 */
export async function enforceScanFaceIdentity(args: {
  userId: string;
  scanName: string;
  centreImagePath?: string;
  centreImageJpeg?: Buffer;
  images?: FaceIdentityImageInput[];
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

  const imagesToCheck = resolveFaceIdentityImages(args);
  const referenceImage =
    imagesToCheck.find((image) => image.label === "centre") ?? imagesToCheck[0];

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

  const centrePath =
    referenceImage?.path ?? args.centreImagePath ?? "";
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

  if (!referenceImage) {
    logger.error("face_identity_image_read_failed", {
      ...logBase,
      error: "no_images_provided",
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE],
    };
  }

  let referenceJpeg: Buffer;
  try {
    referenceJpeg = await readImageBuffer(referenceImage);
  } catch (err) {
    logger.error("face_identity_image_read_failed", {
      ...logBase,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE],
      imageChecks: [
        {
          label: referenceImage.label,
          title: titleForCaptureLabel(referenceImage.label),
          matched: false,
          faceDetected: false,
          error: `read_failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  let extracted: Awaited<ReturnType<typeof extractFaceEmbedding>>;
  try {
    extracted = await extractFaceEmbedding(referenceJpeg);
  } catch (err) {
    logger.error("face_identity_embed_error", {
      ...logBase,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE],
      imageChecks: [
        {
          label: referenceImage.label,
          title: titleForCaptureLabel(referenceImage.label),
          matched: false,
          faceDetected: false,
          bytes: referenceJpeg.length,
          error: `embed_threw: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
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
      imageChecks: [
        {
          label: referenceImage.label,
          title: titleForCaptureLabel(referenceImage.label),
          matched: false,
          faceDetected: extracted.faceDetected,
          bytes: referenceJpeg.length,
          error: extracted.error,
        },
      ],
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

  const verification = await verifyImagesAgainstReference(
    reference.embedding!,
    imagesToCheck
  );

  if (!verification.anyFaceDetected) {
    logger.warn("face_identity_blocked", {
      ...logBase,
      code: FACE_IDENTITY_ERROR_CODES.NOT_DETECTED,
      imageCount: imagesToCheck.length,
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.NOT_DETECTED,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.NOT_DETECTED],
      imageChecks: verification.imageChecks,
    };
  }

  if (!verification.allMatch) {
    const failedLabels = verification.imageChecks
      .filter((check) => !check.matched)
      .map((check) => check.label);
    logger.warn("face_identity_blocked", {
      ...logBase,
      code: FACE_IDENTITY_ERROR_CODES.MISMATCH,
      worstSimilarity: Number(verification.worstSimilarity.toFixed(4)),
      frontThreshold: faceIdentityMatchThreshold(),
      profileThreshold: faceIdentityProfileMatchThreshold(),
      failedLabels,
      imageCount: imagesToCheck.length,
    });
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.MISMATCH,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.MISMATCH],
      similarity: verification.worstSimilarity,
      imageChecks: verification.imageChecks,
    };
  }

  logger.info("face_identity_verified", {
    ...logBase,
    worstSimilarity: Number(verification.worstSimilarity.toFixed(4)),
    frontThreshold: faceIdentityMatchThreshold(),
    profileThreshold: faceIdentityProfileMatchThreshold(),
    imageCount: imagesToCheck.length,
  });
  return {
    ok: true,
    action: "verified",
    similarity: verification.worstSimilarity,
    imageChecks: verification.imageChecks,
  };
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
