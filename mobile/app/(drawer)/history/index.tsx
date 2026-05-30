import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
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
import { getCached, setCached } from "@/lib/apiCache";
import { analysisResultsToParams } from "@/lib/skinAnalysis";
import {
  buildScanReportPdfPayload,
  type PatientScanDetailForPdf,
} from "@/lib/buildScanReportPdfPayload";
import { ReportContainImage } from "@/components/ReportContainImage";
import { shareScanReportPdf } from "@/lib/scanReportPdf";

type ScanRow = {
  id: number;
  scanName: string | null;
  imageUrl: string;
  overallScore: number;
  analysisResults: unknown;
  createdAt: string;
  aiSummary: string | null;
};

type VisitAttachment = {
  fileName: string;
  mimeType: string;
  dataUri: string;
};

type VisitRow = {
  id: string;
  visitDateYmd: string;
  doctorName: string;
  notes: string;
  attachments?: VisitAttachment[] | null;
  purpose?: string | null;
  treatments?: string | null;
  responseRating?: string | null;
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
  visitNotes: VisitRow[];
  reportVoiceNotes?: ReportVoiceRow[];
  reportVoiceNotesArchived?: ReportVoiceRow[];
};

const NAVY = "#2C3E6B";
const GREEN_ACCENT = "#16a34a";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";

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
  const [pdfScanId, setPdfScanId] = useState<number | null>(null);
  const [voiceBusyId, setVoiceBusyId] = useState<string | null>(null);
  const [showArchivedReportAudio, setShowArchivedReportAudio] = useState(false);
  const [activeTab, setActiveTab] = useState<"scans" | "visits">("scans");

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

  async function downloadPdf(scanId: number) {
    if (!token) return;
    setPdfScanId(scanId);
    try {
      const detail = await apiJson<PatientScanDetailForPdf>(
        `/api/patient/scans/${scanId}`,
        token,
        { method: "GET" }
      );
      const payload = await buildScanReportPdfPayload(detail, token);
      await shareScanReportPdf(payload);
    } catch (e) {
      Alert.alert(
        "PDF",
        e instanceof Error ? e.message : "Could not create or share the PDF."
      );
    } finally {
      setPdfScanId(null);
    }
  }

  if (loading && !data) {
    return (
      <View style={styles.loadingScreen}>
        <AnalysisMagicLoader
          title="Assembling your timeline"
          subtitle="kAI is pulling your progress, visits, and care notes."
          steps={[
            "Scan reports",
            "Clinic visits",
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

  const patient = data?.patient;
  const scans = data?.scans ?? [];
  const visits = data?.visitNotes ?? [];
  const reportVoices = data?.reportVoiceNotes ?? [];
  const reportVoicesArchived = data?.reportVoiceNotesArchived ?? [];

  const showingScans = activeTab === "scans";
  const showingVisits = activeTab === "visits";

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push("/(drawer)" as any);
          }}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={styles.headerTitle}>Treatment History</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, showingScans && styles.tabBtnActive]}
          onPress={() => setActiveTab("scans")}
        >
          <Text style={[styles.tabBtnText, showingScans && styles.tabBtnTextActive]}>Scans</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, showingVisits && styles.tabBtnActive]}
          onPress={() => setActiveTab("visits")}
        >
          <Text style={[styles.tabBtnText, showingVisits && styles.tabBtnTextActive]}>Visits</Text>
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
      {showingScans ? (
        <>
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
                    <Text style={styles.scoreBadgeText}>{scan.overallScore}</Text>
                  </View>
                </View>
                <View style={styles.scanBody}>
                  <Text style={styles.scanName} numberOfLines={2}>
                    {scan.scanName?.trim() || "Untitled scan"}
                  </Text>
                  <Text style={styles.scanDate}>
                    {format(new Date(scan.createdAt), "MMM d, yyyy")}
                  </Text>
                  <Text style={styles.scanOverall}>Overall {scan.overallScore}/100</Text>
                  <View style={styles.chips}>
                    {analysisResultsToParams(scan.analysisResults).map((p) => (
                      <View key={p.label} style={styles.chip}>
                        <Text style={styles.chipText}>
                          {p.label} {p.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.scanActions}>
                    <Pressable
                      style={styles.btnOutline}
                      onPress={() => downloadPdf(scan.id)}
                      disabled={pdfScanId === scan.id}
                    >
                      <Text style={styles.btnOutlineText}>
                        {pdfScanId === scan.id ? "PDF…" : "Download PDF"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.btnPrimary}
                      onPress={() => router.push(`/(drawer)/history/${scan.id}`)}
                    >
                      <Text style={styles.btnPrimaryText}>View details</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
      )}

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
        </>
      ) : null}

      {showingVisits ? (
      <View style={[styles.visitSection, CARD, { marginTop: 16 }]}>
        <Text style={styles.subsectionTitle}>Clinic notes</Text>
        {visits.length === 0 ? (
          <Text style={styles.empty}>No clinic notes yet.</Text>
        ) : (
          visits.map((visit) => (
            <View key={visit.id} style={styles.visitCard}>
              <View style={styles.visitHeader}>
                <Text style={styles.visitDate}>
                  {format(parseISO(`${visit.visitDateYmd}T12:00:00`), "MMM d, yyyy")}
                </Text>
                <Text style={styles.visitDoc}>{visit.doctorName}</Text>
              </View>
              {visit.purpose ? (
                <Text style={styles.visitNotesBody}>Purpose: {visit.purpose}</Text>
              ) : null}
              {visit.treatments ? (
                <Text style={[styles.visitNotesBody, { marginTop: 6 }]}>
                  Treatments: {visit.treatments}
                </Text>
              ) : null}
              <View style={[styles.visitNotesBox, { marginTop: 10 }]}>
                <Text style={styles.visitNotesLabel}>Notes</Text>
                <Text style={styles.visitNotesBody}>{visit.notes}</Text>
                {visit.attachments && visit.attachments.length > 0 ? (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: GLASS_BORDER }}>
                    <Text style={styles.visitNotesLabel}>Documents</Text>
                    {visit.attachments.map((att, idx) => (
                      <Pressable
                        key={`${visit.id}-att-${idx}`}
                        onPress={() => {
                          if (att.dataUri.startsWith("http")) {
                            void Linking.openURL(att.dataUri);
                          }
                        }}
                        style={{ marginTop: 6 }}
                      >
                        <Text style={styles.attachLink}>{att.fileName}</Text>
                        <Text style={styles.attachMeta}>{att.mimeType}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              {visit.responseRating ? (
                <Text style={[styles.editLink, { marginTop: 10, color: "#0f766e" }]}>
                  Response: {visit.responseRating}
                </Text>
              ) : null}
              <Pressable
                style={{ marginTop: 12 }}
                onPress={() => router.push(`/(drawer)/history/visit/${visit.id}` as any)}
              >
                <Text style={styles.editLink}>View full visit details</Text>
              </Pressable>
            </View>
          ))
        )}
        <Pressable
          style={{ marginTop: visits.length > 0 ? 8 : 0 }}
          onPress={() => router.push("/(drawer)/history/visits" as any)}
        >
          <Text style={styles.editLink}>All visits & notes</Text>
        </Pressable>
      </View>
      ) : null}
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
    if (!uri.startsWith("data:")) return uri;
    if (fileRef.current) return fileRef.current;
    const commaIndex = uri.indexOf(",");
    if (commaIndex < 0) throw new Error("Invalid audio data URI");
    const meta = uri.slice(5, commaIndex).toLowerCase();
    const mime = meta.split(";")[0] ?? "audio/m4a";
    const base64 = uri.slice(commaIndex + 1);
    const rawExt = mime.split("/")[1] ?? "m4a";
    const ext = rawExt === "x-wav" ? "wav" : rawExt;
    const path = `${FileSystem.cacheDirectory}hist_voice_${Date.now()}.${ext}`;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
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
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (!soundRef.current) {
        const playUri = await resolveUri();
        const { sound } = await Audio.Sound.createAsync({ uri: playUri });
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

const BG = "#E8EFE6";

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
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#18181b" },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  tabBtnText: { fontSize: 14, fontWeight: "700", color: NAVY },
  tabBtnTextActive: { color: "#fff" },
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
  visitNotesBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 14,
  },
  visitNotesLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  visitNotesBody: { fontSize: 14, lineHeight: 22, color: "#374151" },
  attachLink: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    textDecorationLine: "underline",
  },
  attachMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  visitCardNew: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  visitCardFirst: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  visitCardRest: {
    backgroundColor: "rgba(232,239,230,0.6)",
  },
  vcRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  vcTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vcDate: { fontSize: 16, fontWeight: "700", color: "#18181b" },
  latestPill: {
    backgroundColor: `${GREEN_ACCENT}18`,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  latestText: { fontSize: 11, fontWeight: "700", color: GREEN_ACCENT },
  vcTreatment: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  vcDoctor: { fontSize: 13, color: "#9CA3AF", marginTop: 1 },
  vcRatingPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  vcRatingText: { fontSize: 12, fontWeight: "700" },
});
