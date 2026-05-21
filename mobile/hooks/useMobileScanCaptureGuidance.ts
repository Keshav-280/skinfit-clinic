import { CameraView } from "expo-camera";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import {
  analyzePreviewImageUri,
  type PreviewGuidanceState,
} from "@/lib/analyzePreviewJpeg";
import type { CaptureGuidanceSnapshot } from "@/lib/scanCaptureGuidance";

const TICK_MS = 1300;

type CameraRef = RefObject<CameraView | null>;

export function useMobileScanCaptureGuidance(
  cameraRef: CameraRef,
  enabled: boolean,
  cameraReady: boolean,
  currentZoom: number,
  paused: boolean
) {
  const [guidance, setGuidance] = useState<CaptureGuidanceSnapshot | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewStateRef = useRef<PreviewGuidanceState>({
    smoothedBox: null,
    framing: null,
  });

  const tick = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam || !cameraReady || !enabled || paused || busyRef.current) return;

    busyRef.current = true;
    setAnalyzing(true);
    try {
      const pic = await cam.takePictureAsync({
        quality: 0.12,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!pic?.uri) return;

      const { guidance: next, state } = await analyzePreviewImageUri(
        pic.uri,
        currentZoom,
        previewStateRef.current
      );
      previewStateRef.current = state;
      if (next) setGuidance(next);
    } catch {
      /* preview sample failed — keep last guidance */
    } finally {
      busyRef.current = false;
      setAnalyzing(false);
    }
  }, [cameraRef, cameraReady, enabled, paused, currentZoom]);

  useEffect(() => {
    if (!enabled || !cameraReady || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      if (!enabled) {
        setGuidance(null);
        previewStateRef.current = { smoothedBox: null, framing: null };
      }
      return;
    }

    void tick();
    timerRef.current = setInterval(() => void tick(), TICK_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, cameraReady, paused, tick]);

  return { guidance, analyzing, faceDetectionAvailable: true };
}
