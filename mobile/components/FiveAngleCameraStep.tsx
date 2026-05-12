import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FaceCaptureOvalOverlay } from "@/components/FaceCaptureOvalOverlay";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";

const NAVY = "#2C3E6B";

type Props = {
  stepIndex: number;
  onCaptured: (uri: string) => void;
  onPickFromLibrary: () => void;
  onBack: () => void;
  busy?: boolean;
};

export function FiveAngleCameraStep({
  stepIndex,
  onCaptured,
  onPickFromLibrary,
  onBack,
  busy,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shooting, setShooting] = useState(false);
  const insets = useSafeAreaInsets();

  const step = FACE_SCAN_CAPTURE_STEPS[stepIndex];
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
      if (pic?.uri) onCaptured(pic.uri);
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
      setCountdown(null);
    }
  }, [cameraReady, onCaptured, shooting]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      void takeShot();
      return;
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, takeShot]);

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

  const isDisabled = busy || shooting || !cameraReady || countdown !== null;

  return (
    <View style={styles.wrap}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        onCameraReady={() => setCameraReady(true)}
      />
      <FaceCaptureOvalOverlay />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} style={styles.headerBtn} hitSlop={14}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>Take a Selfie</Text>
        <View style={styles.headerBtn}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="help-circle-outline" size={22} color="#fff" />
          </View>
        </View>
      </View>

      {/* Instruction pill */}
      <View style={[styles.pillWrap, { top: insets.top + 60 }]}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{step.shortLabel}</Text>
        </View>
      </View>

      {/* Countdown overlay */}
      {countdown !== null && countdown > 0 && (
        <View style={styles.countdownOverlay} pointerEvents="none">
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNum}>{countdown}</Text>
          </View>
          <Text style={styles.countdownLabel}>Hold steady…</Text>
        </View>
      )}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          style={[styles.btnNavy, isDisabled && styles.disabled]}
          onPress={() => setCountdown(3)}
          disabled={isDisabled}
        >
          {shooting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.btnNavyText}>
                Capture Image ({stepIndex + 1}/{totalSteps})
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.libraryBtn, (busy || shooting) && styles.disabled]}
          onPress={onPickFromLibrary}
          disabled={busy || shooting}
        >
          <Ionicons name="images-outline" size={18} color="#fff" />
          <Text style={styles.libraryBtnText}>Pick from library</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
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
  pillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  pill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 20,
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  countdownNum: {
    fontSize: 56,
    fontWeight: "900",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  countdownLabel: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    gap: 14,
    zIndex: 10,
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
