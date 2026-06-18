import { asc, eq } from "drizzle-orm";

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
import { getStorage } from "@/src/lib/infra";

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
      action: "reference_set" | "verified" | "skipped";
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
  const [first] = await db
    .select({
      imageUrl: scans.imageUrl,
      faceCaptureImages: scans.faceCaptureImages,
    })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt))
    .limit(1);

  if (!first) return null;

  const captures = (first.faceCaptureImages ?? []) as FaceCaptureRef[];
  const centre =
    captures.find((c) => c.label === "centre") ??
    captures.find((c) => c.label === "center");
  const centreUrl = centre?.imageUrl ?? first.imageUrl;
  if (!centreUrl || typeof centreUrl !== "string") return null;

  const path = storagePathFromFileUrl(centreUrl);
  if (!path) return null;

  const jpeg = await getStorage().read(path);
  const extracted = await extractFaceEmbedding(jpeg);
  if (!extracted.ok) return null;

  await saveUserFaceReference({
    userId,
    embedding: extracted.embedding,
    imagePath: path,
  });

  return { embedding: extracted.embedding, imagePath: path };
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
  if (!isFaceIdentityVerificationEnabled()) {
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
    }
  }

  const centrePath = args.centreImagePath ?? "";
  const establishingBaseline =
    !reference.embedding?.length && isBaselineOnboardingScan(args.scanName);

  if (!reference.embedding?.length && !establishingBaseline) {
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.REFERENCE_REQUIRED,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.REFERENCE_REQUIRED],
    };
  }

  let jpeg: Buffer;
  try {
    jpeg = await readCentreImageBuffer(args);
  } catch {
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE],
    };
  }

  let extracted: Awaited<ReturnType<typeof extractFaceEmbedding>>;
  try {
    extracted = await extractFaceEmbedding(jpeg);
  } catch {
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
    return {
      ok: false,
      code,
      message: USER_MESSAGES[code],
    };
  }

  if (establishingBaseline) {
    await saveUserFaceReference({
      userId: args.userId,
      embedding: extracted.embedding,
      imagePath: centrePath || "onboarding-centre-inline",
    });
    return { ok: true, action: "reference_set" };
  }

  const similarity = cosineSimilarity(
    reference.embedding!,
    extracted.embedding
  );
  const threshold = faceIdentityMatchThreshold();
  if (similarity < threshold) {
    return {
      ok: false,
      code: FACE_IDENTITY_ERROR_CODES.MISMATCH,
      message: USER_MESSAGES[FACE_IDENTITY_ERROR_CODES.MISMATCH],
      similarity,
    };
  }

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
