import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import {
  buildScanReportPdfPayload,
  type PatientScanDetailForPdf,
} from "@/lib/buildScanReportPdfPayload";
import { resolveAuthenticatedScanImageSource } from "@/lib/resolveScanImage";
import { shareScanReportPdf } from "@/lib/scanReportPdf";

type ScanRow = {
  id: number;
  scanName: string | null;
  imageUrl: string;
  overallScore: number;
  acne: number;
  pigmentation: number;
  wrinkles: number;
  hydration: number;
  texture: number;
  eczema: number;
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

const CARD = {
  backgroundColor: "#fff",
  borderRadius: 22,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "#f4f4f5",
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
};

export default function HistoryListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfScanId, setPdfScanId] = useState<number | null>(null);
  const [voiceBusyId, setVoiceBusyId] = useState<string | null>(null);
  const [showArchivedReportAudio, setShowArchivedReportAudio] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const json = await apiJson<HistoryPayload>("/api/patient/history", token, {
      method: "GET",
    });
    setData(json);
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
        <View style={styles.loadingCard}>
          <View style={styles.loadingPulse} />
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingTitle}>Loading treatment history</Text>
          <Text style={styles.loadingHint}>
            Fetching your scans, visits, and notes.
          </Text>
        </View>
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

  return (
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
      {patient ? (
        <View style={[styles.profileCard, CARD]}>
          <View style={styles.profileRow}>
            <View style={styles.avatarRing}>
              <Ionicons name="person" size={40} color="#6B8E8E" />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.pName}>{patient.name}</Text>
              <Text style={styles.pMeta} numberOfLines={1}>
                {patient.email}
              </Text>
              <Text style={styles.pMeta}>
                Phone:{" "}
                <Text style={styles.pStrong}>{patient.phone ?? "Not set"}</Text>
              </Text>
              <Text style={styles.pMeta}>
                Age:{" "}
                <Text style={styles.pStrong}>
                  {patient.age != null ? String(patient.age) : "Not set"}
                </Text>
              </Text>
              <Text style={styles.pMeta}>
                Skin type:{" "}
                <Text style={styles.pTeal}>{patient.skinType ?? "Not set"}</Text>
              </Text>
              <Text style={styles.pMeta}>
                Primary goal:{" "}
                <Text style={styles.pTeal}>{patient.primaryGoal ?? "Not set"}</Text>
              </Text>
              <Pressable onPress={() => router.push("/(drawer)/profile")}>
                <Text style={styles.editLink}>Edit profile</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

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
                <Image
                  source={resolveAuthenticatedScanImageSource(scan.imageUrl, token)}
                  style={styles.scanImage}
                  resizeMode="cover"
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
                  {(
                    [
                      ["Acne", scan.acne],
                      ["Wrinkle", scan.wrinkles],
                      ["Pores", scan.texture],
                      ["Pigment.", scan.pigmentation],
                      ["Hydration", scan.hydration],
                      ["Eczema", scan.eczema],
                    ] as const
                  ).map(([label, val]) => (
                    <View key={label} style={styles.chip}>
                      <Text style={styles.chipText}>
                        {label} {val}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.chipsHint}>
                  These are six summary scores on the card (not separate photos).
                  Open the report for every metric and capture angle.
                </Text>
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
          reportVoices.map((vn) => (
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
                    vn.listened ? { backgroundColor: "#0d9488", borderColor: "#0d9488" } : null,
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
          ))
        )}
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

        <Text style={[styles.subsectionTitle, { marginTop: 24 }]}>Clinic notes</Text>
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
              <View style={styles.visitNotesBox}>
                <Text style={styles.visitNotesLabel}>Notes</Text>
                <Text style={styles.visitNotesBody}>{visit.notes}</Text>
                {visit.attachments && visit.attachments.length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.visitNotesLabel}>Documents</Text>
                    {visit.attachments.map((att, i) => (
                      <Pressable
                        key={`${visit.id}-att-${i}`}
                        onPress={() => {
                          void Linking.openURL(att.dataUri).catch(() => {
                            Alert.alert(
                              "Could not open file",
                              "Try opening Treatment history on the web app to download this file."
                            );
                          });
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
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function HistoryAudioPlayButton({ uri }: { uri: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      style={styles.voiceBtn}
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
          const { sound } = await Audio.Sound.createAsync({ uri });
          await sound.playAsync();
          sound.setOnPlaybackStatusUpdate((st) => {
            if (st.isLoaded && st.didJustFinish) void sound.unloadAsync();
          });
        } catch {
          /* ignore */
        } finally {
          setBusy(false);
        }
      }}
    >
      <Text style={styles.voiceBtnText}>{busy ? "…" : "Play voice note"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fdf9f0" },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fdf9f0",
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    backgroundColor: "#fff",
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(24, 24, 27, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
  },
  loadingPulse: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(13, 148, 136, 0.12)",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(13, 148, 136, 0.2)",
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "700",
    color: "#18181b",
    textAlign: "center",
  },
  loadingHint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#52525b",
    textAlign: "center",
  },
  err: { color: "#b91c1c", padding: 16 },
  profileCard: { padding: 20, marginBottom: 8 },
  profileRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "#e4e4e7",
    backgroundColor: "rgba(224, 240, 237, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: { flex: 1, minWidth: 0 },
  pName: { fontSize: 20, fontWeight: "700", color: "#18181b" },
  pMeta: { fontSize: 14, color: "#52525b", marginTop: 4 },
  pStrong: { fontWeight: "600", color: "#18181b" },
  pTeal: { fontWeight: "600", color: "#0f766e" },
  editLink: { marginTop: 10, fontSize: 14, fontWeight: "600", color: "#0d9488" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#18181b", marginBottom: 12 },
  empty: { textAlign: "center", color: "#52525b", paddingVertical: 20, fontSize: 14 },
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
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
  },
  scoreBadgeText: { fontSize: 20, fontWeight: "700", color: "#0f766e" },
  scanBody: { padding: 14 },
  scanName: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  scanDate: { fontSize: 12, color: "#71717a", marginTop: 4 },
  scanOverall: { fontSize: 18, fontWeight: "700", color: "#0f766e", marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: "rgba(224, 240, 237, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: { fontSize: 10, fontWeight: "700", color: "#134e4a" },
  chipsHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: "#71717a",
  },
  scanActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btnOutline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
  },
  btnOutlineText: { fontSize: 13, fontWeight: "700", color: "#3f3f46" },
  btnPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#0d9488",
  },
  btnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  subsectionTitle: { fontSize: 16, fontWeight: "700", color: "#18181b", marginBottom: 12 },
  voiceBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#7dd3fc",
  },
  voiceBtnText: { fontSize: 14, fontWeight: "700", color: "#0369a1" },
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
    borderColor: "#0d9488",
  },
  voiceListenLabel: { fontSize: 14, color: "#27272a", flex: 1 },
  voiceArchiveBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#fff",
  },
  voiceArchiveBtnText: { fontSize: 13, fontWeight: "700", color: "#3f3f46" },
  visitSection: { padding: 16 },
  visitCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(253, 249, 240, 0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#f4f4f5",
  },
  visitHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  visitDate: { fontSize: 14, fontWeight: "600", color: "#0f766e" },
  visitDoc: { fontSize: 14, color: "#52525b" },
  visitNotesBox: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
    padding: 14,
  },
  visitNotesLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#71717a",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  visitNotesBody: { fontSize: 14, lineHeight: 22, color: "#3f3f46" },
  attachLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f766e",
    textDecorationLine: "underline",
  },
  attachMeta: { fontSize: 12, color: "#71717a", marginTop: 2 },
});
