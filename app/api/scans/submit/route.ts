import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { scanJobs } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { readWebFormData } from "@/src/lib/webRequestFormData";
import {
  getScanAnalysisQueue,
  setJobStatus,
  getStorage,
  logger,
  isAsyncScanEnabled,
  SCAN_ANALYSIS_QUEUE_JOB_OPTS,
} from "@/src/lib/infra";
import type { ScanJobPayload, ScanCaptureImageRef } from "@/src/lib/infra";

/**
 * Async scan submission — saves files locally, enqueues BullMQ job, returns immediately.
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
  const multiRaw = formData
    .getAll("images")
    .filter((x): x is File => x instanceof File && x.size > 0);

  if (multiRaw.length !== FACE_SCAN_CAPTURE_STEPS.length) {
    return NextResponse.json(
      {
        error: `Provide exactly ${FACE_SCAN_CAPTURE_STEPS.length} images.`,
      },
      { status: 400 }
    );
  }

  const storage = getStorage();
  const imagePaths: Record<string, string> = {};
  const faceCaptureImages: ScanCaptureImageRef[] = [];

  for (let i = 0; i < multiRaw.length; i++) {
    const file = multiRaw[i];
    const step = FACE_SCAN_CAPTURE_STEPS[i];
    const buf = Buffer.from(await file.arrayBuffer());
    const { path, url } = await storage.upload(
      "scans",
      file.name || `${step.id}.jpg`,
      buf,
      file.type || "image/jpeg"
    );
    imagePaths[step.id] = path;
    faceCaptureImages.push({ label: step.id, imageUrl: url });
  }

  const primaryImageUrl = faceCaptureImages[0]?.imageUrl ?? "";
  const payload: ScanJobPayload = {
    userId,
    scanName,
    imagePaths,
    faceCaptureImages,
    primaryImageUrl,
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
