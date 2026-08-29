import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { format } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnalysisMagicLoader } from "@/components/AnalysisMagicLoader";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { configurePlaybackAudioMode, primeAudioSessionForPlayback } from "@/lib/audioSession";
import { getCached, setCached } from "@/lib/apiCache";
import { resolvePlayableAudioUri } from "@/lib/resolvePlayableAudioUri";
import { analysisResultsToParams } from "@/lib/skinAnalysis";
import { patientClarityToGrade, patientScoreView } from "../../../../src/lib/clarityGrade";
import { ReportContainImage } from "@/components/ReportContainImage";

type ScanRow = {
  id: number;
  scanName: string | null;
  imageUrl: string;
  overallScore: number;
  analysisResults: unknown;
  createdAt: string;
  aiSummary: string | null;
};

type ReportVoiceRow = {
  id: string;
  scanId: number;
  scanLabel: string;
  audioDataUri: string;
  createdAt: string;
  listened: boolean;
};

type HistoryPayload = {
  patient: {
    name: string;
    email: string;
    phone: string | null;
    age: number | null;
    skinType: string | null;
    primaryGoal: string | null;
  };
  scans: ScanRow[];
  clinicReports?: Array<{
    id: string;
    title: string;
    kind: "external_clinic_report";
    status: string;
    createdAt: string;
    downloadUrl: string;
  }>;
  reportVoiceNotes?: ReportVoiceRow[];
  reportVoiceNotesArchived?: ReportVoiceRow[];
  scoresUnlocked?: boolean;
};

const NAVY = "#1E1B31";
const GREEN_ACCENT = "#16a34a";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";
const DASHBOARD_HREF = "/(drawer)" as Href;

const CARD = {
  backgroundColor: GLASS,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: GLASS_BORDER,
};

