"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeFaceFraming,
  analyzeLightingFromRgba,
  buildCaptureGuidance,
  detectFaceBoxNormalized,
  estimateFaceBoxFromSkin,
  sampleVideoFrame,
  smoothFaceBox,
  type CaptureGuidanceSnapshot,
  type NormalizedFaceBox,
  type StableFramingState,
} from "@/src/lib/scanCaptureGuidance";

const TICK_MS = 450;
const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type CaptureStepId =
  | "centre"
  | "left"
  | "right"
  | "eyes_closed"
  | "smiling";

type BlendshapeCategory = { categoryName: string; score: number };
type FaceLandmarkerResult = {
  faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }>;
};
type FaceLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerResult;
};

export function useWebScanCaptureGuidance(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  currentZoom: number,
  stepId: CaptureStepId
) {
  const [guidance, setGuidance] = useState<CaptureGuidanceSnapshot | null>(null);
  const [faceDetectionAvailable, setFaceDetectionAvailable] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const loadingLandmarkerRef = useRef(false);
  const smoothedBoxRef = useRef<NormalizedFaceBox | null>(null);
  const framingStateRef = useRef<StableFramingState | null>(null);
  const expressionOkRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setFaceDetectionAvailable(
      "FaceDetector" in window &&
        typeof (window as Window & { FaceDetector?: unknown }).FaceDetector ===
          "function"
    );
  }, []);

  useEffect(() => {
    if (!enabled || (stepId !== "eyes_closed" && stepId !== "smiling")) return;
    if (landmarkerRef.current || loadingLandmarkerRef.current) return;
    loadingLandmarkerRef.current = true;
    void (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
        const lm = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: LANDMARKER_MODEL },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
        landmarkerRef.current = lm;
      } catch {
        landmarkerRef.current = null;
      } finally {
        loadingLandmarkerRef.current = false;
      }
    })();
  }, [enabled, stepId]);

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
      const lm = landmarkerRef.current;
      if (lm && (stepId === "eyes_closed" || stepId === "smiling")) {
        try {
          const ts = typeof performance !== "undefined" ? performance.now() : Date.now();
          const res = lm.detectForVideo(video, ts);
          const shapes = res?.faceBlendshapes?.[0]?.categories ?? [];
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
          next.expressionMessage = null;
        }
      }
      setGuidance(next);
    } finally {
      busyRef.current = false;
    }
  }, [videoRef, enabled, currentZoom, stepId]);

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

  return { guidance, faceDetectionAvailable };
}
