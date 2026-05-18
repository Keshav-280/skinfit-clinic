import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, Mask, Rect } from "react-native-svg";

import { CameraView, useCameraPermissions } from "expo-camera";

import { FiveAngleCameraStep } from "@/components/FiveAngleCameraStep";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";
import { normalizeScanImageUri } from "@/lib/normalizeScanImage";

const NAVY = "#2B3A67";
const GREEN = "#1B8A4A";
const N = FACE_SCAN_CAPTURE_STEPS.length;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type Phase = "intro" | "capture" | "review";

const TIPS = [
  "Make sure you're in a well-lit area.",
  "Hold phone at eye level",
  "Remove glasses / hair covering face",
];

export default function ScanScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("intro");
  const [uris, setUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!camPermission?.granted) void requestCamPermission();
  }, []);

  useEffect(() => {
    if (busy) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [busy]);

  const stepIndex = uris.length;

  async function pickFromLibrary() {
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
    const newUris = [...uris, res.assets[0].uri];
    setUris(newUris);
    setResultId(null);
    setPhase(newUris.length >= N ? "review" : "capture");
  }

  function handleCaptured(uri: string) {
    const newUris = [...uris, uri];
    setUris(newUris);
    setResultId(null);
    if (newUris.length >= N) setPhase("review");
  }

  function handleBackFromCamera() {
    if (uris.length > 0) {
      setUris((u) => u.slice(0, -1));
    } else {
      setPhase("intro");
    }
  }

  function startOver() {
    setUris([]);
    setResultId(null);
    setPhase("intro");
  }

  async function runScan() {
    if (!token || uris.length !== N) {
      Alert.alert("AI face scan", `Capture all ${N} angles first.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("scanName", "Untitled Scan");
      for (let i = 0; i < N; i++) {
        const uri = await normalizeScanImageUri(uris[i]);
        form.append("images", {
          uri,
          name: `face-${FACE_SCAN_CAPTURE_STEPS[i].id}.jpg`,
          type: "image/jpeg",
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
    } catch (e) {
      Alert.alert("Scan failed", e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Shared header ──
  function Header({
    title,
    onBack,
    dark,
  }: {
    title: string;
    onBack: () => void;
    dark?: boolean;
  }) {
    const color = dark ? "#1A1A2E" : "#fff";
    return (
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} style={styles.headerBtn} hitSlop={14}>
          <Ionicons name="chevron-back" size={24} color={color} />
        </Pressable>
        <Text style={[styles.headerTitle, { color }]}>{title}</Text>
        <Pressable style={styles.headerBtn} hitSlop={14}>
          <Ionicons name="help-circle-outline" size={24} color={color} />
        </Pressable>
      </View>
    );
  }

  // ── Oval dimensions for intro ──
  const ovalRx = SCREEN_W * 0.30;
  const ovalRy = ovalRx * 1.35;

  // ── Camera modal (full-screen, over dock) ──
  const showCamera = phase === "capture" && uris.length < N;

  // ── Review phase ──
  if (phase === "review" || uris.length >= N) {
    const gridH = SCREEN_H * 0.58;
    return (
      <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
        {/* Header: back + help icons in white circles, no title */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={startOver} style={styles.headerBtn} hitSlop={14}>
            <View style={styles.reviewIconCircle}>
              <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
            </View>
          </Pressable>
          <View style={styles.headerBtn} />
          <Pressable style={styles.headerBtn} hitSlop={14}>
            <View style={styles.reviewIconCircle}>
              <Ionicons name="help-circle-outline" size={22} color="#1A1A2E" />
            </View>
          </Pressable>
        </View>

        <View style={styles.reviewBody}>
          {/* Mosaic image grid */}
          <View style={[styles.mosaic, { height: gridH }]}>
            {/* Left: tall image (left profile) */}
            <View style={styles.mosaicLeft}>
              <Image
                source={{ uri: uris[1] }}
                style={styles.mosaicImg}
                resizeMode="cover"
              />
            </View>
            {/* Right: 2 rows x 2 columns */}
            <View style={styles.mosaicRight}>
              <View style={styles.mosaicTopRow}>
                <View style={styles.mosaicCell}>
                  <Image
                    source={{ uri: uris[2] }}
                    style={styles.mosaicImg}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.mosaicCell}>
                  <Image
                    source={{ uri: uris[0] }}
                    style={styles.mosaicImg}
                    resizeMode="cover"
                  />
                </View>
              </View>
              <View style={styles.mosaicBottomRow}>
                <View style={[styles.mosaicCell, { flex: 0.48 }]}>
                  <Image
                    source={{ uri: uris[3] }}
                    style={styles.mosaicImg}
                    resizeMode="cover"
                  />
                </View>
                <View style={[styles.mosaicCell, { flex: 0.52 }]}>
                  <Image
                    source={{ uri: uris[4] }}
                    style={styles.mosaicImg}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Pre-scan actions */}
          {!busy && resultId == null && (
            <View style={styles.reviewActions}>
              <Pressable
                style={styles.btnNavy}
                onPress={() => void runScan()}
              >
                <View style={styles.btnRow}>
                  <Ionicons name="scan-outline" size={20} color="#fff" />
                  <Text style={styles.btnNavyText}>Begin Analysis</Text>
                </View>
              </Pressable>

              <Pressable style={styles.recaptureLink} onPress={startOver}>
                <Ionicons name="refresh-outline" size={18} color="#52525b" />
                <Text style={styles.recaptureLinkText}>Recapture Image</Text>
              </Pressable>
            </View>
          )}

          {/* Analyzing overlay */}
          {busy && (
            <View style={styles.analyzingOverlay}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <MaterialCommunityIcons name="auto-fix" size={56} color={NAVY} />
              </Animated.View>
              <Text style={styles.analyzingTitle}>Analyzing</Text>
              <Text style={styles.analyzingSub}>
                This usually takes 10–20 seconds
              </Text>
            </View>
          )}

          {/* Post-scan success actions */}
          {!busy && resultId != null && (
            <View style={styles.reviewActions}>
              <Pressable
                style={styles.btnNavy}
                onPress={() => router.push(`/(drawer)/history/${resultId}`)}
              >
                <View style={styles.btnRow}>
                  <Ionicons name="document-text-outline" size={20} color="#fff" />
                  <Text style={styles.btnNavyText}>View Report</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.btnOutline}
                onPress={() => router.push("/(drawer)")}
              >
                <View style={styles.btnRow}>
                  <Ionicons name="home-outline" size={20} color={NAVY} />
                  <Text style={styles.btnOutlineText}>Go to Dashboard</Text>
                </View>
              </Pressable>
            </View>
          )}
        </View>
      </LinearGradient>
    );
  }

  // ── Intro phase ──
  return (
    <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
      {/* Camera modal rendered here so it overlays everything */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <FiveAngleCameraStep
          stepIndex={stepIndex}
          onCaptured={handleCaptured}
          onPickFromLibrary={() => void pickFromLibrary()}
          onBack={handleBackFromCamera}
          busy={busy}
        />
      </Modal>

      <Header title="Take a Selfie" onBack={() => router.back()} dark />

      <ScrollView
        contentContainerStyle={styles.introScroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Oval live camera preview */}
        <View style={[styles.ovalWrap, { width: ovalRx * 2, height: ovalRy * 2 }]}>
          {/* Live camera feed behind the SVG mask */}
          {camPermission?.granted && phase === "intro" && (
            <CameraView style={StyleSheet.absoluteFill} facing="front" />
          )}
          {/* SVG mask: paint corners with bg color, keep oval transparent */}
          <Svg
            width={ovalRx * 2}
            height={ovalRy * 2}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <Mask id="introOvalMask">
                <Rect width={ovalRx * 2} height={ovalRy * 2} fill="white" />
                <Ellipse
                  cx={ovalRx}
                  cy={ovalRy}
                  rx={ovalRx}
                  ry={ovalRy}
                  fill="black"
                />
              </Mask>
            </Defs>
            <Rect
              width={ovalRx * 2}
              height={ovalRy * 2}
              fill="#E4ECDE"
              mask="url(#introOvalMask)"
            />
            {/* Black fallback when camera not yet available */}
            {!camPermission?.granted && (
              <Ellipse
                cx={ovalRx}
                cy={ovalRy}
                rx={ovalRx}
                ry={ovalRy}
                fill="#0D0D0D"
              />
            )}
          </Svg>
          {/* Camera icon hint */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.ovalIcon}>
              <Ionicons
                name="camera-outline"
                size={44}
                color="rgba(255,255,255,0.6)"
              />
            </View>
          </View>
        </View>

        {/* Instruction tips card */}
        <View style={styles.tipsCard}>
          {TIPS.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipBadge}>
                <Text style={styles.tipBadgeNum}>{i + 1}</Text>
              </View>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Capture Image button */}
        <View style={styles.introButtons}>
          <Pressable style={styles.btnNavy} onPress={() => setPhase("capture")}>
            <View style={styles.btnRow}>
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.btnNavyText}>Capture Image</Text>
            </View>
          </Pressable>

          {/* Pick from library */}
          <Pressable
            style={styles.libraryLink}
            onPress={() => void pickFromLibrary()}
          >
            <Ionicons name="images-outline" size={18} color={NAVY} />
            <Text style={styles.libraryLinkText}>Pick from library</Text>
          </Pressable>

          <Pressable
            style={styles.viewScansLink}
            onPress={() => router.push("/(drawer)/history")}
          >
            <Ionicons name="time-outline" size={18} color={NAVY} />
            <Text style={styles.viewScansLinkText}>View Past Scans</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 4,
    zIndex: 10,
  },
  headerBtn: { width: 40, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },

  /* ── Intro ── */
  introScroll: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  ovalWrap: {
    overflow: "hidden",
    alignSelf: "center",
    marginBottom: 24,
  },
  ovalIcon: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tipsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: "100%",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  tipBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  tipBadgeNum: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    color: "#27272a",
    lineHeight: 21,
  },
  introButtons: {
    width: "100%",
    marginTop: 28,
    gap: 16,
  },
  libraryLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  libraryLinkText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "600",
  },
  viewScansLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  viewScansLinkText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  /* ── Shared button styles ── */
  btnNavy: {
    backgroundColor: NAVY,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
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
  btnOutline: {
    borderWidth: 2,
    borderColor: NAVY,
    backgroundColor: "transparent",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnOutlineText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
  },
  disabled: { opacity: 0.45 },

  /* ── Review ── */
  reviewIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewBody: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    gap: 28,
    position: "relative",
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(232, 239, 230, 0.80)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 10,
  },
  analyzingTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: NAVY,
    marginTop: 4,
  },
  analyzingSub: {
    fontSize: 15,
    color: "#52525b",
    lineHeight: 22,
  },
  mosaic: {
    flexDirection: "row",
    gap: 8,
  },
  mosaicLeft: {
    flex: 0.38,
    borderRadius: 20,
    overflow: "hidden",
  },
  mosaicRight: {
    flex: 0.62,
    gap: 8,
  },
  mosaicTopRow: {
    flex: 0.45,
    flexDirection: "row",
    gap: 8,
  },
  mosaicBottomRow: {
    flex: 0.55,
    flexDirection: "row",
    gap: 8,
  },
  mosaicCell: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  mosaicImg: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  reviewActions: {
    gap: 16,
  },
  recaptureLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  recaptureLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#52525b",
  },
});
