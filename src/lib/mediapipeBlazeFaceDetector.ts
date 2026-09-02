/**
 * MediaPipe BlazeFace short-range - dedicated face detector (stabler bbox than
 * deriving a box from 468 landmarks).
 */

import { mediapipeWasmRoot } from "@/src/lib/scanCaptureGuidance";
import type { NormalizedFaceBox } from "@/src/lib/scanCaptureGuidance";

export const BLAZE_FACE_SHORT_RANGE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

type BlazeDetection = {
  boundingBox?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
  categories?: Array<{ score?: number }>;
};

export type BlazeFaceDetectorLike = {
  detect: (image: HTMLCanvasElement) => { detections?: BlazeDetection[] };
};

export async function createBlazeFaceDetector(): Promise<BlazeFaceDetectorLike> {
  const vision = await import("@mediapipe/tasks-vision");
  const wasmRoot = mediapipeWasmRoot();
  const fileset = await vision.FilesetResolver.forVisionTasks(wasmRoot);
  const opts = {
    baseOptions: {
      modelAssetPath: BLAZE_FACE_SHORT_RANGE_MODEL,
      delegate: "CPU" as const,
    },
    runningMode: "IMAGE" as const,
    minDetectionConfidence: 0.55,
    minSuppressionThreshold: 0.3,
  };
  try {
    return await vision.FaceDetector.createFromOptions(fileset, opts);
  } catch {
    const fileset2 = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    return await vision.FaceDetector.createFromOptions(fileset2, {
      ...opts,
      baseOptions: { ...opts.baseOptions, delegate: "GPU" as const },
    });
  }
}

export function faceBoxFromBlazeDetections(
  detections: BlazeDetection[] | undefined,
  frameW: number,
  frameH: number
): NormalizedFaceBox | null {
  if (!detections?.length || frameW < 1 || frameH < 1) return null;

  let best: BlazeDetection | null = null;
  let bestScore = -1;
  for (const d of detections) {
    const score = d.categories?.[0]?.score ?? 0;
    if (score > bestScore && d.boundingBox) {
      bestScore = score;
      best = d;
    }
  }
  if (!best?.boundingBox || bestScore < 0.45) return null;

  const bb = best.boundingBox;
  const padX = 0.06;
  const padY = 0.1;
  const x = Math.max(0, bb.originX / frameW - (bb.width / frameW) * padX);
  const y = Math.max(0, bb.originY / frameH - (bb.height / frameH) * padY);
  const width = Math.min(1 - x, (bb.width / frameW) * (1 + padX * 2));
  const height = Math.min(1 - y, (bb.height / frameH) * (1 + padY * 1.2));
  if (width < 0.04 || height < 0.06) return null;
  return { x, y, width, height };
}
