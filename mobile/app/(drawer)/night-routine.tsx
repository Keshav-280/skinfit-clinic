import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format, parseISO } from "date-fns";
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
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import { goToDashboard } from "@/lib/dashboardNavigation";
import { normalizeRoutineSteps } from "@/lib/routine";

const NAVY = "#2C3E6B";
const GREEN = "#16a34a";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";

const MOTIVATIONS = [
  "Great skin is built while you rest.",
  "Night is repair time. Don't skip.",
  "Rest, repair, renew.",
  "Let your skin heal overnight.",
  "Your night routine does the magic.",
];

type HomeData = {
  amItems: string[];
  pmItems: string[];
  todayLog: { routinePmSteps?: boolean[] | null } | null;
  routinePlanReady?: boolean;
  onboardingComplete?: boolean;
};

function ProgressRing({ done, total, size = 56 }: { done: number; total: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? done / total : 0;
  const offset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="rgba(255,255,255,0.3)" strokeWidth={strokeWidth} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={progress >= 1 ? "#fff" : "#F97316"}
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90" origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.ringText}>{done}/{total}</Text>
    </View>
  );
}

export default function NightRoutineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selectedYmd =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : format(new Date(), "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    if (!token) return;
    const json = await apiJson<HomeData>(
      `/api/patient/home?date=${encodeURIComponent(selectedYmd)}`,
      token,
      { method: "GET" }
    );
    setData(json);
    const pm = normalizeRoutineSteps(json.todayLog?.routinePmSteps, json.pmItems.length, undefined);
    setSteps(pm);
  }, [token, selectedYmd]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadData();
      } catch {
        /* 401 signs out globally */
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  const done = useMemo(() => steps.filter(Boolean).length, [steps]);
  const total = data?.pmItems.length ?? 0;
  const motivation = useMemo(() => MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)], []);

  async function saveSteps(next: boolean[]) {
    if (!token) return;
    setSaving(true);
    try {
      const { format } = await import("date-fns");
      await apiJson("/api/journal", token, {
        method: "PATCH",
        body: JSON.stringify({ date: selectedYmd, routinePmSteps: next }),
      });
    } catch {
      void loadData();
    } finally {
      setSaving(false);
    }
  }

  function toggleStep(i: number) {
    const next = steps.map((v, j) => (j === i ? !v : v));
    setSteps(next);
    void saveSteps(next);
  }

  function markAll() {
    if (!data) return;
    const next = data.pmItems.map(() => true);
    setSteps(next);
    void saveSteps(next);
  }

  if (loading) {
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={NAVY} /></View>;
  }

  if (!data || !data.routinePlanReady || data.pmItems.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Pressable onPress={() => goToDashboard(router)} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={styles.empty}>Your night routine hasn't been set up yet. Your clinic will configure it soon.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
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
      <View style={styles.header}>
        <Pressable onPress={() => goToDashboard(router)} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={styles.headerTitle}>Night Routine</Text>
        <View style={{ width: 36 }} />
      </View>
      <Text style={styles.selectedDateLabel}>
        For {format(parseISO(`${selectedYmd}T12:00:00`), "EEE, d MMM yyyy")}
      </Text>

      <View style={styles.reminderCard}>
        <View style={styles.reminderLeft}>
          <View style={styles.reminderIcon}>
            <Ionicons name="moon" size={22} color="#C4B5FD" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderKicker}>Daily Reminder</Text>
            <Text style={styles.reminderTitle}>{motivation}</Text>
            <Text style={styles.reminderSub}>Your night routine does the magic.</Text>
          </View>
        </View>
        <ProgressRing done={done} total={total} />
      </View>

      <Pressable onPress={markAll} style={styles.markAllBtn} disabled={saving}>
        <Ionicons name="checkmark-done" size={18} color={GREEN} />
        <Text style={styles.markAllText}>Mark all as completed</Text>
      </Pressable>

      {data.pmItems.map((item, i) => {
        const checked = steps[i] ?? false;
        const parts = item.split("|").map((s: string) => s.trim());
        const stepName = parts[0] || item;
        const productName = parts[1] || "";
        const dosage = parts[2] || "";
        return (
          <Pressable key={`pm-${i}`} style={styles.stepCard} onPress={() => toggleStep(i)} disabled={saving}>
            <View style={[styles.stepNum, { backgroundColor: checked ? GREEN : NAVY }]}>
              {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={styles.stepNumText}>{i + 1}</Text>}
            </View>
            <View style={styles.stepInfo}>
              <Text style={[styles.stepName, checked && styles.stepNameDone]}>{stepName}</Text>
              {productName ? <Text style={styles.stepProduct}>{productName}</Text> : null}
              {dosage ? <Text style={styles.stepDosage}>{dosage}</Text> : null}
            </View>
          </Pressable>
        );
      })}

      <View style={styles.whyCard}>
        <View style={styles.whyIcon}>
          <Ionicons name="shield-checkmark" size={20} color="#6366F1" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.whyTitle}>Why it matters</Text>
          <Text style={styles.whySub}>
            Night is the time your skin repairs and restores. Don't skip your routine!
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#E8EFE6" },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#E8EFE6", padding: 24 },
  empty: { fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 22 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#18181b" },
  selectedDateLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "600",
  },

  reminderCard: {
    backgroundColor: NAVY,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  reminderLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  reminderIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  reminderKicker: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600", letterSpacing: 0.5 },
  reminderTitle: { fontSize: 15, fontWeight: "800", color: "#fff", marginTop: 3 },
  reminderSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  ringText: {
    position: "absolute", fontSize: 13, fontWeight: "800", color: "#fff",
  },

  markAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginBottom: 16, paddingVertical: 10,
    backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: GLASS_BORDER,
  },
  markAllText: { fontSize: 14, fontWeight: "700", color: GREEN },

  stepCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  stepNum: {
    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
  },
  stepNumText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  stepInfo: { flex: 1 },
  stepName: { fontSize: 16, fontWeight: "700", color: "#1A1A2E" },
  stepNameDone: { textDecorationLine: "line-through", color: "#9CA3AF" },
  stepProduct: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  stepDosage: { fontSize: 12, color: "#9CA3AF", marginTop: 1 },

  whyCard: {
    backgroundColor: GLASS,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  whyIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(99,102,241,0.12)", alignItems: "center", justifyContent: "center",
  },
  whyTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A2E" },
  whySub: { fontSize: 13, color: "#374151", marginTop: 3, lineHeight: 19 },
});
