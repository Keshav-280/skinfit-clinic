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

import { FaceLandmarkOutlineNative } from "@/components/FaceLandmarkOutlineNative";
import { ScanCaptureDebugOverlay } from "@/components/ScanCaptureDebugOverlay";
import { ScanCaptureGuidanceBanner } from "@/components/ScanCaptureGuidanceBanner";
import { ScanCaptureStepTicks } from "@/components/ScanCaptureStepTicks";
import { useMobileScanCaptureGuidance } from "@/hooks/useMobileScanCaptureGuidance";
import {
  CAPTURE_READY_VOICE_HINT,
  captureVoiceGuide,
  isCaptureVoiceSpeechAvailable,
} from "@/lib/captureVoiceGuide";
import {
  FACE_SCAN_CAPTURE_STEPS,
  FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA,
} from "@/lib/faceScanCaptures";
import { MOBILE_CAMERA_ZOOM, smoothTowardZoom } from "@/lib/scanCaptureGuidance";

const NAVY = "#2C3E6B";

const CAMERA_ZOOM_MIN = MOBILE_CAMERA_ZOOM.min;
const CAMERA_ZOOM_MAX = MOBILE_CAMERA_ZOOM.max;
const CAMERA_ZOOM_STEP = 0.05;
const CAMERA_ZOOM_DEFAULT = MOBILE_CAMERA_ZOOM.default;
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
  const [cameraZoom, setCameraZoom] = useState<number>(CAMERA_ZOOM_DEFAULT);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const voiceSpeechAvailable = isCaptureVoiceSpeechAvailable();
  const [voiceEnabled, setVoiceEnabled] = useState(voiceSpeechAvailable);
  const userAdjustedZoomAt = useRef(0);
  const insets = useSafeAreaInsets();

  const step = FACE_SCAN_CAPTURE_STEPS[stepIndex];
  const stepId = step?.id ?? "centre";

  const reviewingCapture = pendingUri != null;
  const guidancePaused = busy || shooting || reviewingCapture;
  const {
    guidance,
    models,
    faceCheckLive,
    faceTracked,
    bboxSource,
    needsExpressionModel,
    faceLandmarks,
  } = useMobileScanCaptureGuidance(
    cameraRef,
    true,
    cameraReady,
    cameraZoom,
    guidancePaused,
    stepId
  );

  const autoZoomActive = faceCheckLive && autoZoomEnabled;

  useEffect(() => {
    if (!autoZoomActive || !guidance?.suggestedZoom || guidancePaused) return;
    if (Date.now() - userAdjustedZoomAt.current < 2500) return;
    setCameraZoom((z) => smoothTowardZoom(z, guidance.suggestedZoom!));
  }, [autoZoomActive, guidance?.suggestedZoom, guidancePaused]);

  if (!step) return null;

  const totalSteps = FACE_SCAN_CAPTURE_STEPS.length;

  const takeShot = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || shooting) return;
    setShooting(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        skipProcessing: false,
      });
      if (pic?.uri) setPendingUri(pic.uri);
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
  }, [cameraReady, shooting]);

  useEffect(() => {
    captureVoiceGuide.setEnabled(voiceEnabled && !reviewingCapture);
    if (!voiceEnabled || reviewingCapture) captureVoiceGuide.reset();
    return () => {
      captureVoiceGuide.setEnabled(false);
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
    setCameraZoom(CAMERA_ZOOM_DEFAULT);
    userAdjustedZoomAt.current = 0;
    captureVoiceGuide.reset();
  }, [stepIndex]);

  const confirmPendingCapture = useCallback(() => {
    if (!pendingUri) return;
    onCaptured(pendingUri);
    setPendingUri(null);
  }, [pendingUri, onCaptured]);

  const retakePendingCapture = useCallback(() => {
    setPendingUri(null);
    setCameraZoom(CAMERA_ZOOM_DEFAULT);
    userAdjustedZoomAt.current = 0;
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

  return (
    <View style={styles.wrap}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setPreviewSize({ w: width, h: height });
        }}
      >
        <CameraView
          ref={cameraRef}
          style={[StyleSheet.absoluteFill, reviewingCapture && styles.cameraHidden]}
          facing={facing}
          zoom={cameraZoom}
          onCameraReady={() => setCameraReady(true)}
        />
        {pendingUri ? (
          <Image
            source={{ uri: pendingUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={`Captured ${step.title}`}
          />
        ) : null}
        {!reviewingCapture ? (
          <FaceLandmarkOutlineNative
            landmarks={faceLandmarks}
            layoutWidth={previewSize.w}
            layoutHeight={previewSize.h}
            cropZoom={cameraZoom}
            mirrored={facing === "front"}
          />
        ) : null}
      </View>
      <ScanCaptureDebugOverlay
        guidance={guidance}
        captureZoom={cameraZoom}
        models={models}
        faceTracked={faceTracked}
        insetTop={insets.top + 120}
        extra={{
          step: `${stepIndex + 1}/${totalSteps}`,
          bbox: bboxSource,
        }}
      />
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
          <>
            <ScanCaptureGuidanceBanner
              guidance={guidance}
              models={models}
              needsExpressionModel={needsExpressionModel}
              autoZoomEnabled={faceCheckLive && autoZoomEnabled}
              compact
            />
            <View style={styles.tipsWrap}>
              {FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA.map((tip) => (
                <Text key={tip} style={styles.tipText}>
                  · {tip}
                </Text>
              ))}
            </View>
          </>
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

        {!reviewingCapture && (faceCheckLive || autoZoomEnabled) ? (
          <>
            <View style={styles.zoomRow}>
              <Text style={styles.zoomLabel}>
                {autoZoomEnabled ? "Auto zoom" : "Manual zoom"}
              </Text>
              <Pressable
                onPress={() => setAutoZoomEnabled((v) => !v)}
                disabled={isDisabled}
                hitSlop={8}
              >
                <Text style={styles.autoZoomToggle}>
                  {autoZoomEnabled ? "Switch to manual" : "Switch to auto"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.zoomControls}>
              <Pressable
                style={[styles.zoomBtn, cameraZoom <= CAMERA_ZOOM_MIN && styles.disabled]}
                onPress={() => {
                  userAdjustedZoomAt.current = Date.now();
                  setCameraZoom((z) =>
                    Math.max(CAMERA_ZOOM_MIN, Math.round((z - CAMERA_ZOOM_STEP) * 100) / 100)
                  );
                }}
                disabled={cameraZoom <= CAMERA_ZOOM_MIN || isDisabled}
                accessibilityLabel="Zoom out"
              >
                <Ionicons name="remove-outline" size={20} color="#fff" />
              </Pressable>
              <View style={styles.zoomTrack}>
                <View
                  style={[
                    styles.zoomFill,
                    {
                      width: `${((cameraZoom - CAMERA_ZOOM_MIN) / (CAMERA_ZOOM_MAX - CAMERA_ZOOM_MIN)) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Pressable
                style={[styles.zoomBtn, cameraZoom >= CAMERA_ZOOM_MAX && styles.disabled]}
                onPress={() => {
                  userAdjustedZoomAt.current = Date.now();
                  setCameraZoom((z) =>
                    Math.min(CAMERA_ZOOM_MAX, Math.round((z + CAMERA_ZOOM_STEP) * 100) / 100)
                  );
                }}
                disabled={cameraZoom >= CAMERA_ZOOM_MAX || isDisabled}
                accessibilityLabel="Zoom in"
              >
                <Ionicons name="add-outline" size={20} color="#fff" />
              </Pressable>
            </View>
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
