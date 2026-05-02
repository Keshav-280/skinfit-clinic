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
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";

const TEAL = "#0d9488";
const N = FACE_SCAN_CAPTURE_STEPS.length;

export default function OnboardingCaptureScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [uris, setUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [useCamera, setUseCamera] = useState(true);

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
        const uri = uris[i];
        const ext = uri.split(".").pop()?.toLowerCase();
        const mime =
          ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        form.append("images", {
          uri,
          name: `face-${FACE_SCAN_CAPTURE_STEPS[i].id}.${ext === "png" ? "png" : "jpg"}`,
          type: mime,
        } as unknown as Blob);
      }
      const res = await apiFetch("/api/scan", token, { method: "POST", body: form });
      const data = (await res.json()) as {
        success?: boolean;
        data?: { id?: number };
        error?: string;
      };
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(data.error || "Scan failed.");
      }
      router.replace(
        `/onboarding/baseline-report?scanId=${encodeURIComponent(String(data.data.id))}` as Href
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
        stepIndex={stepIndex}
        onCaptured={(uri) => setUris((u) => [...u, uri])}
        onPickFromLibrary={() => void pickFromLibrary()}
        busy={busy}
      />
    );
  }

  if (!isComplete && !useCamera) {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.title}>Add {N} photos</Text>
        <Pressable style={styles.btn} onPress={() => void pickFromLibrary()}>
          <Text style={styles.btnText}>Pick photo ({uris.length}/{N})</Text>
        </Pressable>
        <Pressable onPress={() => setUseCamera(true)}>
          <Text style={styles.link}>Use guided camera</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Baseline ready</Text>
      <Text style={styles.sub}>We&apos;ll generate your first kAI report. This may take up to a minute.</Text>
      <Pressable
        style={[styles.btn, busy && styles.dis]}
        onPress={() => void runBaselineScan()}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Generate my kAI report</Text>}
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
  );
}

const styles = StyleSheet.create({
  pad: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: "#18181b", textAlign: "center" },
  sub: { marginTop: 10, fontSize: 14, color: "#52525b", textAlign: "center", lineHeight: 20 },
  btn: {
    marginTop: 24,
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  dis: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { marginTop: 16, textAlign: "center", color: TEAL, fontWeight: "600" },
});
