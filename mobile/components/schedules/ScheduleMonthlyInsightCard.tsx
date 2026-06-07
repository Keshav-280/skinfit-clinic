import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import MonthlyReportCard from "@/components/profile/MonthlyReportCard";
import { NAVY, TEXT_MUTED } from "@/components/profile/theme";
import type { MonthlyInsightExportData } from "@/lib/monthlyInsightExport";

type MonthlyData = MonthlyInsightExportData;

type Props = {
  locked: boolean;
  nextInsightAt: string;
  monthly: MonthlyData | null;
  onExportPdf: (monthly: MonthlyData) => void;
};

function formatInsightDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the start of next month";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export function ScheduleMonthlyInsightCard({
  locked,
  nextInsightAt,
  monthly,
  onExportPdf,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>kAI</Text>
        <Text style={styles.title}>Monthly insight</Text>
        <Text style={styles.description}>
          A once-a-month recap of your skin progress from scans and daily logs.
        </Text>
      </View>

      {locked ? (
        <View style={styles.lockedBlock}>
          <View style={styles.lockRow}>
            <Ionicons name="lock-closed" size={14} color={TEXT_MUTED} />
            <Text style={styles.notReady}>NOT READY YET</Text>
          </View>
          <Text style={styles.unlockDate}>Unlocks around {formatInsightDate(nextInsightAt)}.</Text>
          <Pressable style={styles.pdfBtnDisabled} disabled>
            <Ionicons name="download-outline" size={16} color="#a1a1aa" />
            <Text style={styles.pdfBtnDisabledText}>Monthly PDF</Text>
          </Pressable>
        </View>
      ) : monthly ? (
        <MonthlyReportCard
          locked={false}
          nextInsightAt={nextInsightAt}
          monthly={monthly}
          onExportPdf={onExportPdf}
          embedded
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    padding: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  header: { marginBottom: 10 },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: NAVY,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#18181b",
    marginTop: 2,
  },
  description: {
    fontSize: 11,
    lineHeight: 15,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  lockedBlock: { gap: 8 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  notReady: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: TEXT_MUTED,
  },
  unlockDate: { fontSize: 12, color: TEXT_MUTED, lineHeight: 17 },
  pdfBtnDisabled: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f4f4f5",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
  },
  pdfBtnDisabledText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a1a1aa",
  },
});
