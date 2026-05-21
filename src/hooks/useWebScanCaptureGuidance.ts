"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeFaceFraming,
  analyzeLightingFromRgba,
  buildCaptureGuidance,
  detectFaceBoxNormalized,
  estimateFaceBoxFromSkin,
  faceBoxFromLandmarkPoints,
  getBrowserFaceDetector,
  mediapipeWasmRoot,
  sampleVideoFrame,
  smoothFaceBox,
  type CaptureAssistModels,
  type CaptureGuidanceSnapshot,
  type NormalizedFaceBox,
  type StableFramingState,
} from "@/src/lib/scanCaptureGuidance";

const TICK_MS = 450;
const LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type CaptureStepId =
  | "centre"
  | "left"
  | "right"
  | "eyes_closed"
  | "smiling";

type BlendshapeCategory = { categoryName: string; score: number };
type NormalizedLandmark = { x: number; y: number; z?: number };
type FaceLandmarkerResult = {
  faceLandmarks?: NormalizedLandmark[][];
  faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }>;
};
type FaceLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerResult;
};

function initialModels(): CaptureAssistModels {
  const fd = typeof window !== "undefined" && getBrowserFaceDetector() != null;
  return {
    faceDetector: fd ? "ready" : "unsupported",
    mediapipe: "idle",
  };
}

function truncateErr(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.length > 120 ? `${msg.slice(0, 117)}…` : msg;
}

async function createFaceLandmarker(): Promise<FaceLandmarkerLike> {
  const vision = await import("@mediapipe/tasks-vision");
  const wasmRoot = mediapipeWasmRoot();
  const fileset = await vision.FilesetResolver.forVisionTasks(wasmRoot);
  const opts = {
    baseOptions: {
      modelAssetPath: LANDMARKER_MODEL,
      delegate: "CPU" as const,
    },
    runningMode: "VIDEO" as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
  };
  try {
    return await vision.FaceLandmarker.createFromOptions(fileset, opts);
  } catch {
    const fileset2 = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    return await vision.FaceLandmarker.createFromOptions(fileset2, {
      ...opts,
      baseOptions: { ...opts.baseOptions, delegate: "GPU" },
    });
  }
}

