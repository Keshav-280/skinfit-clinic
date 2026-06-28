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
import {
  CAPTURE_STEP_WARMUP_MS,
  type CaptureAssistModels,
  type CaptureGuidanceSnapshot,
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
  const warmupUntilRef = useRef(0);
  const wasInWarmupRef = useRef(false);
  const warningSwitchingUntilRef = useRef<number>(0);
  const prevPublishedGuidanceRef = useRef<CaptureGuidanceSnapshot | null>(null);
  const [models, setModels] = useState<CaptureAssistModels>(() =>
    initialMobileModels(captureCfg, needsMp, false)
  );

  const beginStepWarmup = useCallback(() => {
    warmupUntilRef.current = Date.now() + CAPTURE_STEP_WARMUP_MS;
    wasInWarmupRef.current = true;
    setGuidance(null);
    setFaceLandmarks(null);
    previewStateRef.current = {
      smoothedBox: null,
      framing: null,
      expressionCalibration: { openEarBaseline: null },
      faceLandmarks: null,
    };
    expressionOkRef.current = null;
    mpMissStreakRef.current = 0;
    setBboxSource("—");
    setBboxKind("—");
    setLandmarkCount(0);
    setPreviewAspect("—");
    warningSwitchingUntilRef.current = 0;
    prevPublishedGuidanceRef.current = null;
  }, []);

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
    beginStepWarmup();
    setModels(initialMobileModels(captureCfg, needsMp, landmarkDetectionEnabled));
  }, [stepId, needsMp, landmarkDetectionEnabled, captureCfg, beginStepWarmup]);

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

      const now = Date.now();
      const inWarmup = now < warmupUntilRef.current;
      if (wasInWarmupRef.current && !inWarmup) {
        wasInWarmupRef.current = false;
        previewStateRef.current = {
          smoothedBox: null,
          framing: null,
          expressionCalibration: { openEarBaseline: null },
          faceLandmarks: null,
        };
        setFaceLandmarks(null);
      } else if (inWarmup) {
        wasInWarmupRef.current = true;
      }

      if (!inWarmup && next) {
        let finalGuidance = next;
        const prev = prevPublishedGuidanceRef.current;
        const isWarningTypeChanged = Boolean(
          prev &&
            !prev.readyToCapture &&
            !finalGuidance.readyToCapture &&
            (prev.face !== finalGuidance.face || prev.lighting !== finalGuidance.lighting)
        );

        if (isWarningTypeChanged) {
          if (warningSwitchingUntilRef.current === 0) {
            warningSwitchingUntilRef.current = now + 1200; // 1.2s delay to settle
          }
        } else if (finalGuidance.readyToCapture) {
          warningSwitchingUntilRef.current = 0;
        }

        if (warningSwitchingUntilRef.current > 0) {
          if (now < warningSwitchingUntilRef.current) {
            // Override message to "Checking camera feed…" and do not speak it
            finalGuidance = {
              ...finalGuidance,
              faceMessage: "Checking camera feed…",
              lightingMessage: "Checking camera feed…",
              readyToCapture: false,
            };
          } else {
            // Settle time has passed, publish actual new warning
            warningSwitchingUntilRef.current = 0;
          }
        }

        prevPublishedGuidanceRef.current = finalGuidance;
        setGuidance(finalGuidance);
      }
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

  const prevPausedRef = useRef(paused);
  useEffect(() => {
    if (!paused && prevPausedRef.current) {
      beginStepWarmup();
    }
    prevPausedRef.current = paused;
  }, [paused, beginStepWarmup]);

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
