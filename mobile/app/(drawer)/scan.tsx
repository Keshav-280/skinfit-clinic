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

import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

const TEAL = "#6B8E8E";

export default function ScanScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [scanName, setScanName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.85,
  };

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera", "Allow camera access to capture a photo for your scan.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!res.canceled && res.assets[0]?.uri) {
      setUri(res.assets[0].uri);
      setResultId(null);
    }
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo library access to choose an image.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!res.canceled && res.assets[0]?.uri) {
      setUri(res.assets[0].uri);
      setResultId(null);
    }
  }

  async function runScan() {
    if (!token || !uri) {
      Alert.alert("AI Scan", "Choose a photo first.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("scanName", scanName.trim() || "Untitled Scan");
      const ext = uri.split(".").pop()?.toLowerCase();
      const mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      form.append("image", {
        uri,
        name: `scan.${ext === "png" ? "png" : "jpg"}`,
        type: mime,
      } as unknown as Blob);

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
      Alert.alert("Done", "Your scan is saved.", [
        { text: "View report", onPress: () => router.push(`/(drawer)/history/${data.data!.id}`) },
        { text: "OK", style: "cancel" },
      ]);
    } catch (e) {
      Alert.alert("AI Scan", e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>AI skin scan</Text>
      <Text style={styles.sub}>
        Take or choose a clear face photo. Results are saved like on the website.
      </Text>

      <Text style={styles.label}>Scan name (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Morning check-in"
        value={scanName}
        onChangeText={setScanName}
        placeholderTextColor="#94a3b8"
      />

      <View style={styles.photoActions}>
        <Pressable
          style={[styles.btnHalf, styles.btnCamera, busy && styles.disabled]}
          onPress={takePhoto}
          disabled={busy}
        >
          <Text style={styles.btnText}>Take photo</Text>
        </Pressable>
        <Pressable
          style={[styles.btnHalf, styles.btnGallery, busy && styles.disabled]}
          onPress={pickFromLibrary}
          disabled={busy}
        >
          <Text style={styles.btnTextDark}>Choose photo</Text>
        </Pressable>
      </View>

      {uri ? <Image source={{ uri }} style={styles.preview} resizeMode="cover" /> : null}

      <Pressable
        style={[styles.btn, styles.btnPrimary, (!uri || busy) && styles.disabled]}
        onPress={runScan}
        disabled={!uri || busy}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#18181b", textAlign: "center" },
  sub: { fontSize: 14, color: "#52525b", textAlign: "center", marginTop: 8, lineHeight: 20 },
  label: { fontSize: 13, color: "#52525b", marginTop: 20, marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  btnHalf: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCamera: { backgroundColor: TEAL },
  btnGallery: { backgroundColor: "#e4e4e7" },
  btn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#e4e4e7",
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: TEAL },
  disabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  btnTextDark: { fontSize: 16, fontWeight: "600", color: "#27272a" },
  preview: {
    width: "100%",
    height: 280,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: "#e4e4e7",
  },
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#0d9488", fontWeight: "600", fontSize: 15 },
});
