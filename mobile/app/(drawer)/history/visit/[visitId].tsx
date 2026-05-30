import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import { getCached, setCached } from "@/lib/apiCache";

const NAVY = "#2B3A67";
const BG: [string, string] = ["#E8EFE6", "#DCE8D4"];
const TEXT_PRIMARY = "#1A1A2E";
const TEXT_MUTED = "#52525b";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

type Attachment = { fileName: string; mimeType: string; dataUri: string };

type Visit = {
  id: string;
  visitDate: string;
  doctorName: string;
  purpose: string | null;
  treatments: string | null;
  preAdvice: string | null;
  postAdvice: string | null;
  notes: string | null;
  prescription: string | null;
  responseRating: string | null;
  attachments: Attachment[] | null;
};

type VisitPayload = {
  visit: Visit;
};

const RATING_COLORS: Record<string, { bg: string; text: string }> = {
  excellent: { bg: "#dcfce7", text: "#166534" },
  good: { bg: "#dcfce7", text: "#166534" },
  moderate: { bg: "#fef9c3", text: "#854d0e" },
  poor: { bg: "#fee2e2", text: "#991b1b" },
};

async function saveAndShare(att: Attachment) {
  try {
    const dir = FileSystem.cacheDirectory + "attachments/";
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const filePath = dir + att.fileName;

    if (att.dataUri.startsWith("data:")) {
      const base64 = att.dataUri.split(",")[1];
      await FileSystem.writeAsStringAsync(filePath, base64, { encoding: "base64" });
    } else {
      await FileSystem.downloadAsync(att.dataUri, filePath);
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: att.mimeType,
        dialogTitle: att.fileName,
        UTI: att.mimeType === "application/pdf" ? "com.adobe.pdf" : undefined,
      });
    } else {
      Alert.alert("Saved", `File saved to ${filePath}`);
    }
  } catch (e) {
    Alert.alert("Download failed", e instanceof Error ? e.message : "Could not save file.");
  }
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionBody}>{body}</Text>
    </View>
  );
}

export default function VisitDetailScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = visitId ? `visit:${visitId}` : null;

  const loadVisit = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!token || !visitId) return;
      const force = opts?.force === true;
      if (!force && cacheKey) {
        const cached = await getCached<Visit>(cacheKey);
        if (cached) {
          setVisit(cached);
        }
      }
      const data = await apiJson<VisitPayload>(
        `/api/patient/visits/${encodeURIComponent(visitId)}`,
        token,
        { method: "GET" }
      );
      setVisit(data.visit ?? null);
      if (cacheKey && data.visit) {
        await setCached(cacheKey, data.visit);
      }
    },
    [token, visitId, cacheKey]
  );

  useFocusEffect(
    useCallback(() => {
      if (!token || !visitId) return;
      setLoading(true);
      loadVisit()
        .catch(() => setVisit(null))
        .finally(() => setLoading(false));
    }, [token, visitId, loadVisit])
  );

  if (loading) {
    return (
      <LinearGradient colors={BG} style={[s.center, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={NAVY} />
      </LinearGradient>
    );
  }

  if (!visit) {
    return (
      <LinearGradient colors={BG} style={[s.center, { paddingTop: insets.top + 60 }]}>
        <Text style={{ color: TEXT_MUTED }}>Visit not found.</Text>
      </LinearGradient>
    );
  }

  const ratingKey = visit.responseRating?.toLowerCase() ?? "";
  const ratingStyle = RATING_COLORS[ratingKey];

  return (
    <LinearGradient colors={BG} style={{ flex: 1 }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.push("/(drawer)/history/visits" as any)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={NAVY} />
        </Pressable>
        <Text style={s.headerTitle}>Visit Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await loadVisit({ force: true });
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
      >
        {/* Summary card */}
        <View style={s.card}>
          <Text style={s.date}>{fmtDate(visit.visitDate)}</Text>
          <Text style={s.doctor}>with Dr. {visit.doctorName}</Text>

          {visit.responseRating && ratingStyle ? (
            <View style={[s.ratingPill, { backgroundColor: ratingStyle.bg }]}>
              <Text style={[s.ratingText, { color: ratingStyle.text }]}>
                {visit.responseRating.charAt(0).toUpperCase() + visit.responseRating.slice(1)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Detail sections */}
        {visit.purpose ? <Section title="Purpose" body={visit.purpose} /> : null}
        {visit.treatments ? <Section title="Treatments" body={visit.treatments} /> : null}
        {visit.preAdvice ? <Section title="Pre-Treatment Advice" body={visit.preAdvice} /> : null}
        {visit.postAdvice ? <Section title="Post-Treatment Advice" body={visit.postAdvice} /> : null}
        {visit.prescription ? <Section title="Prescription" body={visit.prescription} /> : null}
        {visit.notes ? <Section title="Doctor's Notes" body={visit.notes} /> : null}

        {visit.attachments && visit.attachments.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Attachments</Text>
            {visit.attachments.map((att, idx) => {
              const isImage = att.mimeType.startsWith("image/");
              if (isImage) {
                return (
                  <View key={idx} style={s.attachmentImageWrap}>
                    <Image
                      source={{ uri: att.dataUri }}
                      style={s.attachmentImage}
                      resizeMode="contain"
                    />
                    <View style={s.attachmentFooter}>
                      <Text style={s.attachmentFileName} numberOfLines={1}>
                        {att.fileName}
                      </Text>
                      <Pressable
                        style={s.downloadBtn}
                        onPress={() => saveAndShare(att)}
                        hitSlop={8}
                      >
                        <Ionicons name="download-outline" size={18} color={NAVY} />
                        <Text style={s.downloadBtnText}>Save</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }
              return (
                <View key={idx} style={s.attachmentFile}>
                  <Ionicons
                    name={att.mimeType === "application/pdf" ? "document-text" : "document-attach"}
                    size={22}
                    color={NAVY}
                  />
                  <Text style={s.attachmentFileText} numberOfLines={1}>
                    {att.fileName}
                  </Text>
                  <Pressable
                    style={s.downloadBtn}
                    onPress={() => saveAndShare(att)}
                    hitSlop={8}
                  >
                    <Ionicons name="download-outline" size={18} color={NAVY} />
                    <Text style={s.downloadBtnText}>Save</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: NAVY },
  content: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  date: { fontSize: 20, fontWeight: "700", color: TEXT_PRIMARY },
  doctor: { fontSize: 14, color: TEXT_MUTED, marginTop: 4 },
  ratingPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  ratingText: { fontSize: 13, fontWeight: "700" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionBody: { fontSize: 15, color: TEXT_PRIMARY, lineHeight: 22 },
  attachmentImageWrap: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f4f4f5",
  },
  attachmentImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  attachmentFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  attachmentFileName: {
    fontSize: 12,
    color: TEXT_MUTED,
    flex: 1,
    marginRight: 8,
  },
  attachmentFile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  attachmentFileText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: "500",
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e0e5df",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
  },
});
