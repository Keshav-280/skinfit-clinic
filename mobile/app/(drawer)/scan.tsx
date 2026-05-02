import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FiveAngleCameraStep } from "@/components/FiveAngleCameraStep";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";

const TEAL = "#6B8E8E";
const N = FACE_SCAN_CAPTURE_STEPS.length;

export default function ScanScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [uris, setUris] = useState<string[]>([]);
  const [scanName, setScanName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);
  const [useCamera, setUseCamera] = useState(true);

  const stepIndex = uris.length;
  const isComplete = uris.length >= N;

  async function pickFromLibraryForStep() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo library access to choose an image.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.88,
      allowsMultipleSelection: false,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setUris((u) => [...u, res.assets[0].uri]);
    setResultId(null);
  }

  function clearPhotos() {
    setUris([]);
    setResultId(null);
  }

  function removeLast() {
    setUris((u) => u.slice(0, -1));
    setResultId(null);
  }

  async function runScan() {
    if (!token || uris.length !== N) {
      Alert.alert("AI face scan", `Capture all ${N} angles first.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("scanName", scanName.trim() || "Untitled Scan");
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
      setResultId(data.data.id);
      Alert.alert("Done", "Your kAI scan is saved.", [
        { text: "View report", onPress: () => router.push(`/(drawer)/history/${data.data!.id}`) },
        { text: "OK", style: "cancel" },
      ]);
    } catch (e) {
      Alert.alert("AI face scan", e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!isComplete && useCamera) {
    return (
      <FiveAngleCameraStep
        stepIndex={stepIndex}
        onCaptured={(uri) => {
          setUris((u) => [...u, uri]);
          setResultId(null);
        }}
        onPickFromLibrary={() => void pickFromLibraryForStep()}
        busy={busy}
      />
    );
  }

  if (!isComplete && !useCamera) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>AI face scan</Text>
        <Text style={styles.sub}>
          Add {N} photos in order: {FACE_SCAN_CAPTURE_STEPS.map((s) => s.id).join(" → ")}.
        </Text>
        <Text style={styles.progress}>
          Step {stepIndex + 1} of {N}: {FACE_SCAN_CAPTURE_STEPS[stepIndex]?.title ?? ""}
        </Text>
        <Pressable style={styles.btn} onPress={() => void pickFromLibraryForStep()}>
          <Text style={styles.btnText}>Choose photo for this step</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => setUseCamera(true)}>
          <Text style={styles.linkText}>Use camera with guide instead</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Review & analyze</Text>
      <Text style={styles.sub}>
        {N}-angle kAI capture complete. Check each thumbnail, then run analysis.
      </Text>

      <Pressable
        style={styles.linkBtn}
        onPress={() => {
          clearPhotos();
          setUseCamera(true);
        }}
      >
        <Text style={styles.linkMuted}>Retake with camera</Text>
      </Pressable>

      <View style={styles.thumbGrid}>
        {uris.map((u, i) => (
          <View key={`${u}-${i}`} style={styles.thumbCell}>
            <Image source={{ uri: u }} style={styles.thumb} resizeMode="cover" />
            <Text style={styles.thumbCap} numberOfLines={2}>
              {FACE_SCAN_CAPTURE_STEPS[i]?.title}
            </Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.linkBtn} onPress={removeLast}>
        <Text style={styles.linkMuted}>Re-shoot last angle only</Text>
      </Pressable>
      <Pressable style={styles.linkBtn} onPress={clearPhotos}>
        <Text style={styles.linkMuted}>Start over</Text>
      </Pressable>

      <Text style={styles.label}>Scan name (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Morning check-in"
        value={scanName}
        onChangeText={setScanName}
        placeholderTextColor="#94a3b8"
      />

      <Pressable
        style={[styles.btnPrimary, busy && styles.disabled]}
        onPress={() => void runScan()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Analyze & save</Text>
        )}
      </Pressable>

      {resultId != null ? (
        <Pressable style={styles.linkBtn} onPress={() => router.push(`/(drawer)/history/${resultId}`)}>
          <Text style={styles.linkText}>Open last report</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.linkBtn} onPress={() => setUseCamera(false)}>
        <Text style={styles.linkMuted}>Library-only mode (no live camera)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#18181b", textAlign: "center" },
  sub: { fontSize: 14, color: "#52525b", textAlign: "center", marginTop: 8, lineHeight: 20 },
  progress: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "600",
    color: "#27272a",
    textAlign: "center",
  },
  label: { fontSize: 13, color: "#52525b", marginTop: 20, marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  btn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  btnPrimary: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  thumbGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
    justifyContent: "center",
  },
  thumbCell: { width: "30%", minWidth: 100 },
  thumb: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: "#e4e4e7",
  },
  thumbCap: { fontSize: 10, color: "#52525b", marginTop: 4, textAlign: "center" },
  linkBtn: { marginTop: 12, alignItems: "center" },
  linkText: { color: "#0d9488", fontWeight: "600", fontSize: 15 },
  linkMuted: { color: "#71717a", fontWeight: "500", fontSize: 14 },
});
