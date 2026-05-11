import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { format } from "date-fns";

import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import { getApiBase } from "@/lib/apiBase";

const NAVY = "#2B3A67";
const BG: [string, string] = ["#E8EFE6", "#DCE8D4"];
const TEXT_PRIMARY = "#1A1A2E";
const TEXT_MUTED = "#52525b";

type RequestRow = {
  id: string;
  preferredDateYmd: string;
  issue: string;
  timePreferences: string;
  status: string;
  crmPatientMessage: string | null;
  patientNotes: string | null;
  cancelledReason: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e", label: "Pending" },
  confirmed: { bg: "#e8eef6", text: NAVY, label: "Confirmed" },
  completed: { bg: "#dcfce7", text: "#166534", label: "Completed" },
  declined: { bg: "#fee2e2", text: "#991b1b", label: "Declined" },
  cancelled: { bg: "#f4f4f5", text: "#52525b", label: "Cancelled" },
};

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEE, dd MMM yyyy");
}

function AppointmentCard({
  item,
  token,
  onUpdated,
}: {
  item: RequestRow;
  token: string;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState(item.patientNotes ?? "");
  const [slotText, setSlotText] = useState("");
  const [saving, setSaving] = useState(false);

  const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.pending;
  const isActive = item.status === "pending" || item.status === "confirmed";

  async function saveNote() {
    if (!noteText.trim() && !slotText.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (noteText.trim()) body.patientNotes = noteText.trim();
      if (slotText.trim()) {
        const combined = item.timePreferences + ", " + slotText.trim();
        body.timePreferences = combined;
      }
      const res = await fetch(
        `${getApiBase()}/api/patient/schedule-requests/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      Alert.alert("Saved", "Your message has been sent to the clinic.");
      setSlotText("");
      onUpdated();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.card}>
      <Pressable style={s.cardHeader} onPress={() => setExpanded(!expanded)}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardDate}>{fmtDate(item.preferredDateYmd)}</Text>
          <Text style={s.cardIssue} numberOfLines={expanded ? undefined : 1}>
            {item.issue}
          </Text>
          <Text style={s.cardSlots} numberOfLines={expanded ? undefined : 1}>
            Slots: {item.timePreferences}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={[s.statusPill, { backgroundColor: statusStyle.bg }]}>
            <Text style={[s.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={TEXT_MUTED}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={s.cardBody}>
          {item.crmPatientMessage ? (
            <View style={s.clinicNoteBox}>
              <Ionicons name="medkit-outline" size={16} color={NAVY} />
              <View style={{ flex: 1 }}>
                <Text style={s.clinicNoteLabel}>Clinic note</Text>
                <Text style={s.clinicNoteText}>{item.crmPatientMessage}</Text>
              </View>
            </View>
          ) : null}

          {item.patientNotes ? (
            <View style={s.yourNoteBox}>
              <Text style={s.yourNoteLabel}>Your message</Text>
              <Text style={s.yourNoteText}>{item.patientNotes}</Text>
            </View>
          ) : null}

          {item.cancelledReason ? (
            <View style={s.cancelBox}>
              <Text style={s.cancelLabel}>Cancellation reason</Text>
              <Text style={s.cancelText}>{item.cancelledReason}</Text>
            </View>
          ) : null}

          {isActive && (
            <>
              <Text style={s.inputLabel}>Send a message to the clinic</Text>
              <TextInput
                style={s.input}
                placeholder="E.g. Can I reschedule to next week?"
                placeholderTextColor="#9ca3af"
                value={noteText}
                onChangeText={setNoteText}
                multiline
              />

              <Text style={s.inputLabel}>Add more time slots (optional)</Text>
              <TextInput
                style={s.input}
                placeholder="E.g. 3:00 PM, 4:30 PM"
                placeholderTextColor="#9ca3af"
                value={slotText}
                onChangeText={setSlotText}
              />

              <Pressable
                style={[s.sendBtn, saving && { opacity: 0.6 }]}
                onPress={saveNote}
                disabled={saving}
              >
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={s.sendBtnText}>{saving ? "Sending..." : "Send"}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export default function UpcomingAppointmentsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    const data = await apiJson<{ requests: RequestRow[] }>(
      "/api/patient/schedule-requests",
      token,
      { method: "GET" }
    );
    const upcoming = data.requests.filter(
      (r) => r.status === "pending" || r.status === "confirmed"
    );
    const past = data.requests.filter(
      (r) => r.status !== "pending" && r.status !== "confirmed"
    );
    setRequests([...upcoming, ...past]);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadData();
        } catch {}
        finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadData(); } catch {}
    finally { setRefreshing(false); }
  }, [loadData]);

  const upcomingCount = requests.filter(
    (r) => r.status === "pending" || r.status === "confirmed"
  ).length;

  return (
    <LinearGradient colors={BG} style={{ flex: 1 }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.push("/(drawer)/schedules" as any)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={NAVY} />
        </Pressable>
        <Text style={s.headerTitle}>Appointments</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />
          }
        >
          {upcomingCount > 0 && (
            <Text style={s.sectionLabel}>
              Upcoming ({upcomingCount})
            </Text>
          )}

          {requests.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="calendar-outline" size={36} color={NAVY} style={{ marginBottom: 10 }} />
              <Text style={s.emptyTitle}>No appointments yet</Text>
              <Text style={s.emptyBody}>
                Request an appointment from the Schedules screen and it will show up here.
              </Text>
            </View>
          ) : (
            requests.map((item) => (
              <AppointmentCard
                key={item.id}
                item={item}
                token={token!}
                onUpdated={onRefresh}
              />
            ))
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: NAVY },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  cardDate: { fontSize: 15, fontWeight: "700", color: NAVY },
  cardIssue: { fontSize: 14, color: TEXT_PRIMARY, marginTop: 2 },
  cardSlots: { fontSize: 13, color: TEXT_MUTED, marginTop: 4 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  cardBody: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  clinicNoteBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f0f4ff",
    borderRadius: 12,
    padding: 12,
  },
  clinicNoteLabel: { fontSize: 11, fontWeight: "700", color: NAVY, marginBottom: 2 },
  clinicNoteText: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 18 },
  yourNoteBox: {
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    padding: 12,
  },
  yourNoteLabel: { fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 2 },
  yourNoteText: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 18 },
  cancelBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 12,
  },
  cancelLabel: { fontSize: 11, fontWeight: "700", color: "#991b1b", marginBottom: 2 },
  cancelText: { fontSize: 13, color: "#991b1b", lineHeight: 18 },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d4d4d8",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: TEXT_PRIMARY,
    minHeight: 44,
    backgroundColor: "#fafafa",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  sendBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: NAVY, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: TEXT_MUTED, textAlign: "center", lineHeight: 20 },
});
