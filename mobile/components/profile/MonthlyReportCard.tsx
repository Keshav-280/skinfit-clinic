import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { card, NAVY, GREEN, TEXT_MUTED, TEXT_LIGHT } from "@/components/profile/theme";
import type { MonthlyInsightExportData } from "@/lib/monthlyInsightExport";

type MonthlyData = MonthlyInsightExportData;

type Props = {
  locked: boolean;
  nextInsightAt: string;
  monthly: MonthlyData | null;
  onExportPdf: (monthly: MonthlyData) => void;
  /** Render body only (no outer profile card / title) — used on Manage schedule screen. */
  embedded?: boolean;
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
  if (isNaN(d.getTime())) return "the start of next month";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <View style={s.bulletList}>
      {items.map((item, i) => (
        <Text key={i} style={s.bulletItem}>
          <Text style={{ color }}>•</Text>{"  "}
          {item}
        </Text>
      ))}
    </View>
  );
}

function NumberedList({ items, color }: { items: string[]; color: string }) {
  return (
    <View style={s.bulletList}>
      {items.map((item, i) => (
        <Text key={i} style={s.bulletItem}>
          <Text style={{ color, fontWeight: "700" }}>{i + 1}.</Text>{"  "}
          {item}
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
  embedded = false,
}: Props) {
  const detail = monthly?.detail;
  const highlights = (monthly?.highlights ?? []).slice(0, 8);
  const risks = (monthly?.risks ?? []).slice(0, 8);
  const focus = (monthly?.nextMonthFocus ?? []).slice(0, 8);
  const parameterNotes = (
    monthly?.parameterNotes ??
    detail?.parameterNotes ??
    []
  ).slice(0, 8);
  const habitNotes = (monthly?.habitNotes ?? detail?.habitNotes ?? []).slice(0, 6);
  const scanStory = monthly?.scanStory ?? detail?.scanStory ?? null;
  const closingNote = monthly?.closingNote ?? detail?.closingNote ?? null;
  const ad = detail?.adherence30d;
  const params = detail?.parameters ?? [];
  const scans = detail?.scans ?? [];
  const hooks = detail?.recentScanHooks ?? [];

  const body = (
    <>
      {locked ? (
        <View style={s.lockedWrap}>
          <View style={s.lockCircle}>
            <Ionicons name="lock-closed" size={22} color={TEXT_LIGHT} />
          </View>
          <Text style={s.lockedText}>Unlocks around</Text>
          <Text style={s.lockedDate}>{formatInsightDate(nextInsightAt)}</Text>
        </View>
      ) : monthly ? (
        <View style={s.body}>
          {monthly.kaiMonthAvgFromParams != null && (
            <View style={s.scorePill}>
              <Text style={s.scoreLabel}>Month kAI</Text>
              <Text style={s.scoreValue}>{monthly.kaiMonthAvgFromParams}</Text>
            </View>
          )}

          <Text style={s.summaryTitle}>{monthly.summaryTitle}</Text>
          <Text style={s.summaryBody}>{monthly.summaryBody}</Text>

          {highlights.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: GREEN }]}>Highlights</Text>
              <BulletList items={highlights} color={GREEN} />
            </View>
          )}

          {risks.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: RISK_RED }]}>Watch-outs</Text>
              <BulletList items={risks} color={RISK_RED} />
            </View>
          )}

          {(params.length > 0 || parameterNotes.length > 0) && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: NAVY }]}>Parameter deep dive</Text>
              {params.map((p) => {
                const move =
                  p.vsMonthStart == null
                    ? "—"
                    : p.vsMonthStart >= 3
                      ? `${signed(p.vsMonthStart)} improved`
                      : p.vsMonthStart <= -3
                        ? `${signed(p.vsMonthStart)} softer`
                        : `${signed(p.vsMonthStart)} steady`;
                return (
                  <View key={p.key} style={s.paramRow}>
                    <Text style={s.paramLabel}>{p.label}</Text>
                    <Text style={s.paramMeta}>
                      Latest {p.latest ?? "—"} · avg {p.monthMean ?? "—"} · {move}
                    </Text>
                  </View>
                );
              })}
              {parameterNotes.length > 0 ? (
                <BulletList items={parameterNotes} color={NAVY} />
              ) : null}
            </View>
          )}

          {(ad || habitNotes.length > 0) && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: NAVY }]}>Habits this month</Text>
              {ad ? (
                <View style={s.habitGrid}>
                  {[
                    [`Routine`, `${ad.fullRoutineDays}/${ad.windowDays}`],
                    [`Consistency`, `${ad.routineWeightedConsistencyPct}%`],
                    [`Sleep`, `${ad.avgSleepHours}h`],
                    [`Water`, `${ad.avgWaterGlasses}`],
                    [`Stress`, `${ad.avgStress}/10`],
                    [`Journal`, `${ad.journalCompliancePct}%`],
                  ].map(([label, value]) => (
                    <View key={label} style={s.habitCard}>
                      <Text style={s.habitLabel}>{label}</Text>
                      <Text style={s.habitValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {habitNotes.length > 0 ? (
                <BulletList items={habitNotes} color={NAVY} />
              ) : null}
            </View>
          )}

          {(scanStory || scans.length > 0) && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: NAVY }]}>Scan story</Text>
              {scanStory ? <Text style={s.summaryBody}>{scanStory}</Text> : null}
              {scans.length > 0 ? (
                <View style={s.scanRow}>
                  {scans.map((sc) => (
                    <View key={`${sc.index}-${sc.date}`} style={s.scanChip}>
                      <Text style={s.scanDate}>{sc.date}</Text>
                      <Text style={s.scanScore}>kAI {sc.kaiScore}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {hooks.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: NAVY }]}>Weekly check-ins</Text>
              <NumberedList items={hooks.slice(0, 4)} color={NAVY} />
            </View>
          )}

          {(focus.length > 0 || closingNote) && (
            <View style={s.section}>
              <Text style={[s.sectionHeader, { color: NAVY }]}>Next focus</Text>
              <NumberedList items={focus} color={NAVY} />
              {closingNote ? <Text style={s.closing}>{closingNote}</Text> : null}
            </View>
          )}

          <Pressable style={s.exportBtn} onPress={() => onExportPdf(monthly)}>
            <Ionicons name="download-outline" size={18} color={NAVY} />
            <Text style={s.exportText}>Export PDF</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  if (embedded) {
    return <View style={s.embeddedBody}>{body}</View>;
  }

  return (
    <View style={card.base}>
      <Text style={s.title}>Monthly insight</Text>
      <Text style={s.subtitle}>
        {locked ? "1 month after your first scan" : currentMonthName()}
      </Text>
      {body}
    </View>
  );
}

const s = StyleSheet.create({
  embeddedBody: {
    gap: 12,
  },
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
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
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
  closing: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    lineHeight: 20,
  },

  section: {
    marginTop: 4,
    gap: 6,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bulletList: {
    gap: 6,
  },
  bulletItem: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 20,
    paddingLeft: 4,
  },
  paramRow: {
    paddingVertical: 4,
  },
  paramLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  paramMeta: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_MUTED,
  },
  habitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  habitCard: {
    width: "47%",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  habitLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: TEXT_MUTED,
  },
  habitValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  scanRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scanChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    gap: 8,
  },
  scanDate: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  scanScore: {
    fontSize: 11,
    fontWeight: "700",
    color: NAVY,
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
