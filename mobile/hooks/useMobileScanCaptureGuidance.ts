import { CameraView } from "expo-camera";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Platform } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import {
  analyzePreviewImageUri,
  type PreviewGuidanceState,
} from "@/lib/analyzePreviewJpeg";
import {
  getMobileFaceCaptureConfig,
  needsMediapipeOnClient,
  shouldTryServerPreviewOnClient,
  usesServerFacePreview,
} from "@/lib/faceCaptureConfig";
import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import { needsExpressionCheck } from "@/lib/captureExpression";
import { isNativeFaceLandmarkAvailable } from "@/lib/nativeFaceLandmarkDetection";
import { lockedTakePictureAsync } from "@/lib/lockedCameraCapture";
import type {
  CaptureAssistModels,
  CaptureGuidanceSnapshot,
} from "@/lib/scanCaptureGuidance";

/** Faster ticks for responsive guidance — reduced from 1100ms. */
const TICK_MS = 450;
const EXPRESSION_TICK_MS = 350;

type CameraRef = RefObject<CameraView | null>;

function initialMobileModels(
  cfg: ReturnType<typeof getMobileFaceCaptureConfig>,
  needsMp: boolean,
  landmarkDetectionEnabled: boolean
): CaptureAssistModels {
  const serverOn =
    usesServerFacePreview(cfg) || shouldTryServerPreviewOnClient(cfg);
  return {
    faceDetector: "unsupported",
    blazeFace: "off",
    mediapipe:
      needsMp && landmarkDetectionEnabled
        ? "idle"
        : needsMp
          ? "off"
          : "off",
    mediapipeError: undefined,
    retinaface: serverOn ? "idle" : "off",
    expressionClassifier:
      cfg.expression === "classifier" ? "idle" : needsMp ? "idle" : "off",
  };
}

export function useMobileScanCaptureGuidance(
  cameraRef: CameraRef,
  enabled: boolean,
  cameraReady: boolean,
  currentZoom: number,
  paused: boolean,
  stepId: FaceScanCaptureId
) {
  const [guidance, setGuidance] = useState<CaptureGuidanceSnapshot | null>(null);
  const [faceLandmarks, setFaceLandmarks] = useState<Array<{ x: number; y: number }> | null>(
    null
  );
  const [bboxSource, setBboxSource] = useState("—");
  const [bboxKind, setBboxKind] = useState("—");
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [previewAspect, setPreviewAspect] = useState("—");
  const { token } = useAuth();
  const captureCfg = useMemo(() => getMobileFaceCaptureConfig(), []);
  const needsMp = needsMediapipeOnClient(captureCfg);
  const [landmarkDetectionEnabled, setLandmarkDetectionEnabled] = useState(false);
  const busyRef = useRef(false);
  const mpMissStreakRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewStateRef = useRef<PreviewGuidanceState>({
    smoothedBox: null,
    framing: null,
    expressionCalibration: { openEarBaseline: null },
    faceLandmarks: null,
  });
  const expressionOkRef = useRef<boolean | null>(null);
  const [models, setModels] = useState<CaptureAssistModels>(() =>
    initialMobileModels(captureCfg, needsMp, false)
  );

  const expressionStep = needsExpressionCheck();
  const needsExpressionModel = expressionStep && needsMp;
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
      faceLandmarks: null,
    };
    setGuidance(null);
    setFaceLandmarks(null);
    setBboxSource("—");
    setBboxKind("—");
    setLandmarkCount(0);
    setPreviewAspect("—");
    mpMissStreakRef.current = 0;
    setModels(initialMobileModels(captureCfg, needsMp, landmarkDetectionEnabled));
  }, [stepId, needsMp, landmarkDetectionEnabled, captureCfg]);

  const tick = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam || !cameraReady || !enabled || paused || busyRef.current) return;

    busyRef.current = true;
    try {
      const pic = await lockedTakePictureAsync(cam, {
        quality: expressionStep ? 0.45 : 0.25,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!pic?.uri) return;

      const { guidance: next, state, meta } = await analyzePreviewImageUri(
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
      setFaceLandmarks(state.faceLandmarks);
      if (next) setGuidance(next);
      if (meta) {
        setBboxSource(meta.bboxSource);
        setBboxKind(meta.bboxKind);
        setLandmarkCount(meta.landmarkCount);
        setPreviewAspect(meta.previewAspect);
        setModels((prev) => {
          let mediapipe = prev.mediapipe;
          let mediapipeError = prev.mediapipeError;
          if (!needsMp) {
            mediapipe = "off";
            mediapipeError = undefined;
          } else if (!landmarkDetectionEnabled) {
            mediapipe = "failed";
            mediapipeError =
              "FaceLandmarkDetection native module missing — rebuild dev client: cd mobile && npx expo run:ios --device (not Expo Go)";
          } else if (!meta.landmarkPipelineActive) {
            mediapipe = "off";
            mediapipeError = undefined;
          } else if ((meta.landmarkCount ?? 0) > 0) {
            mpMissStreakRef.current = 0;
            mediapipe = "ready";
            mediapipeError = undefined;
          } else if (
            meta.bboxSource === "mp-fallback-server" ||
            meta.bboxSource === "mp-fallback-skin"
          ) {
            mpMissStreakRef.current += 1;
            mediapipe = "failed";
            mediapipeError =
              "No on-device landmarks — using fallback bbox (check model bundle / lighting)";
          } else {
            mpMissStreakRef.current += 1;
            if (mpMissStreakRef.current >= 4) {
              mediapipe = "failed";
              mediapipeError =
                "No landmarks — run: cd mobile && npm run mediapipe:verify-model && npx expo prebuild --clean";
            } else {
              mediapipe = "loading";
              mediapipeError = undefined;
            }
          }
          return {
          ...prev,
          mediapipe,
          mediapipeError,
          retinaface:
            prev.retinaface === "off"
              ? "off"
              : meta.serverDetectorUsed
                ? "ready"
                : prev.retinaface === "ready"
                  ? "ready"
                  : "loading",
          expressionClassifier:
            prev.expressionClassifier === "off"
              ? "off"
              : meta.expressionClassifierUsed
                ? "ready"
                : expressionStep
                  ? prev.expressionClassifier === "ready"
                    ? "ready"
                    : "idle"
                  : "off",
        };
        });
      }
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
    needsMp,
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
          faceLandmarks: null,
        };
        setFaceLandmarks(null);
        expressionOkRef.current = null;
        setBboxSource("—");
        setBboxKind("—");
        setLandmarkCount(0);
        setPreviewAspect("—");
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

  /** Resume guidance immediately after preview / step change (do not wait for next interval). */
  useEffect(() => {
    if (!enabled || !cameraReady || paused) return;
    void tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid extra ticks on every zoom change
  }, [enabled, cameraReady, paused, stepId]);

  const faceCheckLive = Boolean(guidance?.showFaceCheck ?? guidance?.faceFill != null);
  const faceTracked = Boolean(faceLandmarks?.length);

  return {
    guidance,
    models,
    faceCheckLive,
    faceTracked,
    bboxSource,
    bboxKind,
    landmarkCount,
    previewAspect,
    needsExpressionModel,
    landmarkDetectionEnabled,
    mpNativeAvailable: landmarkDetectionEnabled,
    faceLandmarks,
  };
}
