import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format, addDays, subDays, subMonths, isSameDay, parseISO } from "date-fns";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationBell } from "@/components/NotificationBell";
import { TrackerSaveStatusText } from "@/components/TrackerSaveStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useDebouncedTrackerAutoSave } from "@/hooks/useDebouncedTrackerAutoSave";
import { apiJson } from "@/lib/api";
import { goToDashboard } from "@/lib/dashboardNavigation";
import {
  mlToWaterGlasses,
  snapHydrationLiters,
  snapHydrationMl,
  waterGlassesToMl,
} from "@/lib/hydrationUnits";

const NAVY = "#2C3E6B";
const BLUE = "#4F46E5";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";

const GOAL_LITERS = 3.0;

function HydrationGauge({
  liters,
  goal = GOAL_LITERS,
  size = 220,
  onChangeLiters,
  onDragStart,
  onDragEnd,
}: {
  liters: number;
  goal?: number;
  size?: number;
  onChangeLiters?: (nextLiters: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size / 2 - 20;
  const startAngle = 210;
  const endAngle = 330;
  const totalAngle = endAngle - startAngle;

  const ticks = [0, 0.5, 1, 1.5, 2, 2.5, 3];

  function polarToXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const clamped = Math.max(0, Math.min(goal, liters));
  const ratio = clamped / goal;
  const valueAngle = startAngle + totalAngle * ratio;

  const bgStart = polarToXY(startAngle, r);
  const bgEnd = polarToXY(endAngle, r);
  const arcPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;

  const fillEnd = polarToXY(valueAngle, r);
  const largeArc = valueAngle - startAngle > 180 ? 1 : 0;
  const fillPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`;

  const dot = polarToXY(valueAngle, r);

  const pct = Math.round((liters / goal) * 100);
  const onChangeRef = useRef(onChangeLiters);
  onChangeRef.current = onChangeLiters;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  const updateFromTouch = useCallback(
    (x: number, y: number) => {
      if (!onChangeRef.current) return;
      const dx = x - cx;
      const dy = y - cy;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      const clampedAngle = Math.max(startAngle, Math.min(endAngle, angle));
      const ratioFromTouch = (clampedAngle - startAngle) / totalAngle;
      onChangeRef.current(snapHydrationLiters(ratioFromTouch * goal));
    },
    [cx, cy, goal, startAngle, endAngle, totalAngle]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          onDragStartRef.current?.();
          updateFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
        onPanResponderMove: (e) => {
          updateFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
        onPanResponderRelease: () => onDragEndRef.current?.(),
        onPanResponderTerminate: () => onDragEndRef.current?.(),
      }),
    [updateFromTouch]
  );

  return (
    <View
      style={{ alignItems: "center", justifyContent: "center", height: size }}
      {...(onChangeLiters ? panResponder.panHandlers : {})}
    >
      <Svg width={size} height={size}>
        <Path d={arcPath} stroke="#E5E7EB" strokeWidth={10} fill="none" strokeLinecap="round" />
        <Path d={fillPath} stroke={BLUE} strokeWidth={10} fill="none" strokeLinecap="round" />
        <Circle cx={dot.x} cy={dot.y} r={8} fill="#fff" stroke={BLUE} strokeWidth={3} />
        {ticks.map((t) => {
          const tickRatio = t / goal;
          const tickAngle = startAngle + totalAngle * tickRatio;
          const outer = polarToXY(tickAngle, r + 18);
          return (
            <SvgText
              key={t}
              x={outer.x}
              y={outer.y}
              fontSize={12}
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
        <Text style={{ fontSize: 38, fontWeight: "800", color: "#18181b" }}>{liters.toFixed(2)}</Text>
        <Text style={{ fontSize: 15, color: BLUE, fontWeight: "700", marginTop: -2 }}>Liters</Text>
        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>of {goal.toFixed(2)} L goal</Text>
        <View style={[s.pctBadge]}>
          <Ionicons name="water" size={13} color={BLUE} />
          <Text style={s.pctBadgeText}>{pct}% of your goal</Text>
        </View>
      </View>
    </View>
  );
}

const ADD_OPTIONS = [
  { label: "+0.25 L", ml: 250 },
  { label: "+0.5 L", ml: 500 },
  { label: "+1.0 L", ml: 1000 },
];

type JournalData = {
  todayLog: { waterGlasses?: number } | null;
};

type HydrationInsight = {
  insight: string;
  tip: string;
};

export default function HydrationTrackerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { saveStatus, scheduleSave, flushSave, markReady, markNotReady } =
    useDebouncedTrackerAutoSave(token);

  const [loading, setLoading] = useState(true);
  const [totalMl, setTotalMl] = useState(0);
  const [insightData, setInsightData] = useState<HydrationInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const parsedParamDate = useMemo(() => {
    if (typeof params.date !== "string") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return null;
    return parseISO(`${params.date}T12:00:00`);
  }, [params.date]);
  const [selectedDate, setSelectedDate] = useState(parsedParamDate ?? new Date());
  const [scrollEnabled, setScrollEnabled] = useState(true);
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
      const json = await apiJson<{ entry: { waterGlasses?: number } | null }>(`/api/journal?date=${ymd}`, token, { method: "GET" });
      setTotalMl(waterGlassesToMl(json.entry?.waterGlasses ?? 0));
    } catch { setTotalMl(0); }
    finally { setLoading(false); }
  }, [token, selectedDate, markNotReady]);

  const loadInsight = useCallback(async () => {
    if (!token) return;
    setInsightLoading(true);
    try {
      const ymd = format(selectedDate, "yyyy-MM-dd");
      const json = await apiJson<HydrationInsight>(
        `/api/patient/hydration-insight?date=${encodeURIComponent(ymd)}`,
        token,
        { method: "GET" }
      );
      setInsightData(json);
    } catch { /* silent */ }
    finally { setInsightLoading(false); }
  }, [token, selectedDate]);

  useEffect(() => { void loadData(); void loadInsight(); }, [loadData, loadInsight]);

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

  function scheduleHydrationSave(nextMl: number) {
    const snappedMl = snapHydrationMl(nextMl);
    scheduleSave(format(selectedDate, "yyyy-MM-dd"), {
      waterGlasses: mlToWaterGlasses(snappedMl),
    });
    return snappedMl;
  }

  function setHydrationMl(nextMl: number) {
    setTotalMl(scheduleHydrationSave(nextMl));
  }

  function addWater(ml: number) {
    let snappedMl = 0;
    setTotalMl((prev) => {
      snappedMl = snapHydrationMl(prev + ml);
      return snappedMl;
    });
    scheduleHydrationSave(snappedMl);
  }

  function goBack() { if (canGoBack) setSelectedDate((d) => subDays(d, 1)); }
  function goForward() { if (canGoForward) setSelectedDate((d) => addDays(d, 1)); }

  if (loading) {
    return <View style={[s.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={NAVY} /></View>;
  }

  const liters = totalMl / 1000;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goToDashboard(router)} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={s.headerTitle}>Hydration</Text>
        <View style={s.headerRight}>
          <TrackerSaveStatusText status={saveStatus} />
          <NotificationBell />
        </View>
      </View>

      <Text style={s.subtitle}>Log your water intake to keep your skin happy</Text>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={NAVY}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await Promise.all([loadData(), loadInsight()]);
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
          <Text style={s.question}>How much water did you drink today?</Text>
          <HydrationGauge
            liters={liters}
            onChangeLiters={(nextLiters) => {
              setHydrationMl(Math.round(nextLiters * 1000));
            }}
            onDragStart={() => setScrollEnabled(false)}
            onDragEnd={() => setScrollEnabled(true)}
          />

          <View style={s.addRow}>
            {ADD_OPTIONS.map((opt) => (
              <Pressable key={opt.label} style={s.addBtn} onPress={() => addWater(opt.ml)}>
                <Ionicons name="water" size={20} color={BLUE} />
                <Text style={s.addBtnText}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <View style={s.insightHeader}>
            <Text style={s.insightTitle}>Hydration Insights</Text>
          </View>
          {insightLoading ? (
            <ActivityIndicator size="small" color={NAVY} style={{ marginVertical: 12 }} />
          ) : insightData ? (
            <>
              <View style={s.insightRow}>
                <Ionicons name="water" size={18} color={BLUE} />
                <Text style={s.insightText}>{insightData.insight}</Text>
              </View>
              <View style={[s.insightRow, { marginTop: 10 }]}>
                <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
                <Text style={s.insightText}>{insightData.tip}</Text>
              </View>
            </>
          ) : (
            <Text style={s.insightText}>Track your hydration daily to unlock personalized insights.</Text>
          )}
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

  pctBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: `${BLUE}12`, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginTop: 6,
  },
  pctBadgeText: { fontSize: 12, fontWeight: "700", color: BLUE },

  addRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 },
  addBtn: {
    flex: 1, alignItems: "center", gap: 6,
    paddingVertical: 14, borderRadius: 16,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB",
  },
  addBtnText: { fontSize: 14, fontWeight: "700", color: "#18181b" },

  insightHeader: { marginBottom: 10 },
  insightTitle: { fontSize: 17, fontWeight: "800", color: "#18181b" },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  insightText: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 20 },
});
