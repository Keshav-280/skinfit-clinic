import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ScanCaptureDebugOverlay,
  isCaptureDebugEnabled,
  isCaptureDebugTapEnabled,
} from "@/components/ScanCaptureDebugOverlay";
import { CaptureFaceGuideOverlayNative } from "@/components/capture/CaptureFaceGuideOverlayNative";
import { OnboardingCaptureStepUI } from "@/components/onboarding/OnboardingCaptureStepUI";
import { useMobileScanCaptureGuidance } from "@/hooks/useMobileScanCaptureGuidance";
import {
  CAPTURE_READY_VOICE_HINT,
  captureVoiceGuide,
  isCaptureVoiceSpeechAvailable,
} from "@/lib/captureVoiceGuide";
import { configurePlaybackAudioMode, startAudioPrimingLoop, stopAudioPrimingLoop } from "@/lib/audioSession";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";
import { SKINFIT_GRADIENT } from "@/lib/skinfitTheme";
import {
  applyCaptureAdjustments,
  DEFAULT_CAMERA_ADJUSTMENTS,
  previewOverlayOpacity,
  type CameraAdjustments,
} from "@/lib/cameraCaptureAdjustments";
import { lockedTakePictureAsync } from "@/lib/lockedCameraCapture";
import { prepareCapturedScanPhotoUri } from "@/lib/normalizeScanImage";
import {
  CAPTURE_GUIDANCE_WARMUP_MESSAGE,
  type CaptureGuidanceSnapshot,
} from "@/lib/scanCaptureGuidance";

const NAVY = "#2C3E6B";

/** One short, human guidance line shown during live capture (also spoken by the voice guide). */
function humanGuidanceMessage(
  g: CaptureGuidanceSnapshot | null,
  expressionStep: boolean
): string {
  if (!g) return CAPTURE_GUIDANCE_WARMUP_MESSAGE;
  if (g.lighting !== "good" && g.lightingScore < 60) return g.lightingMessage;
  if (g.face !== "good") return g.faceMessage;
  if (expressionStep && g.expressionOk !== true && g.expressionMessage) {
    return g.expressionMessage;
  }
  if (g.readyToCapture) return "Perfect — hold still and tap capture";
  return "Hold still…";
}
type Props = {
  stepIndex: number;
  onCaptured: (uri: string) => void;
  onPickFromLibrary: () => void;
  onBack: () => void;
  busy?: boolean;
  variant?: "dashboard" | "onboarding";
  previousCaptureUri?: string | null;
};