export function useWebScanCaptureGuidance(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  currentZoom: number,
  stepId: CaptureStepId
) {
  const [guidance, setGuidance] = useState<CaptureGuidanceSnapshot | null>(null);
  const [models, setModels] = useState<CaptureAssistModels>(initialModels);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const loadingLandmarkerRef = useRef(false);
  const smoothedBoxRef = useRef<NormalizedFaceBox | null>(null);
  const framingStateRef = useRef<StableFramingState | null>(null);
  const expressionOkRef = useRef<boolean | null>(null);

  useEffect(() => {
    setModels((m) => ({
      ...m,
      faceDetector: getBrowserFaceDetector() != null ? "ready" : "unsupported",
    }));
  }, []);

  useEffect(() => {
    if (!enabled) {
      landmarkerRef.current = null;
      loadingLandmarkerRef.current = false;
      setModels((m) => ({ ...m, mediapipe: "idle", mediapipeError: undefined }));
      return;
    }

    if (landmarkerRef.current) {
      setModels((m) => ({ ...m, mediapipe: "ready", mediapipeError: undefined }));
      return;
    }
    if (loadingLandmarkerRef.current) return;

    loadingLandmarkerRef.current = true;
    setModels((m) => ({ ...m, mediapipe: "loading", mediapipeError: undefined }));

    void (async () => {
      try {
        landmarkerRef.current = await createFaceLandmarker();
        setModels((m) => ({ ...m, mediapipe: "ready", mediapipeError: undefined }));
      } catch (e) {
        landmarkerRef.current = null;
        setModels((m) => ({
          ...m,
          mediapipe: "failed",
          mediapipeError: truncateErr(e),
        }));
        if (process.env.NODE_ENV === "development") {
          console.error("[scan] MediaPipe FaceLandmarker load failed:", e);
        }
      } finally {
        loadingLandmarkerRef.current = false;
      }
    })();
  }, [enabled]);

  const needsExpressionModel =
    stepId === "eyes_closed" || stepId === "smiling";

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current || !enabled) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    busyRef.current = true;
    try {
      const imageData = sampleVideoFrame(video);
      if (!imageData) return;

      const lighting = analyzeLightingFromRgba(
        imageData.data,
        imageData.width,
        imageData.height
      );

      let faceBox = await detectFaceBoxNormalized(video, w, h);
      if (!faceBox && imageData) {
        const canvas = document.createElement("canvas");
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.putImageData(imageData, 0, 0);
          faceBox = await detectFaceBoxNormalized(canvas, imageData.width, imageData.height);
        }
      }

      const lm = landmarkerRef.current;
      let landmarkerRes: FaceLandmarkerResult | null = null;
      if (lm) {
        try {
          const ts = typeof performance !== "undefined" ? performance.now() : Date.now();
          landmarkerRes = lm.detectForVideo(video, ts);
          if (!faceBox) {
            const pts = landmarkerRes.faceLandmarks?.[0];
            if (pts?.length) {
              faceBox = faceBoxFromLandmarkPoints(pts);
            }
          }
        } catch {
          landmarkerRes = null;
        }
      }

      if (!faceBox && imageData) {
        faceBox = estimateFaceBoxFromSkin(
          imageData.data,
          imageData.width,
          imageData.height
        );
      }

      smoothedBoxRef.current = smoothFaceBox(smoothedBoxRef.current, faceBox);
      const framing = analyzeFaceFraming(
        smoothedBoxRef.current,
        framingStateRef.current
      );
      framingStateRef.current = {
        quality: framing.quality,
        faceFill: framing.faceFill,
      };
      const next = buildCaptureGuidance(lighting, framing, currentZoom);

      if (needsExpressionModel && models.mediapipe === "failed") {
        next.expressionOk = null;
        next.expressionMessage =
          "Expression check unavailable (MediaPipe did not load)";
      } else if (landmarkerRes && needsExpressionModel) {
        try {
          const shapes = landmarkerRes.faceBlendshapes?.[0]?.categories ?? [];
          const get = (name: string) =>
            Number(shapes.find((c: BlendshapeCategory) => c.categoryName === name)?.score ?? 0);
          if (stepId === "eyes_closed") {
            const blink = (get("eyeBlinkLeft") + get("eyeBlinkRight")) / 2;
            const wasOk = expressionOkRef.current === true;
            const ok = wasOk ? blink >= 0.32 : blink >= 0.42;
            expressionOkRef.current = ok;
            next.expressionOk = ok;
            next.expressionMessage = ok
              ? "Eyes closed check looks good"
              : "Please close both eyes gently";
            next.readyToCapture = next.readyToCapture && ok;
          } else if (stepId === "smiling") {
            const smile = Math.max(
              get("mouthSmileLeft"),
              get("mouthSmileRight"),
              get("smile")
            );
            const wasOk = expressionOkRef.current === true;
            const ok = wasOk ? smile >= 0.28 : smile >= 0.34;
            expressionOkRef.current = ok;
            next.expressionOk = ok;
            next.expressionMessage = ok
              ? "Smile check looks good"
              : "Please smile naturally";
            next.readyToCapture = next.readyToCapture && ok;
          }
        } catch {
          next.expressionOk = null;
          next.expressionMessage = "Expression check error — try again";
        }
      } else if (needsExpressionModel && models.mediapipe === "loading") {
        next.expressionOk = null;
        next.expressionMessage = "Loading expression model…";
      }

      setGuidance(next);
    } finally {
      busyRef.current = false;
    }
  }, [videoRef, enabled, currentZoom, stepId, needsExpressionModel, models.mediapipe]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setGuidance(null);
      smoothedBoxRef.current = null;
      framingStateRef.current = null;
      expressionOkRef.current = null;
      return;
    }
    void tick();
    timerRef.current = setInterval(() => void tick(), TICK_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, tick]);

  useEffect(() => {
    expressionOkRef.current = null;
  }, [stepId]);

  const faceDetectionAvailable =
    models.faceDetector === "ready" || models.mediapipe === "ready";

  return {
    guidance,
    models,
    faceDetectionAvailable,
    needsExpressionModel,
  };
}
