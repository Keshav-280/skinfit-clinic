import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import {
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
} from "@/lib/inboxReadCursors";
import {
  dismissUnreadReadyScan,
  getUnreadReadyScans,
  subscribeScanJobNotifications,
  type ReadyScanNotification,
} from "@/lib/scanJobNotifications";

export default function NotificationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [supportCount, setSupportCount] = useState(0);
  const [doctorCount, setDoctorCount] = useState(0);
  const [voiceNoteGeneralCount, setVoiceNoteGeneralCount] = useState(0);
  const [voiceNoteReportCount, setVoiceNoteReportCount] = useState(0);
  const [readyScans, setReadyScans] = useState<ReadyScanNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [supportSince, doctorSince] = await Promise.all([
        getClinicSupportInboxLastSeenIso(),
        getDoctorInboxLastSeenIso(),
      ]);
      const inboxQ = new URLSearchParams({ supportSince, doctorSince });
      const inbox = await apiJson<{
        total?: number;
        supportCount?: number;
        doctorCount?: number;
        voiceNoteCount?: number;
        voiceNoteGeneralCount?: number;
        voiceNoteReportCount?: number;
      }>(`/api/chat/inbox/unread?${inboxQ.toString()}`, token, { method: "GET" });
      setSupportCount(typeof inbox.supportCount === "number" ? inbox.supportCount : 0);
      setDoctorCount(typeof inbox.doctorCount === "number" ? inbox.doctorCount : 0);
      setVoiceNoteGeneralCount(
        typeof inbox.voiceNoteGeneralCount === "number" ? inbox.voiceNoteGeneralCount : 0
      );
      setVoiceNoteReportCount(
        typeof inbox.voiceNoteReportCount === "number" ? inbox.voiceNoteReportCount : 0
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        /* signed out */
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const refreshReadyScans = useCallback(async () => {
    setReadyScans(await getUnreadReadyScans());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshReadyScans();
      const unsub = subscribeScanJobNotifications(() => {
        void refreshReadyScans();
        void load();
      });
      return unsub;
    }, [load, refreshReadyScans])
  );

  async function markVoiceViewed(scope: "dashboard" | "report") {
    if (!token) return;
    try {
      await apiJson(`/api/patient/doctor-feedback/viewed`, token, {
        method: "POST",
        body: JSON.stringify({ scope }),
      });
    } catch {
      /* ignore */
    }
  }

  const totalUnread =
    supportCount +
    doctorCount +
    voiceNoteGeneralCount +
    voiceNoteReportCount +
    readyScans.length;
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={{ flex: 1 }}>
    <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingTop: insets.top + 16 }]}>
      <View style={s.header}>
        <View style={s.bellWrap}>
          <Ionicons name="notifications" size={30} color="#2B3A67" />
          {totalUnread > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{totalUnread > 9 ? "9+" : totalUnread}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Notifications</Text>
          <Text style={s.subtitle}>
            {totalUnread > 0
              ? `${totalUnread} unread notification${totalUnread > 1 ? "s" : ""}`
              : "You're all caught up!"}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#2B3A67" />
      ) : (
        <>
          {totalUnread > 0 && (
            <>
              <Text style={s.sectionLabel}>New activity</Text>

              {readyScans.map((scan) => (
                <Pressable
                  key={scan.scanId}
                  style={s.card}
                  onPress={() => {
                    void (async () => {
                      await dismissUnreadReadyScan(scan.scanId);
                      void refreshReadyScans();
                      router.push(`/(drawer)/history/${scan.scanId}`);
                    })();
                  }}
                >
                  <View style={[s.iconCircle, { backgroundColor: "#d1fae5" }]}>
                    <Ionicons name="sparkles" size={22} color="#047857" />
                  </View>
                  <View style={s.cardBody}>
                    <View style={s.cardTitleRow}>
                      <Text style={s.cardTitle}>Scan report ready</Text>
                      <View style={[s.countBadge, { backgroundColor: "#d1fae5" }]}>
                        <Text style={[s.countBadgeText, { color: "#047857" }]}>New</Text>
                      </View>
                    </View>
                    <Text style={s.cardSub}>{scan.title}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </Pressable>
              ))}

              {(supportCount > 0 || doctorCount > 0) && (
                <Pressable style={s.card} onPress={() => router.push("/(drawer)/chat")}>
                  <View style={[s.iconCircle, { backgroundColor: "#ccfbf1" }]}>
                    <Ionicons name="chatbubbles" size={22} color="#2C3E6B" />
                  </View>
                  <View style={s.cardBody}>
                    <View style={s.cardTitleRow}>
                      <Text style={s.cardTitle}>Chat with clinic</Text>
                      <View style={s.countBadge}>
                        <Text style={s.countBadgeText}>{supportCount + doctorCount}</Text>
                      </View>
                    </View>
                    <Text style={s.cardSub}>
                      {supportCount + doctorCount} unread from the care team
                    </Text>
                    <Text style={s.cardMeta}>
                      {supportCount > 0 ? `Support: ${supportCount}` : ""}
                      {supportCount > 0 && doctorCount > 0 ? "  ·  " : ""}
                      {doctorCount > 0 ? `Doctor: ${doctorCount}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </Pressable>
              )}

              {voiceNoteGeneralCount > 0 && (
                <Pressable
                  style={s.card}
                  onPress={() => {
                    void (async () => {
                      await markVoiceViewed("dashboard");
                      void load();
                      router.push("/(drawer)" as Href);
                    })();
                  }}
                >
                  <View style={[s.iconCircle, { backgroundColor: "#dbeafe" }]}>
                    <Ionicons name="mic" size={22} color="#1d4ed8" />
                  </View>
                  <View style={s.cardBody}>
                    <View style={s.cardTitleRow}>
                      <Text style={s.cardTitle}>Doctor voice note</Text>
                      <View style={[s.countBadge, { backgroundColor: "#dbeafe" }]}>
                        <Text style={[s.countBadgeText, { color: "#1d4ed8" }]}>New</Text>
                      </View>
                    </View>
                    <Text style={s.cardSub}>
                      New audio in the Voice notes section on your dashboard.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </Pressable>
              )}

              {voiceNoteReportCount > 0 && (
                <Pressable
                  style={s.card}
                  onPress={() => {
                    void (async () => {
                      await markVoiceViewed("report");
                      void load();
                      router.push("/(drawer)/history");
                    })();
                  }}
                >
                  <View style={[s.iconCircle, { backgroundColor: "#ede9fe" }]}>
                    <Ionicons name="document-text" size={22} color="#6d28d9" />
                  </View>
                  <View style={s.cardBody}>
                    <View style={s.cardTitleRow}>
                      <Text style={s.cardTitle}>Audio on scan report</Text>
                      <View style={[s.countBadge, { backgroundColor: "#ede9fe" }]}>
                        <Text style={[s.countBadgeText, { color: "#6d28d9" }]}>New</Text>
                      </View>
                    </View>
                    <Text style={s.cardSub}>
                      Open Treatment history → Audio notes to listen.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </Pressable>
              )}
            </>
          )}

          <Text style={s.sectionLabel}>Quick access</Text>

          <Pressable style={s.card} onPress={() => router.push("/(drawer)/chat")}>
            <View style={[s.iconCircle, { backgroundColor: "#ccfbf1" }]}>
              <Ionicons name="chatbubbles-outline" size={22} color="#2C3E6B" />
            </View>
            <View style={s.cardBody}>
              <Text style={s.cardTitle}>Chat with clinic</Text>
              <Text style={s.cardSub}>
                {supportCount + doctorCount === 0
                  ? "No unread messages from Support or your doctor."
                  : `${supportCount + doctorCount} unread from the care team.`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>

          <Pressable style={s.card} onPress={() => router.push("/(drawer)/schedules")}>
            <View style={[s.iconCircle, { backgroundColor: "#e8eef6" }]}>
              <Ionicons name="calendar" size={22} color="#2B3A67" />
            </View>
            <View style={s.cardBody}>
              <Text style={s.cardTitle}>Schedules & calendar</Text>
              <Text style={s.cardSub}>Your appointments and calendar.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        </>
      )}
    </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  bellWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#e8eef6",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "#E8EFE6",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  title: { fontSize: 22, fontWeight: "800", color: "#18181b" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2B3A67",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#18181b" },
  cardSub: { fontSize: 13, color: "#64748b", marginTop: 3, lineHeight: 18 },
  cardMeta: { fontSize: 12, color: "#2C3E6B", fontWeight: "600", marginTop: 4 },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: { fontSize: 11, fontWeight: "800", color: "#2C3E6B" },
});
