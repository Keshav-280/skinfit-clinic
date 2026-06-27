"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeFaceFraming,
  analyzeLightingFromRgba,
  averageFaceBoxes,
  buildCaptureGuidance,
  CAPTURE_GUIDANCE_SETTLE_MS,
  detectFaceBoxNormalized,
  estimateFaceBoxFromSkin,
  faceBoxFromLandmarkPoints,
  isUsableFaceBox,
  getBrowserFaceDetector,
  mediapipeWasmRoot,
  sampleVideoFrame,
  smoothFaceBox,
  type CaptureAssistModels,
  type CaptureGuidanceSnapshot,
  type NormalizedFaceBox,
  type StableFramingState,
} from "@/src/lib/scanCaptureGuidance";
import { smoothLandmarks } from "@/src/lib/faceMeshOutline";
import { installMediapipeConsoleFilter } from "@/src/lib/mediapipeConsoleFilter";
import {
  applyCaptureExpression,
  applyCaptureExpressionFromClassifier,
  needsExpressionCheck,
  type ExpressionCalibration,
} from "@/src/lib/captureExpression";
import {
  createBlazeFaceDetector,
  faceBoxFromBlazeDetections,
  type BlazeFaceDetectorLike,
} from "@/src/lib/mediapipeBlazeFaceDetector";
import {
  getWebFaceCaptureConfig,
  isMediapipeEnabled,
  needsMediapipeOnClient,
  shouldTryServerPreviewOnClient,
} from "@/src/lib/faceCaptureConfig";
import {
  fetchFacePreviewInference,
  imageDataToJpegBlob,
} from "@/src/lib/fetchFacePreviewInference";

