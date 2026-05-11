import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NAVY, TEXT_MUTED } from "@/components/profile/theme";

type Visit = {
  id: string;
  visitDate: string;
  doctorName: string;
  purpose: string | null;
  treatments: string | null;
};

type Props = {
  visits: Visit[];
  onViewAll: () => void;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const month = MONTHS[parseInt(m, 10) - 1] ?? m;
  return `${parseInt(d, 10)} ${month} ${y}`;
}

export default function LastTreatmentCard({ visits, onViewAll }: Props) {
  if (!visits.length) return null;

  const v = visits[0];

  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={s.iconWrap}>
          <Ionicons name="checkbox-outline" size={24} color={NAVY} />
        </View>

        <View style={s.content}>
          <Text style={s.kicker}>Last treatment</Text>
          <Text style={s.date}>{formatDate(v.visitDate)}</Text>
          <Text style={s.doctor}>with Dr. {v.doctorName}</Text>
        </View>

        <Pressable style={s.viewBtn} onPress={onViewAll}>
          <Text style={s.viewText}>View</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#e0e5df",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  kicker: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginBottom: 1,
  },
  date: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 1,
  },
  doctor: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
  },
  viewBtn: {
    backgroundColor: NAVY,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
