import * as ImagePicker from "expo-image-picker";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FiveAngleCameraStep } from "@/components/FiveAngleCameraStep";
import { OnboardingQueuedScreen } from "@/components/onboarding/ScanQueuedConfirmation";
import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";
import { useAuth } from "@/contexts/AuthContext";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";
import { normalizeScanImageUri } from "@/lib/normalizeScanImage";
import { addPendingScanJob } from "@/lib/scanJobNotifications";
import { submitFaceScan } from "@/lib/submitFaceScan";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const N = FACE_SCAN_CAPTURE_STEPS.length;

export default function OnboardingCaptureScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [uris, setUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [useCamera, setUseCamera] = useState(true);
  const [queued, setQueued] = useState(false);

  const stepIndex = uris.length;
  const isComplete = uris.length >= N;

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo library access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.88,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setUris((u) => [...u, res.assets[0].uri]);
    }
  }

  async function runBaselineScan() {
    if (!token || uris.length !== N) {
      Alert.alert("Capture", `Need all ${N} angles.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("scanName", "kAI baseline — onboarding");
      for (let i = 0; i < N; i++) {
        const uri = await normalizeScanImageUri(uris[i]);
        form.append("images", {
          uri,
          name: `face-${FACE_SCAN_CAPTURE_STEPS[i].id}.jpg`,
          type: "image/jpeg",
        } as unknown as Blob);
      }
      const outcome = await submitFaceScan(token, form);
      if (outcome.mode === "queued") {
        await addPendingScanJob(
          outcome.jobId,
          "kAI baseline — onboarding"
        );
        setQueued(true);
        return;
      }
      if (outcome.mode === "error") {
        throw new Error(outcome.message);
      }
      router.replace(
        `/onboarding/baseline-report?scanId=${encodeURIComponent(String(outcome.scanId))}` as Href
      );
    } catch (e) {
      Alert.alert("Baseline scan", e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!isComplete && useCamera) {
    return (
      <FiveAngleCameraStep
        variant="onboarding"
        stepIndex={stepIndex}
        onCaptured={(uri) => setUris((u) => [...u, uri])}
        onPickFromLibrary={() => void pickFromLibrary()}
        onBack={() => {
          if (uris.length > 0) {
            setUris((u) => u.slice(0, -1));
          } else {
            router.back();
          }
        }}
        busy={busy}
      />
    );
  }

  if (!isComplete && !useCamera) {
    return (
      <OnboardingLayoutShell title="kAI baseline photos" backHref="/onboarding/capture-intro">
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.title}>Add {N} photos</Text>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={() => void pickFromLibrary()}
          >
            <Text style={styles.btnText}>Pick photo ({uris.length}/{N})</Text>
          </Pressable>
          <Pressable onPress={() => setUseCamera(true)}>
            <Text style={styles.link}>Use guided camera</Text>
          </Pressable>
        </ScrollView>
      </OnboardingLayoutShell>
    );
  }

  if (queued) {
    return (
      <OnboardingQueuedScreen
        onContinue={() => router.replace("/onboarding/baseline-report" as Href)}
        onDashboard={() => router.replace("/(drawer)" as Href)}
      />
    );
  }

  return (
    <OnboardingLayoutShell title="kAI baseline photos">
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, styles.iconCircleNavy]}>
            <Text style={styles.iconCheck}>{"✓"}</Text>
          </View>
        </View>
        <Text style={styles.title}>Baseline ready</Text>
        <Text style={styles.sub}>
          Tap below to submit your photos. We&apos;ll notify you when your kAI report is ready.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.btn, busy && styles.dis, pressed && !busy && styles.btnPressed]}
          onPress={() => void runBaselineScan()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Submit baseline scan</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            setUris([]);
            setUseCamera(true);
          }}
        >
          <Text style={styles.link}>Retake photos</Text>
        </Pressable>
      </ScrollView>
    </OnboardingLayoutShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: {
    padding: 24,
    paddingBottom: 48,
    flexGrow: 1,
    justifyContent: "center",
  },
  iconWrap: { alignItems: "center", marginBottom: 20 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleNavy: {
    backgroundColor: NAVY,
  },
  iconCheck: { fontSize: 28, color: "#fff", fontWeight: "800" },
  iconBell: { fontSize: 28 },
  hint: {
    marginTop: 10,
    fontSize: 13,
    color: "#71717a",
    textAlign: "center",
    lineHeight: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1A2E",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 12,
    fontSize: 15,
    color: "#52525b",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  btn: {
    marginTop: 28,
    backgroundColor: NAVY,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  btnPressed: {
    backgroundColor: NAVY_DARK,
    transform: [{ scale: 0.98 }],
  },
  dis: { opacity: 0.45 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
  link: {
    marginTop: 18,
    textAlign: "center",
    color: NAVY,
    fontWeight: "600",
    fontSize: 15,
  },
});
