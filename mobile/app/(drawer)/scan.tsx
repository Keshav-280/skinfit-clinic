import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CameraView, useCameraPermissions } from "expo-camera";

import { FiveAngleCameraStep } from "@/components/FiveAngleCameraStep";
import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import { FACE_SCAN_CAPTURE_STEPS, SCAN_NAME_INPUT_PLACEHOLDER, resolveScanName } from "@/lib/faceScanCaptures";
import { normalizeScanImageUri } from "@/lib/normalizeScanImage";
import {
  addPendingScanJob,
  dismissUnreadReadyScan,
  getPendingScanJobs,
  removePendingScanJob,
  subscribeScanJobNotifications,
} from "@/lib/scanJobNotifications";
import { submitFaceScan } from "@/lib/submitFaceScan";

const SCAN_STATUS_POLL_MS = 3_000;

const NAVY = "#2B3A67";
const GREEN = "#1B8A4A";
const N = FACE_SCAN_CAPTURE_STEPS.length;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type Phase = "intro" | "capture" | "review" | "queued";

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
  const [scanName, setScanName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);
  const [queuedJobId, setQueuedJobId] = useState<string | null>(null);
  const [camPermission, requestCamPermission] = useCameraPermissions();

  // Mirror of `phase` for the focus callback (which captures only the initial render).
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /** Wipe all capture inputs so the next visit to the scan screen starts clean. */
  const resetToFreshScan = useCallback(() => {
    setUris([]);
    setScanName("");
    setResultId(null);
    setQueuedJobId(null);
    setPhase("intro");
  }, []);

  useEffect(() => {
    if (!camPermission?.granted) void requestCamPermission();
  }, []);

  /** Recover job id after remount (AsyncStorage still has the pending job). */
  useEffect(() => {
    if (phase !== "queued" || queuedJobId) return;
    void getPendingScanJobs().then((jobs) => {
      const latest = jobs[jobs.length - 1];
      if (latest?.jobId) setQueuedJobId(latest.jobId);
    });
  }, [phase, queuedJobId]);

  /** When analysis finishes, leave the waiting screen and open the report automatically. */
  useEffect(() => {
    if (phase !== "queued" || !token) return;
    let cancelled = false;

    const openReport = (scanId: number, jobId?: string | null) => {
      if (cancelled) return;
      void dismissUnreadReadyScan(scanId);
      if (jobId) void removePendingScanJob(jobId);
      resetToFreshScan();
      router.replace(`/(drawer)/history/${scanId}` as Href);
    };

    const checkJob = async (jobId: string): Promise<boolean> => {
      try {
        const data = await apiJson<{
          status?: string;
          scanId?: number | null;
        }>(`/api/scans/status/${encodeURIComponent(jobId)}`, token, {
          method: "GET",
        });
        const status = String(data.status ?? "");
        const scanId =
          typeof data.scanId === "number" && data.scanId > 0
            ? data.scanId
            : null;

        if (status === "completed" && scanId) {
          openReport(scanId, jobId);
          return true;
        }
      } catch {
        /* retry on next tick */
      }
      return false;
    };

    const poll = async () => {
      if (cancelled) return;

      if (queuedJobId && (await checkJob(queuedJobId))) return;

      const pending = await getPendingScanJobs();
      for (const job of pending) {
        if (await checkJob(job.jobId)) return;
      }
    };

    void poll();
    const t = setInterval(() => void poll(), SCAN_STATUS_POLL_MS);
    const unsub = subscribeScanJobNotifications(() => void poll());
    return () => {
      cancelled = true;
      clearInterval(t);
      unsub();
    };
  }, [phase, token, router, queuedJobId, resetToFreshScan]);

  /**
   * On (re)focus, start a fresh scan whenever we're sitting on the waiting screen
   * or a dismissed camera modal. A submitted scan keeps running in the background
   * and the report-ready banner (ScanJobReadyNotifier) handles notifying the user,
   * so coming back to this tab should always show a clean capture screen — never
   * the previously captured 5 photos.
   */
  useFocusEffect(
    useCallback(() => {
      const p = phaseRef.current;
      if (p === "capture" || p === "queued") {
        resetToFreshScan();
      }
    }, [resetToFreshScan])
  );

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
    setScanName("");
    setResultId(null);
    setQueuedJobId(null);
    setPhase("intro");
  }

  async function runScan() {
    const name = resolveScanName(scanName);
    if (!token || uris.length !== N) {
      Alert.alert("AI face scan", `Capture all ${N} angles first.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("scanName", name);
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
        await addPendingScanJob(outcome.jobId, name);
        // Clear the captured photos/name now so the camera screen is fresh the
        // moment the user navigates back here, while the queued screen shows.
        setUris([]);
        setScanName("");
        setResultId(null);
        setQueuedJobId(outcome.jobId);
        setPhase("queued");
        return;
      }
      if (outcome.mode === "error") {
        throw new Error(outcome.message);
      }
      setResultId(outcome.scanId);
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

  // ── Rectangular frame dimensions for intro ──
  const frameW = SCREEN_W * 0.62;
  const frameH = frameW * 1.35;
  const frameRadius = 26;

  // ── Camera modal (full-screen, over dock) ──
  const showCamera = phase === "capture" && uris.length < N;

  // ── Queued — analysis in background ──
  if (phase === "queued") {
    return (
      <View style={styles.screenRoot}>
      <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.push("/(drawer)")} style={styles.headerBtn} hitSlop={14}>
            <View style={styles.reviewIconCircle}>
              <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
            </View>
          </Pressable>
          <View style={styles.headerBtn} />
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.queuedBody}>
          <View style={styles.queuedIconWrap}>
            <Ionicons name="notifications-outline" size={40} color={NAVY} />
          </View>
          <Text style={styles.queuedTitle}>We&apos;re analyzing your scan…</Text>
          <Text style={styles.queuedSubtitle}>
            This usually takes a few minutes. We&apos;ll open your report automatically when it&apos;s ready.
          </Text>
          <View style={styles.queuedActions}>
            <Pressable
              style={({ pressed }) => [styles.queuedBtnPrimary, pressed && styles.pressedBtn]}
              onPress={() => router.push("/(drawer)/history")}
            >
              <Text style={styles.btnNavyText}>View scan history</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.queuedBtnSecondary, pressed && styles.pressedBtn]}
              onPress={() => router.push("/(drawer)")}
            >
              <Text style={styles.btnOutlineText}>Go to dashboard</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
      </View>
    );
  }

  // ── Review phase ──
  if (phase === "review" || uris.length >= N) {
    const gridH = SCREEN_H * 0.48;
    const canStartAnalysis = uris.length >= N && !busy;
    return (
      <View style={styles.screenRoot}>
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

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + 8}
        >
        <ScrollView
          contentContainerStyle={styles.reviewScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

          {!busy && resultId == null ? (
            <View style={styles.scanNameCard}>
              <Text style={styles.scanNameLabel}>Name this scan</Text>
              <TextInput
                style={styles.scanNameInput}
                placeholder={SCAN_NAME_INPUT_PLACEHOLDER}
                placeholderTextColor="rgba(44, 62, 107, 0.4)"
                value={scanName}
                onChangeText={setScanName}
                maxLength={255}
                returnKeyType="done"
                autoCorrect={false}
                editable={!busy}
              />
              <Text style={styles.scanNameHint}>
                Leave blank to save as "{resolveScanName("")}".
              </Text>
            </View>
          ) : null}

          {/* Pre-scan actions */}
          {!busy && resultId == null && (
            <View style={styles.reviewActions}>
              <Pressable
                style={[styles.btnNavy, !canStartAnalysis && styles.disabled]}
                onPress={() => void runScan()}
                disabled={!canStartAnalysis}
              >
                <View style={styles.btnRow}>
                  <Ionicons name="scan-outline" size={20} color="#fff" />
                  <Text style={styles.btnNavyText}>Start analysis</Text>
                </View>
              </Pressable>

              <Pressable style={styles.recaptureLink} onPress={startOver}>
                <Ionicons name="refresh-outline" size={18} color="#52525b" />
                <Text style={styles.recaptureLinkText}>Recapture Image</Text>
              </Pressable>
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
        </ScrollView>
        {busy ? (
          <View style={styles.analyzingOverlay}>
            <Text style={styles.analyzingTitle}>Submitting</Text>
            <Text style={styles.analyzingSub}>Just a moment…</Text>
          </View>
        ) : null}
        </KeyboardAvoidingView>
      </LinearGradient>
      </View>
    );
  }

  // ── Intro phase ──
  return (
    <View style={styles.screenRoot}>
    <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
      {/* Camera modal rendered here so it overlays everything */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <FiveAngleCameraStep
          variant="dashboard"
          stepIndex={stepIndex}
          onCaptured={handleCaptured}
          onPickFromLibrary={() => void pickFromLibrary()}
          onBack={handleBackFromCamera}
          busy={busy}
        />
      </Modal>

      <Header title="Take a Selfie" onBack={() => router.navigate("/(drawer)" as Href)} dark />

      <ScrollView
        contentContainerStyle={styles.introScroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Rectangular live camera preview */}
        <View style={[styles.frameWrap, { width: frameW, height: frameH }]}>
          {/* Live camera feed behind the SVG mask */}
          {camPermission?.granted && phase === "intro" && (
            <CameraView style={StyleSheet.absoluteFill} facing="front" />
          )}
          {!camPermission?.granted && (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "#0D0D0D", borderRadius: frameRadius },
              ]}
            />
          )}
          {/* Camera icon hint */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.frameIcon}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: "#E8EFE6" },
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
  frameWrap: {
    overflow: "hidden",
    alignSelf: "center",
    marginBottom: 24,
  },
  frameIcon: {
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
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 20,
    position: "relative",
  },
  reviewScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 16,
  },
  scanNameCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scanNameLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 10,
  },
  scanNameInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: NAVY,
  },
  scanNameHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
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

  queuedBody: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  queuedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(43, 58, 103, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  queuedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A2E",
    textAlign: "center",
    lineHeight: 28,
    maxWidth: 280,
  },
  queuedSubtitle: {
    fontSize: 14,
    color: "#52525b",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
    marginTop: -8,
  },
  queuedActions: {
    width: "100%",
    maxWidth: 320,
    gap: 12,
    marginTop: 8,
  },
  queuedBtnPrimary: {
    width: "100%",
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  queuedBtnSecondary: {
    width: "100%",
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: NAVY,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  pressedBtn: { opacity: 0.88 },
});
