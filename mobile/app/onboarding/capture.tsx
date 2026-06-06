import * as ImagePicker from "expo-image-picker";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { FiveAngleCameraStep } from "@/components/FiveAngleCameraStep";
import { OnboardingCaptureReview } from "@/components/onboarding/OnboardingCaptureReview";
import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";
import { useAuth } from "@/contexts/AuthContext";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";
import { normalizeScanImageUri } from "@/lib/normalizeScanImage";
import { addPendingScanJob } from "@/lib/scanJobNotifications";
import { submitFaceScan } from "@/lib/submitFaceScan";

const N = FACE_SCAN_CAPTURE_STEPS.length;

export default function OnboardingCaptureScreen() {
  const router = useRouter();
  const { token, markBaselineSubmitted } = useAuth();
  const [uris, setUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [useCamera, setUseCamera] = useState(true);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);

  const stepIndex = retakeIndex ?? uris.length;
  const isComplete = uris.length >= N;
  const inRetakeFlow = retakeIndex !== null;

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
      const picked = res.assets[0].uri;
      if (retakeIndex !== null) {
        setUris((u) => {
          const next = [...u];
          next[retakeIndex] = picked;
          return next;
        });
        setRetakeIndex(null);
      } else {
        setUris((u) => [...u, picked]);
      }
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
      if (outcome.mode === "error") {
        throw new Error(outcome.message);
      }
      if (outcome.mode === "queued") {
        await addPendingScanJob(
          outcome.jobId,
          "kAI baseline — onboarding"
        );
        await markBaselineSubmitted({ pending: true });
        router.replace("/onboarding/baseline-report?pending=1" as Href);
        return;
      }
      await markBaselineSubmitted({ pending: false });
      router.replace(
        `/onboarding/baseline-report?scanId=${encodeURIComponent(String(outcome.scanId))}&pending=0` as Href
      );
    } catch (e) {
      Alert.alert("Baseline scan", e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if ((!isComplete || inRetakeFlow) && useCamera) {
    return (
      <FiveAngleCameraStep
        variant="onboarding"
        stepIndex={stepIndex}
        previousCaptureUri={
          inRetakeFlow
            ? (uris[retakeIndex] ?? uris[retakeIndex - 1] ?? null)
            : (uris[uris.length - 1] ?? null)
        }
        onCaptured={(uri) => {
          if (inRetakeFlow && retakeIndex !== null) {
            setUris((u) => {
              const next = [...u];
              next[retakeIndex] = uri;
              return next;
            });
            setRetakeIndex(null);
            return;
          }
          setUris((u) => [...u, uri]);
        }}
        onPickFromLibrary={() => void pickFromLibrary()}
        onBack={() => {
          if (inRetakeFlow) {
            setRetakeIndex(null);
            return;
          }
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

  return (
    <OnboardingCaptureReview
      uris={uris}
      busy={busy}
      onBack={() => {
        setUris((u) => u.slice(0, -1));
        setUseCamera(true);
      }}
      onLooksGood={() => void runBaselineScan()}
      onRetakeIndex={setRetakeIndex}
    />
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
    backgroundColor: "#2C3E6B",
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
  },
  btnPressed: { opacity: 0.9 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: {
    marginTop: 18,
    textAlign: "center",
    color: "#2C3E6B",
    fontWeight: "600",
    fontSize: 15,
  },
});
