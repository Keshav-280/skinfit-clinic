import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { format, addDays, subDays, addMonths, subMonths, isSameDay } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationBell } from "@/components/NotificationBell";
import { TrackerSaveStatusText } from "@/components/TrackerSaveStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useDebouncedTrackerAutoSave } from "@/hooks/useDebouncedTrackerAutoSave";
import { apiJson } from "@/lib/api";

const NAVY = "#2C3E6B";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";

const STRESS_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const CAUSES = [
  { key: "work", label: "Work", icon: "briefcase-outline" as const },
  { key: "study", label: "Study", icon: "book-outline" as const },
  { key: "personal", label: "Personal", icon: "people-outline" as const },
  { key: "health", label: "Health", icon: "heart-outline" as const },
];

const SYMPTOMS = [
  { key: "headache", label: "Headache", icon: "medkit-outline" as const },
  { key: "fatigue", label: "Fatigue", icon: "battery-dead-outline" as const },
  { key: "poor_sleep", label: "Poor Sleep", icon: "bed-outline" as const },
  { key: "none", label: "None", icon: "checkmark-circle-outline" as const },
];

function stressLabel(v: number) {
  if (v <= 2) return { text: "Low Stress", color: "#16a34a" };
  if (v <= 4) return { text: "Mild Stress", color: "#84cc16" };
  if (v <= 6) return { text: "Moderate Stress", color: "#F59E0B" };
  if (v <= 8) return { text: "High Stress", color: "#F97316" };
  return { text: "Extreme Stress", color: "#DC2626" };
}

function stressEmoji(v: number): string {
  if (v <= 3) return "happy-outline";
  if (v <= 6) return "happy-outline";
  return "sad-outline";
}

