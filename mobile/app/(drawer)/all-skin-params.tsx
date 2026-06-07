import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { format, subDays } from "date-fns";

import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import { goToDashboard } from "@/lib/dashboardNavigation";
import { analysisResultsToParams } from "@/lib/skinAnalysis";

const NAVY = "#2C3E6B";
const GREEN = "#16a34a";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";

const PARAM_COLORS: Record<string, string> = {
  "Active Acne": "#BBF7D0",
  "Sagging & Volume": "#BAE6FD",
  "Hair Health": "#E9D5FF",
  Wrinkles: "#DDD6FE",
  "Skin Quality": "#A7F3D0",
  "Acne Scar": "#FECACA",
  "Under Eye": "#FDE68A",
  Pigmentation: "#C4B5FD",
};

type ScanItem = {
  id: string;
  skinScore: number;
  createdAt: string;
  analysisResults: unknown;
};

type HomeData = {
  skinScanHistory: ScanItem[];
};

function MiniSparkline({ points, color, width = 100, height = 40 }: { points: number[]; color: string; width?: number; height?: number }) {
  if (points.length < 2) {
    return <View style={{ width, height, backgroundColor: `${color}20`, borderRadius: 8 }} />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padY = 4;
  const usableH = height - padY * 2;
  const stepX = width / (points.length - 1);

  const d = points
    .map((p, i) => {
      const x = i * stepX;
      const y = padY + usableH - ((p - min) / range) * usableH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <View style={{ width, height, backgroundColor: `${color}15`, borderRadius: 8, overflow: "hidden" }}>
      <Svg width={width} height={height}>
        <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

type ParamTrend = {
  label: string;
  value: number;
  change: number;
  color: string;
  sparkline: number[];
  detail?: string;
};

export default function AllSkinParamsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scans, setScans] = useState<ScanItem[]>([]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const json = await apiJson<HomeData>("/api/patient/home", token, { method: "GET" });
      setScans(json.skinScanHistory ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void loadData(); }, [loadData]);

  const params = useMemo<ParamTrend[]>(() => {
    if (scans.length === 0) return [];

    const latest = scans[0];
    const currentParams = analysisResultsToParams(latest.analysisResults);

    const prev = scans.length > 1 ? scans[scans.length - 1] : null;
    const prevMap = new Map(
      prev ? analysisResultsToParams(prev.analysisResults).map((p) => [p.label, p.value]) : []
    );

    const scansByLabel = new Map<string, number[]>();
    for (const { label } of currentParams) {
      scansByLabel.set(label, []);
    }
    const reversedScans = [...scans].reverse();
    for (const s of reversedScans) {
      for (const row of analysisResultsToParams(s.analysisResults)) {
        scansByLabel.get(row.label)?.push(row.value);
      }
    }

    return currentParams.map((p) => ({
      label: p.label,
      value: p.value,
      change: prevMap.has(p.label) ? p.value - (prevMap.get(p.label) ?? p.value) : 0,
      color: PARAM_COLORS[p.label] ?? "#BBF7D0",
      sparkline: scansByLabel.get(p.label) ?? [p.value],
    }));
  }, [scans]);

  const dateRangeText = useMemo(() => {
    if (scans.length === 0) return "";
    const oldest = scans[scans.length - 1];
    const latest = scans[0];
    const from = new Date(oldest.createdAt);
    const to = new Date(latest.createdAt);
    return `${format(from, "do MMM")} – ${format(to, "do MMM")}`;
  }, [scans]);

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goToDashboard(router)} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={s.headerTitle}>All Skin Parameters</Text>
        <NotificationBell />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={NAVY}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await loadData();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
      >
        <Text style={s.trendSubtitle}>Trends over the last 4 weeks</Text>

        <View style={s.filterRow}>
          <View style={[s.filterChip, s.filterChipOn]}>
            <Text style={s.filterTextOn}>All({params.length})</Text>
          </View>
        </View>

        {params.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="analytics-outline" size={40} color="#9CA3AF" />
            <Text style={s.emptyText}>No scan data yet. Complete a skin scan to see your parameters.</Text>
          </View>
        ) : (
          params.map((p) => {
            const isUp = p.change >= 0;
            const trendColor = isUp ? GREEN : "#DC2626";
            const sparkColor = isUp ? GREEN : "#DC2626";

            return (
              <View key={p.label} style={s.paramCard}>
                <View style={s.paramLeft}>
                  <View style={[s.paramIcon, { backgroundColor: p.color }]} />
                  <View>
                    <Text style={s.paramLabel}>{p.label}</Text>
                    {p.detail ? (
                      <Text style={s.paramDetail} numberOfLines={2}>
                        {p.detail}
                      </Text>
                    ) : null}
                    <View style={s.paramScoreRow}>
                      <Text style={s.paramValue}>{p.value}</Text>
                      {p.change !== 0 && (
                        <View style={s.paramChange}>
                          <Ionicons
                            name={isUp ? "caret-up" : "caret-down"}
                            size={14}
                            color={trendColor}
                          />
                          <Text style={[s.paramChangeText, { color: trendColor }]}>
                            {Math.abs(p.change)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={s.paramRight}>
                  <MiniSparkline points={p.sparkline} color={sparkColor} />
                  {dateRangeText ? (
                    <View style={s.sparkDateRow}>
                      <Text style={s.sparkDate}>{format(new Date(scans[scans.length - 1].createdAt), "do")}</Text>
                      <Text style={s.sparkDate}>{format(new Date(scans[0].createdAt), "do")}</Text>
                    </View>
                  ) : null}
                  {dateRangeText ? (
                    <View style={s.sparkDateRow}>
                      <Text style={s.sparkDate}>{format(new Date(scans[scans.length - 1].createdAt), "MMM")}</Text>
                      <Text style={s.sparkDate}>{format(new Date(scans[0].createdAt), "MMM")}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        <View style={s.infoCard}>
          <Ionicons name="information-circle" size={20} color={NAVY} />
          <Text style={s.infoText}>
            Scores are calculated using AI analysis and updated weekly as per your skin tracker data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E8EFE6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#E8EFE6" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#18181b" },

  scrollContent: { padding: 16, paddingBottom: 48 },

  trendSubtitle: { fontSize: 15, color: "#6B7280", marginBottom: 14 },

  filterRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  filterChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB",
  },
  filterChipOn: { backgroundColor: NAVY, borderColor: NAVY },
  filterTextOn: { fontSize: 14, fontWeight: "700", color: "#fff" },

  paramCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  paramLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  paramIcon: {
    width: 44, height: 44, borderRadius: 14,
  },
  paramLabel: { fontSize: 16, fontWeight: "700", color: "#18181b" },
  paramDetail: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: "#6B7280",
    maxWidth: 200,
  },
  paramScoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  paramValue: { fontSize: 28, fontWeight: "800", color: "#18181b" },
  paramChange: { flexDirection: "row", alignItems: "center", gap: 2 },
  paramChangeText: { fontSize: 16, fontWeight: "800" },

  paramRight: { alignItems: "flex-end", gap: 2 },
  sparkDateRow: { flexDirection: "row", justifyContent: "space-between", width: 100 },
  sparkDate: { fontSize: 10, color: "#9CA3AF", fontWeight: "500" },

  emptyCard: {
    backgroundColor: GLASS, borderRadius: 20, padding: 32,
    alignItems: "center", gap: 12, borderWidth: 1, borderColor: GLASS_BORDER,
  },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },

  infoCard: {
    backgroundColor: "rgba(44,62,107,0.08)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 19 },
});
