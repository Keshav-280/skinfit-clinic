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
import { installMediapipeConsoleFilter } from "@/src/lib/mediapipeConsoleFilter";
import {
  applyCaptureExpression,
  applyCaptureExpressionFromClassifier,
  needsExpressionCheck,
  type ExpressionCalibration,
} from "@/src/lib/captureExpression";
import {
  getWebFaceCaptureConfig,
  needsMediapipeOnClient,
  usesServerFacePreview,
} from "@/src/lib/faceCaptureConfig";
import {
  fetchFacePreviewInference,
  imageDataToJpegBlob,
} from "@/src/lib/fetchFacePreviewInference";

const TICK_MS = 450;
const LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FACE_CAPTURE_CONFIG = getWebFaceCaptureConfig();
const USE_SERVER_PREVIEW = usesServerFacePreview(FACE_CAPTURE_CONFIG);
const MEDIAPIPE_ACTIVE = needsMediapipeOnClient(FACE_CAPTURE_CONFIG);

if (typeof window !== "undefined" && MEDIAPIPE_ACTIVE) {
  installMediapipeConsoleFilter();
}

type CaptureStepId =
  | "centre"
  | "left"
  | "right"
  | "eyes_closed"
  | "smiling";

type BlendshapeCategory = {
  categoryName?: string;
  displayName?: string;
  score?: number;
};
type NormalizedLandmark = { x: number; y: number; z?: number };
type FaceLandmarkerResult = {
  faceLandmarks?: NormalizedLandmark[][];
  faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }>;
};
type FaceLandmarkerLike = {
  detect: (image: HTMLCanvasElement) => FaceLandmarkerResult;
};