function StressSlider({
  value,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  value: number;
  onChange: (v: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const trackWidth = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  function computeValue(x: number) {
    const w = trackWidth.current;
    if (w <= 0) return value;
    const clamped = Math.max(0, Math.min(w, x));
    return Math.round((clamped / w) * 10);
  }

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
          onChangeRef.current(computeValue(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => {
          onChangeRef.current(computeValue(e.nativeEvent.locationX));
        },
        onPanResponderRelease: () => {
          onDragEndRef.current?.();
        },
        onPanResponderTerminate: () => {
          onDragEndRef.current?.();
        },
      }),
    []
  );

  const ratio = value / 10;

  return (
    <View
      style={st.sliderTrack}
      onLayout={(e: LayoutChangeEvent) => { trackWidth.current = e.nativeEvent.layout.width; }}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={["#16a34a", "#84cc16", "#facc15", "#F97316", "#DC2626"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={st.sliderGradient}
      />
      <View style={[st.sliderThumb, { left: `${ratio * 100}%` }]} pointerEvents="none">
        <View style={st.sliderDot} />
      </View>
    </View>
  );
}

type JournalData = {
  todayLog: { stressLevel?: number } | null;
};

export default function StressTrackerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { saveStatus, scheduleSave, markReady, markNotReady } =
    useDebouncedTrackerAutoSave(token);

  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(5);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [cause, setCause] = useState<string | null>(null);
  const [symptom, setSymptom] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const minDate = useMemo(() => subMonths(new Date(), 1), []);
  const maxDate = useMemo(() => addMonths(new Date(), 1), []);
  const isToday = isSameDay(selectedDate, new Date());
  const canGoBack = selectedDate > minDate;
  const canGoForward = selectedDate < maxDate;

  const loadData = useCallback(async () => {
    if (!token) return;
    markNotReady();
    setLoading(true);
    try {
      const ymd = format(selectedDate, "yyyy-MM-dd");
      const json = await apiJson<{ entry: { stressLevel?: number } | null }>(`/api/journal?date=${ymd}`, token, { method: "GET" });
      setLevel(json.entry?.stressLevel ?? 5);
    } catch { setLevel(5); }
    finally { setLoading(false); }
  }, [token, selectedDate, markNotReady]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (loading) markNotReady();
    else markReady();
  }, [loading, markReady, markNotReady]);

  function handleSetLevel(nextLevel: number) {
    setLevel(nextLevel);
    scheduleSave(format(selectedDate, "yyyy-MM-dd"), { stressLevel: nextLevel });
  }

  function goBack() { if (canGoBack) setSelectedDate((d) => subDays(d, 1)); }
  function goForward() { if (canGoForward) setSelectedDate((d) => addDays(d, 1)); }

  if (loading) {
    return <View style={[st.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={NAVY} /></View>;
  }

  const info = stressLabel(level);
  const ratio = level / 10;

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={st.headerTitle}>Stress Level</Text>
        <View style={st.headerRight}>
          <TrackerSaveStatusText status={saveStatus} />
          <NotificationBell />
        </View>
      </View>

      <Text style={st.subtitle}>Log your stress to help us personalize your care</Text>

      <ScrollView contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
        <View style={st.dateRow}>
          <Pressable style={[st.dateArrow, !canGoBack && { opacity: 0.3 }]} hitSlop={10} onPress={goBack} disabled={!canGoBack}>
            <Ionicons name="chevron-back" size={18} color={NAVY} />
          </Pressable>
          <Pressable style={st.datePill} onPress={() => setSelectedDate(new Date())}>
            <Text style={st.dateText}>{isToday ? "Today, " : ""}{format(selectedDate, "d MMM yyyy")}</Text>
            {!isToday && <Text style={{ fontSize: 11, color: "#6B7280" }}>tap for today</Text>}
          </Pressable>
          <Pressable style={[st.dateArrow, !canGoForward && { opacity: 0.3 }]} hitSlop={10} onPress={goForward} disabled={!canGoForward}>
            <Ionicons name="chevron-forward" size={18} color={NAVY} />
          </Pressable>
        </View>

        <View style={st.card}>
          <Text style={st.question}>How stressed did you feel today?</Text>
          <Text style={st.questionSub}>Rate your stress level</Text>

          <View style={st.scaleLabels}>
            {[0, 2, 4, 6, 8, 10].map((n) => (
              <Text key={n} style={[st.scaleTick, level === n && st.scaleTickOn]}>{n}</Text>
            ))}
          </View>

          <StressSlider
            value={level}
            onChange={handleSetLevel}
            onDragStart={() => setScrollEnabled(false)}
            onDragEnd={() => setScrollEnabled(true)}
          />

          <View style={st.sliderEndLabels}>
            <Text style={st.sliderEndText}>No Stress</Text>
            <Text style={st.sliderEndText}>Extreme Stress</Text>
          </View>

          <View style={st.levelChips}>
            {STRESS_LEVELS.map((n) => (
              <Pressable key={n} style={[st.levelChip, level === n && st.levelChipOn]} onPress={() => handleSetLevel(n)}>
                <Text style={[st.levelChipText, level === n && st.levelChipTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[st.statusBadge, { backgroundColor: `${info.color}15` }]}>
            <Ionicons name={stressEmoji(level) as any} size={16} color={info.color} />
            <Text style={[st.statusBadgeText, { color: info.color }]}>{info.text}</Text>
          </View>
        </View>

        <View style={st.card}>
          <Text style={st.question}>What was the main cause? (Optional)</Text>
          <View style={st.optionGrid}>
            {CAUSES.map((c) => (
              <Pressable key={c.key} style={[st.optionItem, cause === c.key && st.optionItemOn]} onPress={() => setCause(cause === c.key ? null : c.key)}>
                <View style={[st.optionIconWrap, cause === c.key && { backgroundColor: `${NAVY}15` }]}>
                  <Ionicons name={c.icon} size={24} color={cause === c.key ? NAVY : "#6B7280"} />
                </View>
                <Text style={[st.optionLabel, cause === c.key && { color: NAVY, fontWeight: "700" }]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={st.card}>
          <Text style={st.question}>Physical Symptoms? (Optional)</Text>
          <View style={st.optionGrid}>
            {SYMPTOMS.map((sy) => (
              <Pressable key={sy.key} style={[st.optionItem, symptom === sy.key && st.optionItemOn]} onPress={() => setSymptom(symptom === sy.key ? null : sy.key)}>
                <View style={[st.optionIconWrap, symptom === sy.key && { backgroundColor: `${NAVY}15` }]}>
                  <Ionicons name={sy.icon} size={24} color={symptom === sy.key ? NAVY : "#6B7280"} />
                </View>
                <Text style={[st.optionLabel, symptom === sy.key && { color: NAVY, fontWeight: "700" }]}>{sy.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
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
    marginBottom: 16, borderWidth: 1, borderColor: GLASS_BORDER, alignItems: "center",
  },
  question: { fontSize: 17, fontWeight: "800", color: "#18181b", textAlign: "center" },
  questionSub: { fontSize: 13, color: "#9CA3AF", textAlign: "center", marginTop: 2, marginBottom: 12 },

  scaleLabels: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 4 },
  scaleTick: { fontSize: 13, color: "#9CA3AF", fontWeight: "600", width: 24, textAlign: "center" },
  scaleTickOn: { color: "#F59E0B", fontWeight: "800", fontSize: 15 },

  sliderTrack: {
    width: "100%", height: 36, borderRadius: 5, marginTop: 6, marginBottom: 4,
    justifyContent: "center",
  },
  sliderGradient: { width: "100%", height: 10, borderRadius: 5 },
  sliderThumb: {
    position: "absolute", width: 28, height: 28, borderRadius: 14,
    marginLeft: -14, alignItems: "center", justifyContent: "center",
  },
  sliderDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 3, borderColor: "#F59E0B",
  },
  sliderEndLabels: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 12 },
  sliderEndText: { fontSize: 11, color: "#9CA3AF" },

  levelChips: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginBottom: 14,
  },
  levelChip: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB",
    alignItems: "center", justifyContent: "center",
  },
  levelChipOn: { backgroundColor: NAVY, borderColor: NAVY },
  levelChipText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  levelChipTextOn: { color: "#fff" },

  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
  },
  statusBadgeText: { fontSize: 14, fontWeight: "700" },

  optionGrid: { flexDirection: "row", justifyContent: "space-around", width: "100%", marginTop: 14, gap: 8 },
  optionItem: { alignItems: "center", gap: 6, padding: 10, borderRadius: 14, flex: 1 },
  optionItemOn: { backgroundColor: "rgba(255,255,255,0.7)" },
  optionIconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  optionLabel: { fontSize: 12, color: "#6B7280", fontWeight: "500", textAlign: "center" },
});
