import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScanCameraAdjustPanel } from "@/components/ScanCameraAdjustPanel";
import {
  ScanCaptureDebugOverlay,
  isCaptureDebugEnabled,
} from "@/components/ScanCaptureDebugOverlay";
import { ScanCaptureStepTicks } from "@/components/ScanCaptureStepTicks";
import { useMobileScanCaptureGuidance } from "@/hooks/useMobileScanCaptureGuidance";
import {
  CAPTURE_READY_VOICE_HINT,
  captureVoiceGuide,
  isCaptureVoiceSpeechAvailable,
} from "@/lib/captureVoiceGuide";
import { configurePlaybackAudioMode, startAudioPrimingLoop, stopAudioPrimingLoop } from "@/lib/audioSession";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";
import {
  applyCaptureAdjustments,
  DEFAULT_CAMERA_ADJUSTMENTS,
  previewOverlayOpacity,
  type CameraAdjustments,
} from "@/lib/cameraCaptureAdjustments";
import { lockedTakePictureAsync } from "@/lib/lockedCameraCapture";
import { prepareCapturedScanPhotoUri } from "@/lib/normalizeScanImage";
import type { CaptureGuidanceSnapshot } from "@/lib/scanCaptureGuidance";

const NAVY = "#2C3E6B";

/** One short, human guidance line shown during live capture (also spoken by the voice guide). */
function humanGuidanceMessage(
  g: CaptureGuidanceSnapshot | null,
  expressionStep: boolean
): string {
  if (!g) return "Getting the camera ready…";
  if (g.lighting !== "good" && g.lightingScore < 55) return g.lightingMessage;
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
};