function initialModels(): CaptureAssistModels {
  const fd = typeof window !== "undefined" && getBrowserFaceDetector() != null;
  return {
    faceDetector: fd ? "ready" : "unsupported",
    mediapipe: MEDIAPIPE_ACTIVE ? "idle" : "off",
    mediapipeError: undefined,
    retinaface: USE_SERVER_PREVIEW ? "idle" : "off",
    expressionClassifier:
      FACE_CAPTURE_CONFIG.expression === "classifier" ? "idle" : "off",
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
    /** IMAGE mode: per-frame detect() — no VIDEO timestamps (avoids mismatch errors). */
    runningMode: "IMAGE" as const,
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

function canvasFromImageData(
  imageData: ImageData,
  reuse: HTMLCanvasElement | null
): HTMLCanvasElement | null {
  const canvas = reuse ?? document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
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
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBoxRef = useRef<NormalizedFaceBox | null>(null);
  const framingStateRef = useRef<StableFramingState | null>(null);
  const expressionOkRef = useRef<boolean | null>(null);
  const expressionCalibrationRef = useRef<ExpressionCalibration>({
    openEarBaseline: null,
  });
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewBusyRef = useRef(false);
  const lastPreviewAtRef = useRef(0);
  const PREVIEW_MIN_INTERVAL_MS = 750;

  const resetLandmarkerSession = useCallback(() => {
    landmarkerRef.current = null;
    loadingLandmarkerRef.current = false;
    frameCanvasRef.current = null;
  }, []);

  useEffect(() => {
    setModels((m) => ({
      ...m,
      faceDetector: getBrowserFaceDetector() != null ? "ready" : "unsupported",
    }));
  }, []);

  useEffect(() => {
    if (!MEDIAPIPE_ACTIVE) {
      resetLandmarkerSession();
      setModels((m) => ({ ...m, mediapipe: "off", mediapipeError: undefined }));
      return;
    }
    if (!enabled) {
      resetLandmarkerSession();
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
        resetLandmarkerSession();
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
  }, [enabled, resetLandmarkerSession]);

  const needsExpressionModel = needsExpressionCheck(stepId);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current || !enabled) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    busyRef.current = true;
    try {
      const imageData = sampleVideoFrame(video, 160, 200, currentZoom);
      if (!imageData) return;

      const lighting = analyzeLightingFromRgba(
        imageData.data,
        imageData.width,
        imageData.height
      );

      const frameCanvas = canvasFromImageData(imageData, frameCanvasRef.current);
      if (frameCanvas) frameCanvasRef.current = frameCanvas;

      let faceBox: NormalizedFaceBox | null = null;
      if (frameCanvas) {
        faceBox = await detectFaceBoxNormalized(
          frameCanvas,
          imageData.width,
          imageData.height
        );
      }

      let serverPreview: Awaited<ReturnType<typeof fetchFacePreviewInference>> =
        null;
      const now = Date.now();
      if (
        USE_SERVER_PREVIEW &&
        !previewBusyRef.current &&
        now - lastPreviewAtRef.current >= PREVIEW_MIN_INTERVAL_MS
      ) {
        previewBusyRef.current = true;
        lastPreviewAtRef.current = now;
        setModels((m) => ({
          ...m,
          retinaface:
            FACE_CAPTURE_CONFIG.detector === "retinaface" ? "loading" : m.retinaface,
        }));
        try {
          const blob = await imageDataToJpegBlob(imageData);
          if (blob) {
            previewAbortRef.current?.abort();
            previewAbortRef.current = new AbortController();
            serverPreview = await fetchFacePreviewInference(blob, {
              signal: previewAbortRef.current.signal,
            });
          }
        } catch {
          serverPreview = null;
        } finally {
          previewBusyRef.current = false;
        }

        if (FACE_CAPTURE_CONFIG.detector === "retinaface") {
          const rfOk = Boolean(serverPreview?.detectorAvailable && serverPreview.box);
          setModels((m) => ({
            ...m,
            retinaface: rfOk ? "ready" : "failed",
            retinafaceError: rfOk
              ? undefined
              : (serverPreview?.warning ?? "RetinaFace unavailable — using fallback").slice(
                  0,
                  120
                ),
          }));
        }
        if (FACE_CAPTURE_CONFIG.expression === "classifier") {
          const clfOk = Boolean(serverPreview?.expressionAvailable);
          setModels((m) => ({
            ...m,
            expressionClassifier: clfOk
              ? "ready"
              : serverPreview
                ? "failed"
                : "idle",
          }));
        }
      }

      if (
        FACE_CAPTURE_CONFIG.detector === "retinaface" &&
        serverPreview?.box &&
        serverPreview.detectorAvailable
      ) {
        faceBox = serverPreview.box;
      }

      const lm = landmarkerRef.current;
      let landmarkerRes: FaceLandmarkerResult | null = null;
      if (lm && frameCanvas) {
        try {
          landmarkerRes = lm.detect(frameCanvas);
          if (!faceBox) {
            const pts = landmarkerRes.faceLandmarks?.[0];
            if (pts?.length) {
              faceBox = faceBoxFromLandmarkPoints(pts);
            }
          }
        } catch (e) {
          landmarkerRes = null;
          // Don't kill the session on a single detect blip; just log to debug.
          // FaceLandmarker can throw transient errors when video frames are
          // mid-resize or after tab visibility changes.
          if (typeof window !== "undefined") {
            console.debug("[scan] FaceLandmarker.detect skipped:", truncateErr(e));
          }
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
      let next = buildCaptureGuidance(lighting, framing, currentZoom);

      const useClassifier =
        FACE_CAPTURE_CONFIG.expression === "classifier" &&
        Boolean(serverPreview?.expressionAvailable && serverPreview.expression);

      const expressionPipelineActive = useClassifier
        ? true
        : models.mediapipe === "ready" && Boolean(landmarkerRef.current);

      if (needsExpressionModel && useClassifier) {
        next = applyCaptureExpressionFromClassifier(
          next,
          stepId,
          serverPreview!.expression,
          expressionOkRef,
          expressionPipelineActive
        );
      } else if (
        needsExpressionModel &&
        (models.mediapipe === "failed" || models.mediapipe === "off") &&
        !useClassifier
      ) {
        next.expressionOk = null;
        next.expressionMessage =
          "Expression check unavailable right now — capture can continue";
      } else if (needsExpressionModel && models.mediapipe === "loading") {
        next.expressionOk = null;
        next.expressionMessage = "Loading expression model…";
      } else if (needsExpressionModel) {
        const shapes = landmarkerRes?.faceBlendshapes?.[0]?.categories as
          | BlendshapeCategory[]
          | undefined;
        const landmarks = landmarkerRes?.faceLandmarks?.[0];
        next = applyCaptureExpression(
          next,
          stepId,
          shapes,
          expressionOkRef,
          landmarks,
          expressionPipelineActive,
          expressionCalibrationRef.current
        );
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
    expressionCalibrationRef.current = { openEarBaseline: null };
  }, [stepId]);

  const faceDetectionAvailable =
    models.faceDetector === "ready" ||
    models.mediapipe === "ready" ||
    models.retinaface === "ready";

  return {
    guidance,
    models,
    faceDetectionAvailable,
    needsExpressionModel,
  };
}
