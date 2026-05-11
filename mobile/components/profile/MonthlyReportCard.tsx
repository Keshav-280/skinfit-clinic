import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { card, NAVY, GREEN, TEXT_MUTED, TEXT_LIGHT } from "@/components/profile/theme";

type MonthlyData = {
  summaryTitle: string;
  summaryBody: string;
  highlights: string[];
  risks: string[];
  nextMonthFocus: string[];
  kaiMonthAvgFromParams: number | null;
};

type Props = {
  locked: boolean;
  nextInsightAt: string;
  monthly: MonthlyData | null;
  onExportPdf: (monthly: MonthlyData) => void;
};

const RISK_RED = "#DC2626";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentMonthName(): string {
  return MONTHS[new Date().getMonth()];
}

function formatInsightDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <View style={s.bulletList}>
      {items.map((item, i) => (
        <Text key={i} style={s.bulletItem}>
          <Text style={{ color }}>•</Text>{"  "}{item}
        </Text>
      ))}
    </View>
  );
}

export default function MonthlyReportCard({
  locked,
  nextInsightAt,
  monthly,
  onExportPdf,
}: Props) {
  return (
    <View style={card.base}>
      <Text style={s.title}>This Month's Report</Text>
      <Text style={s.subtitle}>{currentMonthName()}</Text>

      {locked ? (
        <View style={s.lockedWrap}>
          <View style={s.lockCircle}>
            <Ionicons name="lock-closed" size={22} color={TEXT_LIGHT} />
          </View>
          <Text style={s.lockedText}>Next insight on</Text>
          <Text style={s.lockedDate}>{formatInsightDate(nextInsightAt)}</Text>
        </View>
      ) : monthly ? (
        <View style={s.body}>
          {monthly.kaiMonthAvgFromParams != null && (
            <View style={s.scorePill}>
              <Text style={s.scoreLabel}>kAI Month Score</Text>
              <Text style={s.scoreValue}>{monthly.kaiMonthAvgFromParams}</Text>
            </View>
          )}

          <Text style={s.summaryTitle}>{monthly.summaryTitle}</Text>
          <Text style={s.summaryBody}>{monthly.summaryBody}</Text>

          {monthly.highlights.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: GREEN }]}>Highlights</Text>
              <BulletList items={monthly.highlights} color={GREEN} />
            </View>
          )}

          {monthly.risks.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: RISK_RED }]}>Risks</Text>
              <BulletList items={monthly.risks} color={RISK_RED} />
            </View>
          )}

          {monthly.nextMonthFocus.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: NAVY }]}>Next Focus</Text>
              <BulletList items={monthly.nextMonthFocus} color={NAVY} />
            </View>
          )}

          <Pressable
            style={s.exportBtn}
            onPress={() => onExportPdf(monthly)}
          >
            <Ionicons name="download-outline" size={18} color={NAVY} />
            <Text style={s.exportText}>Export PDF</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 2,
    marginBottom: 16,
  },

  lockedWrap: {
    alignItems: "center",
    paddingVertical: 28,
  },
  lockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  lockedDate: {
    fontSize: 13,
    color: TEXT_LIGHT,
  },

  body: {
    gap: 12,
  },
  scorePill: {
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },

  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
  },
  summaryBody: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 21,
  },

  section: {
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  bulletList: {
    gap: 4,
  },
  bulletItem: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 20,
    paddingLeft: 4,
  },

  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  exportText: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
});
