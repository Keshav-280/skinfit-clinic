import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { scanJobs } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { readWebFormData } from "@/src/lib/webRequestFormData";
import {
  buildScanImagesFromForm,
  buildScanImagesFromPaths,
  parseImagePathsField,
} from "@/src/lib/scanSubmitPayload";
import { parseCaptureCropContext } from "@/src/lib/parseCaptureCropContext";
import {
  getScanAnalysisQueue,
  setJobStatus,
  logger,
  isAsyncScanEnabled,
  SCAN_ANALYSIS_QUEUE_JOB_OPTS,
} from "@/src/lib/infra";
import type { ScanJobPayload } from "@/src/lib/infra";
import {
  buildFaceIdentityInputsFromPaths,
  cleanupUploadedScanImages,
  enforceScanFaceIdentity,
  FACE_IDENTITY_ERROR_CODES,
} from "@/src/lib/scanFaceIdentityGate";

/**
 * Async scan submission - uploads (multipart or pre-signed R2 paths), enqueues BullMQ.
 * Enable with SCAN_ASYNC_MODE=1
 */
export async function POST(request: NextRequest) {
  if (!isAsyncScanEnabled()) {
    return NextResponse.json(
      {
        error:
          "Async scan mode disabled. Set SCAN_ASYNC_MODE=1 or use POST /api/scan (legacy).",
      },
      { status: 503 }
    );
  }

  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const formData = await readWebFormData(request);
  const scanName = (formData.get("scanName") as string) || "Untitled Scan";

  let imagePaths: Record<string, string>;
  let faceCaptureImages: ScanJobPayload["faceCaptureImages"];

  const pathsRaw = formData.get("imagePaths");
  if (typeof pathsRaw === "string" && pathsRaw.trim()) {
    try {
      const pathsByStep = parseImagePathsField(pathsRaw);
      ({ imagePaths, faceCaptureImages } = buildScanImagesFromPaths(pathsByStep));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid imagePaths" },
        { status: 400 }
      );
    }
  } else {
    const multiRaw = formData
      .getAll("images")
      .filter((x): x is File => x instanceof File && x.size > 0);

    if (multiRaw.length !== FACE_SCAN_CAPTURE_STEPS.length) {
      return NextResponse.json(
        {
          error: `Provide exactly ${FACE_SCAN_CAPTURE_STEPS.length} images, or imagePaths JSON after presigned upload.`,
        },
        { status: 400 }
      );
    }

    try {
      ({ imagePaths, faceCaptureImages } = await buildScanImagesFromForm(multiRaw));
    } catch (err) {
      logger.error("scan_upload_failed", { userId, error: String(err) });
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  const captureCropContext = parseCaptureCropContext(formData);
  const mobileSessionIdRaw = formData.get("mobileSessionId");
  const mobileSessionId =
    typeof mobileSessionIdRaw === "string" && mobileSessionIdRaw.trim()
      ? mobileSessionIdRaw.trim()
      : undefined;

  const identity = await enforceScanFaceIdentity({
    userId,
    scanName,
    images: buildFaceIdentityInputsFromPaths(imagePaths),
  });
  if (!identity.ok) {
    await cleanupUploadedScanImages(imagePaths);
    const status =
      identity.code === FACE_IDENTITY_ERROR_CODES.SERVICE_UNAVAILABLE ? 503 : 403;
    return NextResponse.json(
      {
        error: identity.code,
        message: identity.message,
        identityChecks: identity.imageChecks,
      },
      { status }
    );
  }

  const primaryImageUrl = faceCaptureImages[0]?.imageUrl ?? "";
  const payload: ScanJobPayload = {
    userId,
    scanName,
    imagePaths,
    faceCaptureImages,
    primaryImageUrl,
    captureCropContext,
    ...(mobileSessionId ? { mobileSessionId } : {}),
    identityVerifiedAt: new Date().toISOString(),
  };

  const [jobRow] = await db
    .insert(scanJobs)
    .values({
      userId,
      status: "pending",
      payloadJson: payload as unknown as Record<string, unknown>,
    })
    .returning({ id: scanJobs.id });

  const jobId = jobRow.id;
  const queue = getScanAnalysisQueue();
  await queue.add("analyze", { jobId, payload }, {
    jobId,
    ...SCAN_ANALYSIS_QUEUE_JOB_OPTS,
  });

  await setJobStatus(jobId, "pending", { userId });
  logger.queue("scan-analysis", "enqueued", { jobId, userId });

  return NextResponse.json(
    { status: "queued", jobId },
    { status: 202 }
  );
}