export function FiveAngleCameraStep({
  stepIndex,
  onCaptured,
  onPickFromLibrary,
  onBack,
  busy,
  variant = "dashboard",
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const captureDebugUi = isCaptureDebugEnabled();
  const [showDebug, setShowDebug] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [cameraAdjust, setCameraAdjust] = useState<CameraAdjustments>(
    DEFAULT_CAMERA_ADJUSTMENTS
  );
  const voiceSpeechAvailable = isCaptureVoiceSpeechAvailable();
  const [voiceEnabled, setVoiceEnabled] = useState(voiceSpeechAvailable);
  const insets = useSafeAreaInsets();

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

  if (!step) return null;

  const totalSteps = FACE_SCAN_CAPTURE_STEPS.length;

  const takeShot = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || shooting) return;
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
  }, [cameraReady, shooting, facing, cameraAdjust.brightness, cameraAdjust.exposure]);

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
    setControlsOpen(false);
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
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={48} color={NAVY} style={{ marginBottom: 16 }} />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          We need your camera to capture the 5-angle kAI skin scan.
        </Text>
        <Pressable style={styles.btnNavy} onPress={() => void requestPermission()}>
          <Text style={styles.btnNavyText}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  const isDisabled = busy || shooting || !cameraReady || reviewingCapture;
  const headerTitle =
    variant === "onboarding" ? "kAI baseline photos" : "AI face scan";
  const previewOverlay = previewOverlayOpacity(
    cameraAdjust.brightness,
    cameraAdjust.exposure
  );

  return (
    <View style={styles.wrap}>
      <View style={StyleSheet.absoluteFill}>
        <CameraView
          key={facing}
          ref={cameraRef}
          style={[StyleSheet.absoluteFill, reviewingCapture && styles.cameraHidden]}
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
          <Image
            source={{ uri: pendingUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={`Captured ${step.title}`}
          />
        ) : null}
      </View>
      {captureDebugUi ? (
        <ScanCaptureDebugOverlay
          guidance={guidance}
          captureZoom={cameraAdjust.zoom}
          models={models}
          faceTracked={faceTracked}
          insetTop={insets.top + 120}
          visible={showDebug && !reviewingCapture}
          extra={{
            step: `${stepIndex + 1}/${totalSteps}`,
            bbox: bboxSource,
          }}
        />
      ) : null}
      {!reviewingCapture ? (
        <ScanCameraAdjustPanel
          value={cameraAdjust}
          onChange={setCameraAdjust}
          expanded={controlsOpen}
          onToggleExpanded={() => setControlsOpen((v) => !v)}
          disabled={isDisabled}
          insetTop={insets.top}
          insetBottom={insets.bottom}
        />
      ) : null}
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} style={styles.headerBtn} hitSlop={14}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerActions}>
          {voiceSpeechAvailable ? (
            <Pressable
              onPress={() => setVoiceEnabled((v) => !v)}
              style={styles.headerIconCircle}
              accessibilityLabel={voiceEnabled ? "Mute voice guide" : "Enable voice guide"}
            >
              <Ionicons
                name={voiceEnabled ? "volume-high" : "volume-mute"}
                size={20}
                color="#fff"
              />
            </Pressable>
          ) : null}
          {captureDebugUi ? (
            <Pressable
              onPress={() => setShowDebug((v) => !v)}
              style={[styles.headerIconCircle, showDebug && styles.headerIconCircleActive]}
              accessibilityLabel={showDebug ? "Hide diagnostics log" : "Show diagnostics log"}
            >
              <Ionicons name="bug-outline" size={18} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
            style={styles.headerIconCircle}
            accessibilityLabel="Switch camera"
          >
            <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.instructionWrap, { top: insets.top + 52 }]}>
        <View style={styles.instructionCard}>
          <Text style={styles.stepKicker}>
            Step {stepIndex + 1}/{totalSteps}
          </Text>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepInstruction}>{step.instruction}</Text>
          {!reviewingCapture ? (
            <ScanCaptureStepTicks completedCount={stepIndex} compact />
          ) : null}
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {reviewingCapture ? (
          <View style={styles.reviewHint}>
            <Text style={styles.reviewHintText}>
              Review this photo. Continue or retake.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.guidePill,
              guidance?.readyToCapture && styles.guidePillReady,
            ]}
          >
            <Ionicons
              name={guidance?.readyToCapture ? "checkmark-circle" : "information-circle-outline"}
              size={20}
              color={guidance?.readyToCapture ? "#34d399" : "#fff"}
            />
            <Text style={styles.guideText} numberOfLines={2}>
              {humanGuidanceMessage(guidance, expressionStep)}
            </Text>
          </View>
        )}

        {reviewingCapture ? (
          <>
            <Pressable style={styles.btnOutline} onPress={retakePendingCapture}>
              <View style={styles.btnRow}>
                <Ionicons name="refresh-outline" size={20} color="#fff" />
                <Text style={styles.btnOutlineText}>Retake</Text>
              </View>
            </Pressable>
            <Pressable style={styles.btnNavy} onPress={confirmPendingCapture}>
              <View style={styles.btnRow}>
                <Ionicons name="checkmark-outline" size={20} color="#fff" />
                <Text style={styles.btnNavyText}>
                  {stepIndex + 1 >= totalSteps ? "Use photo & finish" : "Use photo & next"}
                </Text>
              </View>
            </Pressable>
          </>
        ) : null}

        {!reviewingCapture ? (
          <Pressable
            style={[styles.btnNavy, isDisabled && styles.disabled]}
            onPress={() => void takeShot()}
            disabled={isDisabled}
          >
            {shooting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.btnNavyText}>
                  {guidance?.readyToCapture ? "Capture" : "Capture anyway"}{" "}
                  ({stepIndex + 1}/{totalSteps})
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}
        {!reviewingCapture ? (
        <Pressable
          style={[styles.libraryBtn, (busy || shooting) && styles.disabled]}
          onPress={onPickFromLibrary}
          disabled={busy || shooting}
        >
          <Ionicons name="images-outline" size={18} color="#fff" />
          <Text style={styles.libraryBtnText}>Pick from library</Text>
        </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  cameraHidden: { opacity: 0 },
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
