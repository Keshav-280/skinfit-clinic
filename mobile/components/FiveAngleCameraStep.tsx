import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FaceCaptureOvalOverlay } from "@/components/FaceCaptureOvalOverlay";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";

type Props = {
  stepIndex: number;
  onCaptured: (uri: string) => void;
  onPickFromLibrary: () => void;
  busy?: boolean;
};

export function FiveAngleCameraStep({
  stepIndex,
  onCaptured,
  onPickFromLibrary,
  busy,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shooting, setShooting] = useState(false);

  const step = FACE_SCAN_CAPTURE_STEPS[stepIndex];
  if (!step) return null;

  const takeShot = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || shooting) return;
    setShooting(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        skipProcessing: false,
      });
      if (pic?.uri) onCaptured(pic.uri);
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
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.sub}>We need the camera for your 5-angle kAI scan.</Text>
        <Pressable style={styles.btnPrimary} onPress={() => void requestPermission()}>
          <Text style={styles.btnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        onCameraReady={() => setCameraReady(true)}
      />
      <FaceCaptureOvalOverlay />
      <View style={styles.topBar}>
        <Text style={styles.stepKicker}>
          Step {stepIndex + 1} of {FACE_SCAN_CAPTURE_STEPS.length}
        </Text>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepInstr}>{step.instruction}</Text>
        <Text style={styles.lighting}>
          Use soft, even light — avoid harsh backlight. Korean-standard: natural daylight when possible.
        </Text>
      </View>

      {countdown !== null && countdown > 0 ? (
        <View style={styles.countWrap} pointerEvents="none">
          <Text style={styles.countNum}>{countdown}</Text>
          <Text style={styles.countLbl}>Hold still…</Text>
        </View>
      ) : null}

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.btnSecondary, (busy || shooting || !cameraReady) && styles.disabled]}
          onPress={onPickFromLibrary}
          disabled={busy || shooting || !cameraReady}
        >
          <Text style={styles.btnTextDark}>Pick from library</Text>
        </Pressable>
        <Pressable
          style={[styles.btnPrimary, (busy || shooting || !cameraReady || countdown !== null) && styles.disabled]}
          onPress={() => setCountdown(3)}
          disabled={busy || shooting || !cameraReady || countdown !== null}
        >
          {shooting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>3s countdown & capture</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const TEAL = "#6B8E8E";

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    backgroundColor: "#fdf9f0",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#18181b" },
  sub: { marginTop: 8, textAlign: "center", color: "#52525b" },
  topBar: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
    gap: 6,
  },
  stepKicker: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  stepTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  stepInstr: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20 },
  lighting: {
    marginTop: 4,
    color: "rgba(254,240,138,0.95)",
    fontSize: 12,
    lineHeight: 17,
  },
  countWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  countNum: {
    fontSize: 120,
    fontWeight: "900",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  countLbl: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  bottomBar: {
    position: "absolute",
    bottom: 36,
    left: 16,
    right: 16,
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  btnSecondary: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnTextDark: { color: "#27272a", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.45 },
});
