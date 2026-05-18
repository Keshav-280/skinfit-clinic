import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { card, NAVY, TEXT_MUTED } from "@/components/profile/theme";

export type ProfileVisit = {
  id: string;
  visitDate: string;
  doctorName: string;
  purpose: string | null;
  treatments: string | null;
  notes: string;
  responseRating: string | null;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  const month = MONTHS[parseInt(m, 10) - 1] ?? m;
  return `${parseInt(d, 10)} ${month} ${y}`;
}

type Props = {
  visits: ProfileVisit[];
  onViewAll: () => void;
  onOpenVisit: (id: string) => void;
};

export default function RecentVisitsSection({ visits, onViewAll, onOpenVisit }: Props) {
  if (visits.length === 0) return null;

  const shown = visits.slice(0, 5);

  return (
    <View style={[card.base, s.wrap]}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Recent visits</Text>
          <Text style={s.subtitle}>Notes from your clinic appointments.</Text>
        </View>
        <Pressable style={s.viewAllBtn} onPress={onViewAll}>
          <Text style={s.viewAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </Pressable>
      </View>

      {shown.map((v) => (
        <Pressable
          key={v.id}
          style={s.visitCard}
          onPress={() => onOpenVisit(v.id)}
        >
          <Text style={s.visitHead}>
            {formatDate(v.visitDate)} · Dr. {v.doctorName}
          </Text>
          {v.purpose ? (
            <Text style={s.visitLine} numberOfLines={2}>
              Purpose: {v.purpose}
            </Text>
          ) : null}
          {v.treatments ? (
            <Text style={s.visitLine} numberOfLines={2}>
              Treatments: {v.treatments}
            </Text>
          ) : null}
          <Text style={s.visitNotes} numberOfLines={4}>
            {v.notes}
          </Text>
          {v.responseRating ? (
            <Text style={s.response}>
              Response:{" "}
              {v.responseRating.charAt(0).toUpperCase() + v.responseRating.slice(1)}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: NAVY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewAllText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  visitCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8e2d8",
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: 14,
    marginBottom: 10,
  },
  visitHead: {
    fontSize: 14,
    fontWeight: "700",
    color: "#18181b",
  },
  visitLine: {
    marginTop: 6,
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  visitNotes: {
    marginTop: 8,
    fontSize: 13,
    color: "#52525b",
    lineHeight: 20,
  },
  response: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#0f766e",
  },
});
