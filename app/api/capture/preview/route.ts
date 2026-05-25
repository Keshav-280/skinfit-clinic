import { NextResponse } from "next/server";

import { withApiHandler } from "@/src/lib/api/withApiHandler";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  getServerFaceCaptureConfig,
  usesServerFacePreview,
} from "@/src/lib/faceCaptureConfig";
import { runFacePreviewInference } from "@/src/lib/facePreviewInference";
import { checkRateLimit } from "@/src/lib/security/rateLimit";

const MAX_BYTES = 900_000;

/**
 * POST /api/capture/preview — RetinaFace box/pose + blink/smile classifier (ONNX).
 * Multipart field: `file` (JPEG). Requires auth. Heavier than on-device MediaPipe.
 */
export const POST = withApiHandler("capture.preview", async (request) => {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = getServerFaceCaptureConfig();
  if (!usesServerFacePreview(cfg)) {
    return NextResponse.json(
      {
        error:
          "Server preview disabled. Set FACE_DETECTOR=retinaface and/or FACE_EXPRESSION=classifier.",
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