export default function HistoryListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceBusyId, setVoiceBusyId] = useState<string | null>(null);
  const [showArchivedReportAudio, setShowArchivedReportAudio] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const cached = await getCached<HistoryPayload>("history");
    if (cached) {
      setData(cached);
    }
    const json = await apiJson<HistoryPayload>("/api/patient/history", token, {
      method: "GET",
    });
    setData(json);
    await setCached("history", json);
  }, [token]);

  const patchReportVoice = useCallback(
    async (id: string, body: { listened?: boolean; archived?: boolean }) => {
      if (!token) return;
      setVoiceBusyId(id);
      try {
        await apiJson(`/api/patient/voice-notes/${id}`, token, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        await load();
      } catch {
        /* ignore */
      } finally {
        setVoiceBusyId(null);
      }
    },
    [token, load]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (alive) {
          setError(e instanceof ApiError ? e.message : "Could not load history.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.loadingScreen}>
        <AnalysisMagicLoader
          title="Assembling your timeline"
          subtitle="kAI is pulling your progress and care notes."
          steps={[
            "Scan reports",
            "Doctor notes",
            "Audio summaries",
          ]}
        />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{error}</Text>
      </View>
    );
  }

  const scans = data?.scans ?? [];
  const clinicReports = data?.clinicReports ?? [];
  const scoresUnlocked = data?.scoresUnlocked ?? false;
  const scoreLabel = (raw: number) =>
    scoresUnlocked ? patientScoreView(raw, true).label : patientClarityToGrade(raw);
  const reportVoices = data?.reportVoiceNotes ?? [];
  const reportVoicesArchived = data?.reportVoiceNotesArchived ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.replace(DASHBOARD_HREF)}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityLabel="Back to dashboard"
        >
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={styles.headerTitle}>Treatment History</Text>
        <Pressable
          onPress={() => router.push("/(drawer)/scan")}
          style={styles.headerActionBtn}
          hitSlop={12}
          accessibilityLabel="Take scan"
        >
          <Ionicons name="camera-outline" size={22} color={NAVY} />
        </Pressable>
      </View>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await load();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      <Text style={styles.sectionTitle}>Progress tracker</Text>
      {scans.length === 0 ? (
        <Text style={styles.empty}>
          No scans yet. Complete your first AI scan to track progress.
        </Text>
      ) : (
        <View style={styles.scanGrid}>
          {scans.map((scan) => (
            <View key={scan.id} style={[styles.scanCard, CARD]}>
              <View style={styles.scanImageWrap}>
                <ReportContainImage
                  imageUrl={scan.imageUrl}
                  authToken={token}
                  resizeMode="cover"
                  style={styles.scanImage}
                />
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreBadgeText}>{scoreLabel(scan.overallScore)}</Text>
                </View>
              </View>
              <View style={styles.scanBody}>
                <Text style={styles.scanName} numberOfLines={2}>
                  {scan.scanName?.trim() || "Untitled scan"}
                </Text>
                <Text style={styles.scanDate}>
                  {format(new Date(scan.createdAt), "MMM d, yyyy")}
                </Text>
                <Text style={styles.scanOverall}>Overall {scoreLabel(scan.overallScore)}</Text>
                <View style={styles.chips}>
                  {analysisResultsToParams(scan.analysisResults).map((p) => (
                    <View key={p.label} style={styles.chip}>
                      <Text style={styles.chipText}>
                        {p.label} {scoreLabel(p.value)}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.scanActions}>
                  <Pressable
                    style={styles.btnPrimary}
                    onPress={() => router.push(`/(drawer)/history/${scan.id}`)}
                  >
                    <Text style={styles.btnPrimaryText}>View report</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {clinicReports.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <Text style={styles.sectionTitle}>Clinic skin reports</Text>
          {clinicReports.map((report) => (
            <View key={report.id} style={[styles.visitCard, CARD, { marginBottom: 12 }]}>
              <View style={styles.visitHeader}>
                <Text style={styles.visitDate} numberOfLines={2}>
                  {report.title}
                </Text>
              </View>
              <Text style={styles.visitDoc}>
                {format(new Date(report.createdAt), "MMM d, yyyy")}
              </Text>
              <Pressable
                style={[styles.btnPrimary, { marginTop: 10 }]}
                onPress={() => {
                  void import("expo-linking").then(({ openURL }) =>
                    openURL(report.downloadUrl)
                  );
                }}
              >
                <Text style={styles.btnPrimaryText}>View PDF</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.visitSection, CARD, { marginTop: 28 }]}>
        <Text style={styles.subsectionTitle}>Audio notes</Text>
        {reportVoices.length === 0 ? (
          <Text style={styles.empty}>No audio notes for your reports yet.</Text>
        ) : (
          <>
            {reportVoices.map((vn) => (
              <View key={vn.id} style={styles.visitCard}>
                <View style={styles.visitHeader}>
                  <Text style={styles.visitDate} numberOfLines={2}>
                    {vn.scanLabel}
                  </Text>
                  <Text style={styles.visitDoc}>
                    {format(new Date(vn.createdAt), "MMM d, yyyy")}
                  </Text>
                </View>
                <HistoryAudioPlayButton uri={vn.audioDataUri} />
                <Pressable
                  style={styles.voiceListenRow}
                  disabled={voiceBusyId === vn.id}
                  onPress={() =>
                    void patchReportVoice(vn.id, { listened: !vn.listened })
                  }
                >
                  <View
                    style={[
                      styles.voiceCheck,
                      vn.listened ? { backgroundColor: GREEN_ACCENT, borderColor: GREEN_ACCENT } : null,
                    ]}
                  />
                  <Text style={styles.voiceListenLabel}>I listened</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.voiceArchiveBtn,
                    { opacity: vn.listened && voiceBusyId !== vn.id ? 1 : 0.45 },
                  ]}
                  disabled={!vn.listened || voiceBusyId === vn.id}
                  onPress={() => void patchReportVoice(vn.id, { archived: true })}
                >
                  <Text style={styles.voiceArchiveBtnText}>Archive</Text>
                </Pressable>
                <Pressable onPress={() => router.push(`/(drawer)/history/${vn.scanId}`)}>
                  <Text style={[styles.editLink, { marginTop: 8 }]}>Open report</Text>
                </Pressable>
              </View>
            ))}
            {reportVoicesArchived.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Pressable onPress={() => setShowArchivedReportAudio((v) => !v)}>
                  <Text style={styles.editLink}>
                    {showArchivedReportAudio ? "Hide" : "Show"} archived report audio (
                    {reportVoicesArchived.length})
                  </Text>
                </Pressable>
                {showArchivedReportAudio
                  ? reportVoicesArchived.map((vn) => (
                      <View key={vn.id} style={[styles.visitCard, { marginTop: 10 }]}>
                        <View style={styles.visitHeader}>
                          <Text style={styles.visitDate} numberOfLines={2}>
                            {vn.scanLabel}
                          </Text>
                          <Text style={styles.visitDoc}>
                            {format(new Date(vn.createdAt), "MMM d, yyyy")}
                          </Text>
                        </View>
                        <HistoryAudioPlayButton uri={vn.audioDataUri} />
                      </View>
                    ))
                  : null}
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

function HistoryAudioPlayButton({ uri }: { uri: string }) {
  const [playing, setPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [positionSec, setPositionSec] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const fileRef = useRef<string | null>(null);

  const resolveUri = useCallback(async (): Promise<string> => {
    if (fileRef.current) return fileRef.current;
    const path = await resolvePlayableAudioUri(uri, "hist_voice");
    fileRef.current = path;
    return path;
  }, [uri]);

  const cleanup = useCallback(async () => {
    try { await soundRef.current?.unloadAsync(); } catch { /* */ }
    soundRef.current = null;
    setPlaying(false);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      await configurePlaybackAudioMode();
      await primeAudioSessionForPlayback();
      if (!soundRef.current) {
        const playUri = await resolveUri();
        const { sound } = await Audio.Sound.createAsync(
          { uri: playUri },
          { shouldPlay: false, volume: 1, isMuted: false }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded) return;
          setPositionSec(Math.floor((st.positionMillis ?? 0) / 1000));
          setDurationSec(Math.floor((st.durationMillis ?? 0) / 1000));
          if (st.didJustFinish) {
            setPlaying(false);
            setPositionSec(0);
            void sound.setPositionAsync(0);
          }
        });
      }
      await soundRef.current.playAsync();
      setPlaying(true);
    } catch (e) {
      console.warn("[HistoryAudioPlayer] error:", e);
      await cleanup();
    }
  }, [playing, resolveUri, cleanup]);

  useEffect(() => () => { void cleanup(); }, [cleanup]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const progress = durationSec > 0 ? positionSec / durationSec : 0;

  return (
    <View style={styles.playerRow}>
      <Pressable onPress={toggle} style={styles.playBtn} hitSlop={8}>
        <Ionicons name={playing ? "pause" : "play"} size={18} color="#fff" />
      </Pressable>
      <View style={styles.waveContainer}>
        {Array.from({ length: 20 }).map((_, i) => {
          const h = 5 + Math.sin(i * 0.7 + 2) * 7 + Math.cos(i * 1.3) * 3;
          const filled = i / 20 <= progress;
          return (
            <View
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 1.5,
                backgroundColor: filled ? NAVY : "#CBD5E1",
                marginHorizontal: 1,
              }}
            />
          );
        })}
      </View>
      <Text style={styles.playerTime}>{fmt(playing ? positionSec : durationSec)}</Text>
    </View>
  );
}

const BG = "#F0EAE2";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#18181b" },
  scroll: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG },
  loadingScreen: {
    flex: 1,
    backgroundColor: BG,
  },
  err: { color: "#b91c1c", padding: 16 },
  profileCard: { padding: 20, marginBottom: 8 },
  profileRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS,
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: { flex: 1, minWidth: 0 },
  pName: { fontSize: 20, fontWeight: "700", color: "#18181b" },
  pMeta: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  pStrong: { fontWeight: "600", color: "#18181b" },
  pTeal: { fontWeight: "600", color: NAVY },
  editLink: { marginTop: 10, fontSize: 14, fontWeight: "600", color: NAVY },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#18181b", marginBottom: 12 },
  empty: { textAlign: "center", color: "#6B7280", paddingVertical: 20, fontSize: 14 },
  scanGrid: { gap: 16 },
  scanCard: { overflow: "hidden" },
  scanImageWrap: {
    height: 192,
    backgroundColor: "#f4f4f5",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  scanImage: { width: "100%", height: "100%" },
  scoreBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  scoreBadgeText: { fontSize: 20, fontWeight: "700", color: GREEN_ACCENT },
  scanBody: { padding: 14 },
  scanName: { fontSize: 16, fontWeight: "700", color: "#18181b" },
  scanDate: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  scanOverall: { fontSize: 18, fontWeight: "800", color: GREEN_ACCENT, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: `${NAVY}12`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  chipText: { fontSize: 11, fontWeight: "700", color: NAVY },
  chipsHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: "#6B7280",
  },
  scanActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btnOutline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${NAVY}30`,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  btnOutlineText: { fontSize: 13, fontWeight: "700", color: NAVY },
  btnPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: NAVY,
  },
  btnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  subsectionTitle: { fontSize: 16, fontWeight: "800", color: "#18181b", marginBottom: 12 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  waveContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 24,
  },
  playerTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    minWidth: 34,
    textAlign: "right",
  },
  voiceBtn: {
    alignSelf: "flex-start",
    backgroundColor: `${NAVY}12`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${NAVY}25`,
  },
  voiceBtnText: { fontSize: 14, fontWeight: "700", color: NAVY },
  voiceListenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  voiceCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: GREEN_ACCENT,
  },
  voiceListenLabel: { fontSize: 14, color: "#374151", flex: 1 },
  voiceArchiveBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${NAVY}25`,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  voiceArchiveBtnText: { fontSize: 13, fontWeight: "700", color: NAVY },
  visitSection: { padding: 16 },
  visitCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  visitHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  visitDate: { fontSize: 14, fontWeight: "700", color: NAVY },
  visitDoc: { fontSize: 14, color: "#6B7280" },
});
