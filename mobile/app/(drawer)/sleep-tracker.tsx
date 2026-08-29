import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format, addDays, subDays, subMonths, isSameDay, parseISO } from "date-fns";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, G, Text as SvgText, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationBell } from "@/components/NotificationBell";
import { TrackerSaveStatusText } from "@/components/TrackerSaveStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useDebouncedTrackerAutoSave } from "@/hooks/useDebouncedTrackerAutoSave";
import { apiJson } from "@/lib/api";
import { goToDashboard } from "@/lib/dashboardNavigation";

const NAVY = "#1E1B31";
const GREEN = "#16a34a";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";

const QUALITY_OPTIONS = [
  { key: "very_poor", label: "Very Poor", icon: "sad-outline" as const },
  { key: "average", label: "Average", icon: "happy-outline" as const },
  { key: "excellent", label: "Excellent", icon: "star-outline" as const },
];

const HOURS_OPTIONS = [4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];

function SleepGauge({ value, size = 220 }: { value: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size / 2 - 20;
  const startAngle = 210;
  const endAngle = 330;
  const totalAngle = endAngle - startAngle;

  const ticks = [2, 4, 6, 8, 10];

  function polarToXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const clamped = Math.max(2, Math.min(10, value));
  const ratio = (clamped - 2) / (10 - 2);
  const valueAngle = startAngle + totalAngle * ratio;

  const bgStart = polarToXY(startAngle, r);
  const bgEnd = polarToXY(endAngle, r);
  const arcPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;

  const fillEnd = polarToXY(valueAngle, r);
  const largeArc = valueAngle - startAngle > 180 ? 1 : 0;
  const fillPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`;

  const dot = polarToXY(valueAngle, r);

  const label = value >= 7 ? "Good" : value >= 5 ? "Fair" : "Poor";
  const labelColor = value >= 7 ? GREEN : value >= 5 ? "#F59E0B" : "#DC2626";

  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: size }}>
      <Svg width={size} height={size}>
        <Path d={arcPath} stroke="#E5E7EB" strokeWidth={10} fill="none" strokeLinecap="round" />
        <Path d={fillPath} stroke={NAVY} strokeWidth={10} fill="none" strokeLinecap="round" />
        <Circle cx={dot.x} cy={dot.y} r={8} fill="#fff" stroke={NAVY} strokeWidth={3} />
        {ticks.map((t) => {
          const tickRatio = (t - 2) / (10 - 2);
          const tickAngle = startAngle + totalAngle * tickRatio;
          const outer = polarToXY(tickAngle, r + 18);
          return (
            <SvgText
              key={t}
              x={outer.x}
              y={outer.y}
              fontSize={13}
              fontWeight="600"
              fill="#6B7280"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {t}
            </SvgText>
          );
        })}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 40, fontWeight: "800", color: "#18181b" }}>{value}</Text>
        <Text style={{ fontSize: 15, color: "#6B7280", fontWeight: "600", marginTop: -2 }}>hours</Text>
        <View style={[s.qualityBadge, { backgroundColor: `${labelColor}15` }]}>
          <Ionicons name="moon" size={14} color={labelColor} />
          <Text style={[s.qualityBadgeText, { color: labelColor }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

type JournalData = {
  todayLog: {
    sleepHours?: number;
    stressLevel?: number;
    waterGlasses?: number;
    mood?: string | null;
    dietType?: string | null;
    sunExposure?: string | null;
    cycleDay?: number | null;
    journalEntry?: string | null;
    comments?: string | null;
  } | null;
};

export default function SleepTrackerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { saveStatus, scheduleSave, flushSave, markReady, markNotReady } =
    useDebouncedTrackerAutoSave(token);

  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(7.5);
  const [quality, setQuality] = useState<string | null>(null);
  const parsedParamDate = useMemo(() => {
    if (typeof params.date !== "string") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return null;
    return parseISO(`${params.date}T12:00:00`);
  }, [params.date]);
  const [selectedDate, setSelectedDate] = useState(parsedParamDate ?? new Date());
  const [refreshing, setRefreshing] = useState(false);

  const minDate = useMemo(() => subMonths(new Date(), 1), []);
  const maxDate = useMemo(() => new Date(), []);
  const isToday = isSameDay(selectedDate, new Date());
  const canGoBack = selectedDate > minDate;
  const canGoForward = selectedDate < maxDate;

  const loadData = useCallback(async () => {
    if (!token) return;
    markNotReady();
    setLoading(true);
    try {
      const ymd = format(selectedDate, "yyyy-MM-dd");
      const json = await apiJson<{
        entry: { sleepHours?: number; sleepQuality?: string | null } | null;
      }>(`/api/journal?date=${ymd}`, token, { method: "GET" });
      setHours(json.entry?.sleepHours ?? 7.5);
      setQuality(json.entry?.sleepQuality ?? null);
    } catch { setHours(7.5); }
    finally { setLoading(false); }
  }, [token, selectedDate, markNotReady]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!parsedParamDate) return;
    setSelectedDate(parsedParamDate);
  }, [parsedParamDate]);

  useEffect(() => {
    if (loading) markNotReady();
    else markReady();
  }, [loading, markReady, markNotReady]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void flushSave();
      };
    }, [flushSave])
  );

  function handleSetHours(h: number) {
    setHours(h);
    scheduleSave(format(selectedDate, "yyyy-MM-dd"), {
      sleepHours: h,
      ...(quality ? { sleepQuality: quality } : {}),
    });
  }

  function handleSetQuality(key: string) {
    setQuality(key);
    scheduleSave(format(selectedDate, "yyyy-MM-dd"), {
      sleepHours: hours,
      sleepQuality: key,
    });
  }

  function goBack() { if (canGoBack) setSelectedDate((d) => subDays(d, 1)); }
  function goForward() { if (canGoForward) setSelectedDate((d) => addDays(d, 1)); }

  if (loading) {
    return <View style={[s.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={NAVY} /></View>;
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goToDashboard(router)} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={s.headerTitle}>Sleep</Text>
        <View style={s.headerRight}>
          <TrackerSaveStatusText status={saveStatus} />
          <NotificationBell />
        </View>
      </View>

      <Text style={s.subtitle}>Log your sleep to help us personalize your care</Text>

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
        <View style={s.dateRow}>
          <Pressable style={[s.dateArrow, !canGoBack && { opacity: 0.3 }]} hitSlop={10} onPress={goBack} disabled={!canGoBack}>
            <Ionicons name="chevron-back" size={18} color={NAVY} />
          </Pressable>
          <Pressable style={s.datePill} onPress={() => setSelectedDate(new Date())}>
            <Text style={s.dateText}>{isToday ? "Today, " : ""}{format(selectedDate, "d MMM yyyy")}</Text>
            {!isToday && <Text style={{ fontSize: 11, color: "#6B7280" }}>tap for today</Text>}
          </Pressable>
          <Pressable style={[s.dateArrow, !canGoForward && { opacity: 0.3 }]} hitSlop={10} onPress={goForward} disabled={!canGoForward}>
            <Ionicons name="chevron-forward" size={18} color={NAVY} />
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.question}>How many hours did you sleep?</Text>
          <SleepGauge value={hours} />

          <View style={s.hourChips}>
            {HOURS_OPTIONS.map((h) => (
              <Pressable
                key={h}
                style={[s.hourChip, hours === h && s.hourChipOn]}
                onPress={() => handleSetHours(h)}
              >
                <Text style={[s.hourChipText, hours === h && s.hourChipTextOn]}>{h}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.question}>How rested do you feel?</Text>
          <Text style={s.questionSub}>Rate your sleep quality</Text>
          <View style={s.qualityRow}>
            {QUALITY_OPTIONS.map((q) => (
              <Pressable
                key={q.key}
                style={[s.qualityItem, quality === q.key && s.qualityItemOn]}
                onPress={() => handleSetQuality(q.key)}
              >
                <Ionicons name={q.icon} size={32} color={quality === q.key ? NAVY : "#9CA3AF"} />
                <Text style={[s.qualityLabel, quality === q.key && { color: NAVY, fontWeight: "700" }]}>
                  {q.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0EAE2" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F0EAE2" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#18181b" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  subtitle: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 4, marginBottom: 8 },

  scrollContent: { padding: 16, paddingBottom: 48 },

  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 },
  dateArrow: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  datePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  dateText: { fontSize: 14, fontWeight: "600", color: "#18181b" },

  card: {
    backgroundColor: GLASS, borderRadius: 22, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: GLASS_BORDER,
  },
  question: { fontSize: 17, fontWeight: "800", color: "#18181b", textAlign: "center" },
  questionSub: { fontSize: 13, color: "#9CA3AF", textAlign: "center", marginTop: 2 },

  hourChips: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12,
  },
  hourChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB",
  },
  hourChipOn: { backgroundColor: NAVY, borderColor: NAVY },
  hourChipText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  hourChipTextOn: { color: "#fff" },

  qualityBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6,
  },
  qualityBadgeText: { fontSize: 13, fontWeight: "700" },

  qualityRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 16 },
  qualityItem: { alignItems: "center", gap: 6, padding: 12, borderRadius: 14 },
  qualityItemOn: { backgroundColor: `${NAVY}10` },
  qualityLabel: { fontSize: 13, color: "#9CA3AF", fontWeight: "500" },
});
