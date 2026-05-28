import { NextResponse } from "next/server";

import { withApiHandler } from "@/src/lib/api/withApiHandler";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { isCapturePreviewApiEnabled, isRetinaFaceModelOnDisk } from "@/src/lib/capturePreviewServer";
import { runFacePreviewInference } from "@/src/lib/facePreviewInference";
import { checkRateLimit } from "@/src/lib/security/rateLimit";

const MAX_BYTES = 900_000;

/** GET /api/capture/preview — whether RetinaFace ONNX is available on the server. */
export const GET = withApiHandler("capture.preview.status", async () => {
  const onDisk = isRetinaFaceModelOnDisk();
  return NextResponse.json({
    enabled: isCapturePreviewApiEnabled(),
    retinafaceOnDisk: onDisk,
  });
});

/**
 * POST /api/capture/preview — RetinaFace box/pose + blink/smile classifier (ONNX).
 * Multipart field: `file` (JPEG). Requires auth. Heavier than on-device MediaPipe.
 */
export const POST = withApiHandler("capture.preview", async (request) => {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCapturePreviewApiEnabled()) {
    return NextResponse.json(
      {
        error:
          "Server preview disabled. Add models/capture/retinaface.onnx or set FACE_DETECTOR=retinaface.",
      },
      { status: 503 }
    );
  }

  const rl = checkRateLimit(`capture-preview:${userId}`, 45, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many preview requests" }, { status: 429 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await runFacePreviewInference(buf);

  return NextResponse.json({
    success: true,
    data: result,
  });
});
