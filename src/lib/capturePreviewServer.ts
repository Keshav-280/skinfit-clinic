import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  getServerFaceCaptureConfig,
  usesServerFacePreview,
} from "@/src/lib/faceCaptureConfig";

export function isRetinaFaceModelOnDisk(): boolean {
  const cfg = getServerFaceCaptureConfig();
  const path = resolve(process.cwd(), cfg.modelsDir, "retinaface.onnx");
  return existsSync(path);
}

/** POST /api/capture/preview allowed when env requests it or ONNX is present. */
export function isCapturePreviewApiEnabled(): boolean {
  return usesServerFacePreview(getServerFaceCaptureConfig()) || isRetinaFaceModelOnDisk();
}
