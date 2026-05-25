import { CameraView } from "expo-camera";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import {
  analyzePreviewImageUri,
  type PreviewGuidanceState,
} from "@/lib/analyzePreviewJpeg";
import { needsMediapipeOnClient, getMobileFaceCaptureConfig } from "@/lib/faceCaptureConfig";
import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import { needsExpressionCheck } from "@/lib/captureExpression";
import { isNativeFaceLandmarkAvailable } from "@/lib/nativeFaceLandmarkDetection";
import type { CaptureGuidanceSnapshot } from "@/lib/scanCaptureGuidance";

const TICK_MS = 1000;
const EXPRESSION_TICK_MS = 650;

type CameraRef = RefObject<CameraView | null>;

export function useMobileScanCaptureGuidance(
  cameraRef: CameraRef,
  enabled: boolean,
  cameraReady: boolean,
  currentZoom: number,
  paused: boolean,
  stepId: FaceScanCaptureId
) {
  const [guidance, setGuidance] = useState<CaptureGuidanceSnapshot | null>(null);
  const { token } = useAuth();
  const captureCfg = getMobileFaceCaptureConfig();
  const needsMp = needsMediapipeOnClient(captureCfg);
  const [landmarkDetectionEnabled, setLandmarkDetectionEnabled] = useState(false);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewStateRef = useRef<PreviewGuidanceState>({
    smoothedBox: null,
    framing: null,
    expressionCalibration: { openEarBaseline: null },
  });
  const expressionOkRef = useRef<boolean | null>(null);

  const expressionStep = needsExpressionCheck(stepId);
  const tickMs = expressionStep ? EXPRESSION_TICK_MS : TICK_MS;

  useEffect(() => {
    if (!needsMp) {
      setLandmarkDetectionEnabled(false);
      return;
    }
    if (Platform.OS === "web") {
      setLandmarkDetectionEnabled(true);
      return;
    }
    setLandmarkDetectionEnabled(isNativeFaceLandmarkAvailable());
  }, [needsMp]);

  useEffect(() => {
    expressionOkRef.current = null;
    previewStateRef.current = {
      smoothedBox: null,
      framing: null,
      expressionCalibration: { openEarBaseline: null },
    };
    setGuidance(null);
  }, [stepId]);

  const tick = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam || !cameraReady || !enabled || paused || busyRef.current) return;

    busyRef.current = true;
    try {
      const pic = await cam.takePictureAsync({
        quality: expressionStep ? 0.55 : 0.38,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!pic?.uri) return;

      const { guidance: next, state } = await analyzePreviewImageUri(
        pic.uri,
        currentZoom,
        previewStateRef.current,
        {
          stepId,
          landmarkDetectionEnabled,
          expressionOkRef,
          authToken: token,
        }
      );
      previewStateRef.current = state;
      if (next) setGuidance(next);
    } catch {
      /* preview sample failed — keep last guidance */
    } finally {
      busyRef.current = false;
    }
  }, [
    cameraRef,
    cameraReady,
    enabled,
    paused,
    currentZoom,
    stepId,
    landmarkDetectionEnabled,
    expressionStep,
    token,
  ]);

  useEffect(() => {
    if (!enabled || !cameraReady || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      if (!enabled) {
        setGuidance(null);
        previewStateRef.current = {
          smoothedBox: null,
          framing: null,
          expressionCalibration: { openEarBaseline: null },
        };
        expressionOkRef.current = null;
      }
      return;
    }

    void tick();
    timerRef.current = setInterval(() => void tick(), tickMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, cameraReady, paused, tick, tickMs]);

  const faceCheckLive = Boolean(guidance?.showFaceCheck);

  return {
    guidance,
    faceCheckLive,
    landmarkDetectionEnabled,
  };
}
