import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { NAVY, TEXT_MUTED } from "@/components/profile/theme";

export type ScheduleVisitRow = {
  id: string;
  visitDate: string;
  doctorName: string;
};

type Props = {
  visits: ScheduleVisitRow[];
  onViewAll: () => void;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  const month = MONTHS[parseInt(m, 10) - 1] ?? m;
  return `${parseInt(d, 10)} ${month} ${y}`;
}

export function ScheduleClinicVisitsCard({ visits, onViewAll }: Props) {
  const latest = visits[0] ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="medkit-outline" size={16} color={NAVY} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>CLINIC</Text>
          <Text style={styles.title}>Visits</Text>
        </View>
        {!latest ? <Text style={styles.aside}>No visits yet</Text> : null}
      </View>

      {latest ? (
        <View style={styles.visitRow}>
          <Ionicons name="checkbox-outline" size={24} color={NAVY} />
          <View style={styles.visitCopy}>
            <Text style={styles.visitKicker}>Last treatment</Text>
            <Text style={styles.visitDate}>{formatDate(latest.visitDate)}</Text>
            <Text style={styles.visitDoctor}>with Dr. {latest.doctorName}</Text>
          </View>
          <Pressable style={styles.viewBtn} onPress={onViewAll}>
            <Text style={styles.viewBtnText}>View</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyBody}>
          <Text style={styles.emptyText}>Your clinic visit history will show here.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    alignSelf: "stretch",
    minHeight: 132,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "space-between",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#e8eef6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: TEXT_MUTED,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#18181b",
    marginTop: 1,
  },
  aside: {
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_MUTED,
    flexShrink: 0,
    marginTop: 4,
  },
  visitRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#e0e5df",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 88,
  },
  visitCopy: { flex: 1, minWidth: 0 },
  visitKicker: { fontSize: 12, color: TEXT_MUTED },
  visitDate: { fontSize: 16, fontWeight: "700", color: "#1A1A2E", marginTop: 2 },
  visitDoctor: { fontSize: 13, color: TEXT_MUTED, marginTop: 3 },
  emptyBody: {
    marginTop: 14,
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: "#f4f6f4",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
    textAlign: "center",
  },
  viewBtn: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  viewBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