const TICK_MS = 150;
/** Hold the last seen landmarks for this long if MediaPipe drops a frame. */
const LANDMARK_HOLD_MS = 1400;
const PREVIEW_W = 320;
const PREVIEW_H = 400;
const LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FACE_CAPTURE_CONFIG = getWebFaceCaptureConfig();
const TRY_SERVER_PREVIEW = shouldTryServerPreviewOnClient(FACE_CAPTURE_CONFIG);
const MEDIAPIPE_ACTIVE = needsMediapipeOnClient(FACE_CAPTURE_CONFIG);
const BLAZE_FACE_ACTIVE = isMediapipeEnabled();

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
    blazeFace: BLAZE_FACE_ACTIVE ? "idle" : "off",
    mediapipe: MEDIAPIPE_ACTIVE ? "idle" : "off",
    mediapipeError: undefined,
    retinaface: TRY_SERVER_PREVIEW ? "idle" : "off",
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
    /** Lower-confidence thresholds = more robust with specs / reflections. */
    minFaceDetectionConfidence: 0.3,
    minFacePresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
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
  stepId: CaptureStepId,
  /** Match preview/capture brightness & contrast so guidance reflects adjusted image. */
  previewFilter = "brightness(100%) contrast(100%)"
) {
  const [guidance, setGuidance] = useState<CaptureGuidanceSnapshot | null>(null);
  const [faceLandmarks, setFaceLandmarks] = useState<NormalizedLandmark[] | null>(
    null
  );
  const [faceTracked, setFaceTracked] = useState(false);
  const [models, setModels] = useState<CaptureAssistModels>(initialModels);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const blazeDetectorRef = useRef<BlazeFaceDetectorLike | null>(null);
  const loadingLandmarkerRef = useRef(false);
  const loadingBlazeRef = useRef(false);
  const [bboxSource, setBboxSource] = useState<string>("—");
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBoxRef = useRef<NormalizedFaceBox | null>(null);
  const faceMissRef = useRef(0);
  const smoothedLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const lastLandmarkAtRef = useRef<number>(0);
  const framingStateRef = useRef<StableFramingState | null>(null);
  const expressionOkRef = useRef<boolean | null>(null);
  const expressionCalibrationRef = useRef<ExpressionCalibration>({
    openEarBaseline: null,
  });
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewBusyRef = useRef(false);
  const lastPreviewAtRef = useRef(0);
  const PREVIEW_MIN_INTERVAL_MS = 750;
  const frameSamplesRef = useRef<
    Array<{
      faceBox: NormalizedFaceBox | null;
      lighting: ReturnType<typeof analyzeLightingFromRgba>;
      landmarkerRes: FaceLandmarkerResult | null;
    }>
  >([]);
  const lastGuidancePublishRef = useRef(0);

  const resetLandmarkerSession = useCallback(() => {
    landmarkerRef.current = null;
    blazeDetectorRef.current = null;
    loadingLandmarkerRef.current = false;
    loadingBlazeRef.current = false;
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

  useEffect(() => {
    if (!BLAZE_FACE_ACTIVE) {
      blazeDetectorRef.current = null;
      loadingBlazeRef.current = false;
      setModels((m) => ({ ...m, blazeFace: "off" }));
      return;
    }
    if (!enabled) {
      blazeDetectorRef.current = null;
      loadingBlazeRef.current = false;
      setModels((m) => ({ ...m, blazeFace: "idle" }));
      return;
    }
    if (blazeDetectorRef.current) {
      setModels((m) => ({ ...m, blazeFace: "ready" }));
      return;
    }
    if (loadingBlazeRef.current) return;

    loadingBlazeRef.current = true;
    setModels((m) => ({ ...m, blazeFace: "loading" }));

    void (async () => {
      try {
        blazeDetectorRef.current = await createBlazeFaceDetector();
        setModels((m) => ({ ...m, blazeFace: "ready" }));
      } catch (e) {
        blazeDetectorRef.current = null;
        setModels((m) => ({ ...m, blazeFace: "failed" }));
        if (process.env.NODE_ENV === "development") {
          console.error("[scan] BlazeFace load failed:", e);
        }
      } finally {
        loadingBlazeRef.current = false;
      }
    })();
  }, [enabled]);

  const needsExpressionModel = needsExpressionCheck(stepId);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current || !enabled) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    busyRef.current = true;
    try {
      const imageData = sampleVideoFrame(
        video,
        PREVIEW_W,
        PREVIEW_H,
        currentZoom,
        previewFilter
      );
      if (!imageData) return;

      const lighting = analyzeLightingFromRgba(
        imageData.data,
        imageData.width,
        imageData.height
      );

      const frameCanvas = canvasFromImageData(imageData, frameCanvasRef.current);
      if (frameCanvas) frameCanvasRef.current = frameCanvas;

      const mpReady = models.mediapipe === "ready";
      const blazeReady = models.blazeFace === "ready";
      let faceBox: NormalizedFaceBox | null = null;
      let landmarkBox: NormalizedFaceBox | null = null;
      let source = "—";

      let serverPreview: Awaited<ReturnType<typeof fetchFacePreviewInference>> =
        null;
      const now = Date.now();
      if (
        TRY_SERVER_PREVIEW &&
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

        if (FACE_CAPTURE_CONFIG.detector === "retinaface" || serverPreview?.detectorAvailable) {
          const rfOk = Boolean(serverPreview?.detectorAvailable && serverPreview.box);
          setModels((m) => ({
            ...m,
            retinaface: rfOk ? "ready" : serverPreview ? "failed" : m.retinaface,
            retinafaceError: rfOk
              ? undefined
              : (serverPreview?.warning ?? "RetinaFace unavailable").slice(0, 120),
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

      const lm = landmarkerRef.current;
      let landmarkerRes: FaceLandmarkerResult | null = null;
      if (lm && frameCanvas) {
        try {
          landmarkerRes = lm.detect(frameCanvas);
          const pts = landmarkerRes.faceLandmarks?.[0];
          if (pts?.length) {
            landmarkBox = faceBoxFromLandmarkPoints(pts);
          }
        } catch (e) {
          landmarkerRes = null;
          if (typeof window !== "undefined") {
            console.debug("[scan] FaceLandmarker.detect skipped:", truncateErr(e));
          }
        }
      }

      if (serverPreview?.box && serverPreview.detectorAvailable) {
        faceBox = serverPreview.box;
        source = "retinaface";
      } else if (blazeReady && blazeDetectorRef.current && frameCanvas) {
        try {
          const blazeRes = blazeDetectorRef.current.detect(frameCanvas);
          const blazeBox = faceBoxFromBlazeDetections(
            blazeRes.detections,
            frameCanvas.width,
            frameCanvas.height
          );
          if (blazeBox) {
            faceBox = blazeBox;
            source = "blaze";
          }
        } catch {
          /* keep prior smoothed box */
        }
      } else if (landmarkBox) {
        faceBox = landmarkBox;
        source = "landmark";
      }

      if (!faceBox && !mpReady && !blazeReady && frameCanvas) {
        faceBox = await detectFaceBoxNormalized(
          frameCanvas,
          imageData.width,
          imageData.height
        );
        if (faceBox) source = "browser";
      }

      if (!faceBox && !mpReady && !blazeReady && imageData) {
        faceBox = estimateFaceBoxFromSkin(
          imageData.data,
          imageData.width,
          imageData.height
        );
        if (faceBox) source = "skin";
      }

      if (faceBox) setBboxSource(source);
      else if (smoothedBoxRef.current) setBboxSource("hold");

      const mpOutline = landmarkerRes?.faceLandmarks?.[0] ?? null;
      if (mpOutline?.length) {
        const smoothed = smoothLandmarks(
          smoothedLandmarksRef.current,
          mpOutline,
          0.5
        );
        smoothedLandmarksRef.current = smoothed;
        lastLandmarkAtRef.current = now;
        setFaceLandmarks(smoothed);
      } else if (
        smoothedLandmarksRef.current &&
        now - lastLandmarkAtRef.current < LANDMARK_HOLD_MS
      ) {
        setFaceLandmarks(smoothedLandmarksRef.current);
      } else {
        smoothedLandmarksRef.current = null;
        setFaceLandmarks(null);
      }

      // Drop the stale face box after a few empty frames (e.g. camera covered or
      // user stepped away) so framing honestly reports "no face" instead of
      // holding the last good box and falsely staying "ready".
      const MAX_FACE_MISSES = 3;
      if (faceBox) {
        faceMissRef.current = 0;
        smoothedBoxRef.current = smoothFaceBox(smoothedBoxRef.current, faceBox);
      } else {
        faceMissRef.current += 1;
        if (faceMissRef.current >= MAX_FACE_MISSES) {
          smoothedBoxRef.current = null;
        }
      }
      setFaceTracked(
        Boolean(
          smoothedLandmarksRef.current?.length ||
            isUsableFaceBox(smoothedBoxRef.current)
        )
      );

      frameSamplesRef.current.push({
        faceBox: smoothedBoxRef.current,
        lighting,
        landmarkerRes,
      });
      if (frameSamplesRef.current.length > 24) {
        frameSamplesRef.current.shift();
      }

      const publishNow =
        lastGuidancePublishRef.current === 0 ||
        now - lastGuidancePublishRef.current >= CAPTURE_GUIDANCE_SETTLE_MS;

      if (publishNow) {
        lastGuidancePublishRef.current = now;
        const avgBox = averageFaceBoxes(
          frameSamplesRef.current.map((s) => s.faceBox)
        );
        const lastLighting =
          frameSamplesRef.current[frameSamplesRef.current.length - 1]?.lighting ??
          lighting;
        const framing = analyzeFaceFraming(avgBox, framingStateRef.current);
        framingStateRef.current = {
          quality: framing.quality,
          faceFill: framing.faceFill,
        };
        let next = buildCaptureGuidance(lastLighting, framing, currentZoom);

        const useClassifier =
          FACE_CAPTURE_CONFIG.expression === "classifier" &&
          Boolean(serverPreview?.expressionAvailable && serverPreview.expression);

        const expressionPipelineActive = useClassifier
          ? true
          : models.mediapipe === "ready" && Boolean(landmarkerRef.current);

        const latestMp =
          frameSamplesRef.current[frameSamplesRef.current.length - 1]
            ?.landmarkerRes ?? landmarkerRes;

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
          const shapes = latestMp?.faceBlendshapes?.[0]?.categories as
            | BlendshapeCategory[]
            | undefined;
          const landmarks = latestMp?.faceLandmarks?.[0];
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
      }
    } finally {
      busyRef.current = false;
    }
  }, [
    videoRef,
    enabled,
    currentZoom,
    stepId,
    needsExpressionModel,
    models.mediapipe,
    models.blazeFace,
    previewFilter,
  ]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setGuidance(null);
      setFaceLandmarks(null);
      setFaceTracked(false);
      smoothedBoxRef.current = null;
      smoothedLandmarksRef.current = null;
      faceMissRef.current = 0;
      lastLandmarkAtRef.current = 0;
      framingStateRef.current = null;
      expressionOkRef.current = null;
      frameSamplesRef.current = [];
      lastGuidancePublishRef.current = 0;
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
    frameSamplesRef.current = [];
    lastGuidancePublishRef.current = 0;
  }, [stepId]);

  const faceDetectionAvailable =
    models.faceDetector === "ready" ||
    models.blazeFace === "ready" ||
    models.mediapipe === "ready" ||
    models.retinaface === "ready";

  return {
    guidance,
    models,
    faceDetectionAvailable,
    needsExpressionModel,
    faceLandmarks,
    faceTracked,
    bboxSource,
  };
}
