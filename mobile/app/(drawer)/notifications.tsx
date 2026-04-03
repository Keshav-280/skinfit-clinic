import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import {
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
} from "@/lib/inboxReadCursors";
import { registerForPushAndSyncToken, unregisterPushToken } from "@/lib/pushNotifications";

export default function NotificationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [supportCount, setSupportCount] = useState(0);
  const [doctorCount, setDoctorCount] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [supportSince, doctorSince] = await Promise.all([
        getClinicSupportInboxLastSeenIso(),
        getDoctorInboxLastSeenIso(),
      ]);
      const inboxQ = new URLSearchParams({ supportSince, doctorSince });
      const [inbox, schedules] = await Promise.all([
        apiJson<{
          total?: number;
          supportCount?: number;
          doctorCount?: number;
        }>(`/api/chat/inbox/unread?${inboxQ.toString()}`, token, { method: "GET" }),
        apiJson<{
          initialActiveReminders?: { id: string }[];
        }>("/api/patient/schedules", token, { method: "GET" }),
      ]);
      setUnreadTotal(typeof inbox.total === "number" ? inbox.total : 0);
      setSupportCount(typeof inbox.supportCount === "number" ? inbox.supportCount : 0);
      setDoctorCount(typeof inbox.doctorCount === "number" ? inbox.doctorCount : 0);
      setReminderCount(schedules.initialActiveReminders?.length ?? 0);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        /* signed out */
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onEnablePush() {
    if (!token) return;
    setPushBusy(true);
    try {
      const t = await registerForPushAndSyncToken(token);
      if (t) {
        Alert.alert("Notifications on", "You’ll get alerts when the clinic sends you a chat message.");
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function onDisablePush() {
    if (!token) return;
    setPushBusy(true);
    try {
      await unregisterPushToken(token);
      Alert.alert("Updated", "Outside-app alerts are turned off for this device.");
    } catch {
      Alert.alert("Error", "Could not update. Try again.");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.sub}>Clinic messages, reminders, and optional push alerts.</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#0d9488" />
      ) : (
        <>
          <Pressable
            style={styles.card}
            onPress={() => router.push("/(drawer)/chat")}
          >
            <View style={[styles.iconCircle, { backgroundColor: "rgba(13, 148, 136, 0.12)" }]}>
              <Ionicons name="chatbubbles-outline" size={22} color="#0d9488" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Chat with clinic</Text>
              <Text style={styles.cardSub}>
                {unreadTotal === 0
                  ? "No unread messages from Support or your doctor."
                  : `${unreadTotal} unread from the care team.`}
              </Text>
              {(supportCount > 0 || doctorCount > 0) && (
                <Text style={styles.cardMeta}>
                  {supportCount > 0 ? `Support: ${supportCount}` : ""}
                  {supportCount > 0 && doctorCount > 0 ? " · " : ""}
                  {doctorCount > 0 ? `Doctor: ${doctorCount}` : ""}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>

          <Pressable
            style={styles.card}
            onPress={() => router.push("/(drawer)/schedules")}
          >
            <View style={[styles.iconCircle, { backgroundColor: "rgba(37, 99, 235, 0.1)" }]}>
              <Ionicons name="calendar-outline" size={22} color="#2563eb" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Schedules & reminders</Text>
              <Text style={styles.cardSub}>
                {reminderCount === 0
                  ? "No active priority reminders."
                  : `${reminderCount} active reminder${reminderCount === 1 ? "" : "s"}.`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>

          {Platform.OS !== "web" ? (
            <View style={styles.pushSection}>
              <Text style={styles.pushTitle}>Outside the app</Text>
              <Text style={styles.pushSub}>
                Allow push notifications to get an alert when the clinic sends a chat message, even if
                SkinnFit isn’t open.
              </Text>
              <View style={styles.pushRow}>
                <Pressable
                  style={[styles.pushBtn, styles.pushBtnPrimary]}
                  onPress={() => void onEnablePush()}
                  disabled={pushBusy}
                >
                  {pushBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.pushBtnPrimaryText}>Enable push alerts</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.pushBtn, styles.pushBtnGhost]}
                  onPress={() => void onDisablePush()}
                  disabled={pushBusy}
                >
                  <Text style={styles.pushBtnGhostText}>Turn off</Text>
                </Pressable>
              </View>
              <Text style={styles.pushHint}>
                Release builds need an EAS project ID in app config for Expo to issue a device token.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: "#18181b" },
  sub: { fontSize: 14, color: "#64748b", marginTop: 6, lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#18181b" },
  cardSub: { fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 18 },
  cardMeta: { fontSize: 12, color: "#0d9488", fontWeight: "600", marginTop: 6 },
  pushSection: {
    marginTop: 28,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
  },
  pushTitle: { fontSize: 16, fontWeight: "700", color: "#18181b" },
  pushSub: { fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 19 },
  pushRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  pushBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  pushBtnPrimary: { backgroundColor: "#0d9488" },
  pushBtnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  pushBtnGhost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  pushBtnGhostText: { color: "#475569", fontWeight: "600", fontSize: 15 },
  pushHint: { fontSize: 11, color: "#94a3b8", marginTop: 12, lineHeight: 16 },
});