export function FiveAngleCameraStep({
  stepIndex,
  onCaptured,
  onPickFromLibrary,
  onBack,
  busy,
  variant = "dashboard",
  previousCaptureUri = null,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [showDebug, setShowDebug] = useState(() => isCaptureDebugEnabled());
  const [cameraAdjust, setCameraAdjust] = useState<CameraAdjustments>(
    DEFAULT_CAMERA_ADJUSTMENTS
  );
  const captureDebug = isCaptureDebugEnabled();
  const voiceSpeechAvailable = isCaptureVoiceSpeechAvailable();
  const [voiceEnabled, setVoiceEnabled] = useState(() => voiceSpeechAvailable);

  const step = FACE_SCAN_CAPTURE_STEPS[stepIndex];
  const stepId = step?.id ?? "centre";
  // Eye-closure / expression detection is disabled on mobile — never gate or nag.
  const expressionStep = false;

  const reviewingCapture = pendingUri != null;
  const guidancePaused = busy || shooting || reviewingCapture;
  const {
    guidance,
    models,
    faceTracked,
    bboxSource,
    bboxKind,
    landmarkCount,
    previewAspect,
    mpNativeAvailable,
  } = useMobileScanCaptureGuidance(
    cameraRef,
    true,
    cameraReady,
    cameraAdjust.zoom,
    guidancePaused,
    stepId
  );

  useEffect(() => {
    setCameraReady(false);
  }, [facing]);

  const totalSteps = FACE_SCAN_CAPTURE_STEPS.length;

  const takeShot = useCallback(async () => {
    if (!step) return;
    if (!cameraRef.current || !cameraReady || shooting) return;
    if (!guidance?.readyToCapture) return;
    setShooting(true);
    try {
      const pic = await lockedTakePictureAsync(cameraRef.current, {
        quality: 0.88,
        skipProcessing: true,
      });
      if (pic?.uri) {
        let uri = await prepareCapturedScanPhotoUri(pic.uri, facing);
        uri = await applyCaptureAdjustments(
          uri,
          cameraAdjust.brightness,
          cameraAdjust.exposure
        );
        setPendingUri(uri);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Image could not be captured.";
      Alert.alert(
        "Capture failed",
        msg.includes("simulator")
          ? "Camera capture is not supported on the simulator. Use \"Pick from library\" instead."
          : `${msg} Try again or pick from library.`
      );
    } finally {
      setShooting(false);
    }
  }, [
    step,
    stepId,
    cameraReady,
    shooting,
    facing,
    cameraAdjust.brightness,
    cameraAdjust.exposure,
    cameraAdjust.zoom,
    guidance?.readyToCapture,
  ]);

  useEffect(() => {
    captureVoiceGuide.setEnabled(voiceEnabled && !reviewingCapture);
    if (!voiceEnabled || reviewingCapture) {
      captureVoiceGuide.reset();
      void stopAudioPrimingLoop();
    } else {
      void startAudioPrimingLoop();
    }
    return () => {
      captureVoiceGuide.setEnabled(false);
      void stopAudioPrimingLoop();
    };
  }, [voiceEnabled, reviewingCapture]);

  useEffect(() => {
    if (!voiceEnabled || reviewingCapture || !guidance) return;
    if (guidance.face === "no_face") {
      captureVoiceGuide.speak(guidance.faceMessage, "critical");
      return;
    }
    if (guidance.face !== "good") {
      captureVoiceGuide.speak(guidance.faceMessage, "framing");
      return;
    }
    if (guidance.expressionMessage && guidance.expressionOk === false) {
      captureVoiceGuide.speak(guidance.expressionMessage, "expression");
      return;
    }
    if (guidance.lighting !== "good") {
      captureVoiceGuide.speak(guidance.lightingMessage, "lighting");
      return;
    }
    if (guidance.readyToCapture) {
      captureVoiceGuide.speak(CAPTURE_READY_VOICE_HINT, "ready");
    }
  }, [voiceEnabled, reviewingCapture, guidance]);

  useEffect(() => {
    setPendingUri(null);
    captureVoiceGuide.reset();
  }, [stepIndex]);

  const confirmPendingCapture = useCallback(() => {
    if (!pendingUri) return;
    onCaptured(pendingUri);
    setPendingUri(null);
  }, [pendingUri, onCaptured]);

  const retakePendingCapture = useCallback(() => {
    setPendingUri(null);
  }, []);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  if (!permission.granted) {
    const permBody = (
      <>
        <Ionicons name="camera-outline" size={48} color={NAVY} style={{ marginBottom: 16 }} />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          We need your camera to capture the 5-angle kAI skin scan.
        </Text>
        <Pressable style={styles.btnNavy} onPress={() => void requestPermission()}>
          <Text style={styles.btnNavyText}>Allow Camera</Text>
        </Pressable>
      </>
    );
    return (
      <LinearGradient colors={[...SKINFIT_GRADIENT.scan]} style={styles.center}>
        {permBody}
      </LinearGradient>
    );
  }

  const guidanceReady = guidance?.readyToCapture ?? false;
  const isDisabled =
    busy || shooting || !cameraReady || reviewingCapture || !guidanceReady;
  const previewOverlay = previewOverlayOpacity(
    cameraAdjust.brightness,
    cameraAdjust.exposure
  );

  const cameraPreview = (
    <>
      <CameraView
        key={facing}
        ref={cameraRef}
        style={[styles.onboardingCameraFeed, reviewingCapture && styles.cameraHidden]}
        facing={facing}
        zoom={cameraAdjust.zoom}
        enableTorch={cameraAdjust.torch}
        onCameraReady={() => {
          setCameraReady(true);
          if (voiceEnabled) void startAudioPrimingLoop();
        }}
      />
      {!reviewingCapture && previewOverlay.light > 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(255,255,255,${previewOverlay.light})` },
          ]}
        />
      ) : null}
      {!reviewingCapture && previewOverlay.dark > 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(0,0,0,${previewOverlay.dark})` },
          ]}
        />
      ) : null}
      {pendingUri ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (isCaptureDebugTapEnabled()) setShowDebug((v) => !v);
          }}
          disabled={!isCaptureDebugTapEnabled()}
          accessibilityRole="button"
          accessibilityLabel={
            isCaptureDebugTapEnabled()
              ? "Toggle capture debug"
              : `Captured ${step?.title ?? "photo"}`
          }
        >
          <Image
            source={{ uri: pendingUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </Pressable>
      ) : null}
      {!reviewingCapture && !cameraReady ? (
        <View style={styles.cameraLoading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.cameraLoadingText}>Starting camera…</Text>
        </View>
      ) : null}
    </>
  );

  if (!step) return null;

  return (
    <OnboardingCaptureStepUI
      step={step}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      viewfinder={
        <View style={styles.onboardingViewfinder}>
          {cameraPreview}
          {!reviewingCapture ? (
            <CaptureFaceGuideOverlayNative stepId={stepId} />
          ) : null}
          <ScanCaptureDebugOverlay
            guidance={guidance}
            captureZoom={cameraAdjust.zoom}
            models={models}
            faceTracked={faceTracked}
            mpNativeAvailable={mpNativeAvailable}
            landmarkCount={landmarkCount}
            insetTop={8}
            visible={showDebug}
            extra={{
              step: `${stepIndex + 1}/${totalSteps}`,
              bbox: bboxSource,
              box: bboxKind,
              preview: previewAspect,
            }}
          />
        </View>
      }
      previousCaptureUri={previousCaptureUri}
      reviewingCapture={reviewingCapture}
      shooting={shooting}
      shutterDisabled={isDisabled}
      guidance={guidance}
      guidanceMessage={humanGuidanceMessage(guidance, expressionStep)}
      guidanceReady={guidance?.readyToCapture ?? false}
      voiceEnabled={voiceEnabled}
      voiceAvailable={voiceSpeechAvailable}
      onToggleVoice={() => setVoiceEnabled((v) => !v)}
      showDebug={showDebug}
      onToggleDebug={() => setShowDebug((v) => !v)}
      onBack={onBack}
      onShutter={() => void takeShot()}
      onFlip={() => setFacing((f) => (f === "front" ? "back" : "front"))}
      onRetake={retakePendingCapture}
      onConfirm={confirmPendingCapture}
      isLastStep={stepIndex + 1 >= totalSteps}
      onPickFromLibrary={onPickFromLibrary}
      cameraReady={cameraReady}
      showGuidanceBanner
      showVoiceToggle={voiceSpeechAvailable}
      showDevControls={__DEV__ || captureDebug}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  onboardingViewfinder: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  /** Fill fixed portrait viewfinder; parent clips overflow. */
  onboardingCameraFeed: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraHidden: { opacity: 0 },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    gap: 10,
  },
  cameraLoadingText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
  },
  reviewHint: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reviewHintText: {
    color: "#fff",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnOutlineText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  permTitle: { fontSize: 20, fontWeight: "700", color: "#1A1A2E", marginBottom: 8 },
  permSub: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerBtn: { width: 40, alignItems: "center" },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 88,
    justifyContent: "flex-end",
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconCircleActive: {
    backgroundColor: "rgba(52,211,153,0.45)",
  },
  guidePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    maxWidth: 420,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  guidePillReady: {
    backgroundColor: "rgba(6,78,59,0.7)",
  },
  guideText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    color: "#fff",
    textAlign: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  instructionWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 10,
  },
  instructionCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepKicker: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.75)",
  },
  stepTitle: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  stepInstruction: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.92)",
  },
  tipsWrap: {
    gap: 2,
    paddingHorizontal: 2,
  },
  tipText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 14,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 10,
  },
  zoomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  zoomLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  autoZoomToggle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    textDecorationLine: "underline",
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  zoomFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 3,
  },
  btnNavy: {
    backgroundColor: NAVY,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  btnNavyText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  libraryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  libraryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  disabled: { opacity: 0.45 },
});
