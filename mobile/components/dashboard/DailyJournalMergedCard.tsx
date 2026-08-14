import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";

import { useDebouncedTrackerAutoSave } from "@/hooks/useDebouncedTrackerAutoSave";
import { formatWaterLiters } from "@/lib/hydrationUnits";
import {
  DASHBOARD_CARD_BG,
  DASHBOARD_CARD_BORDER,
  DASHBOARD_NAVY,
  dashboardCardShadow,
} from "@/lib/dashboardTheme";

function formatSleep(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

type Props = {
  selectedYmd: string;
  initialSleepHours: number;
  initialWaterGlasses: number;
  initialStressLevel: number;
  token: string | null;
  compact?: boolean;
  fillHeight?: boolean;
  style?: StyleProp<ViewStyle>;
  onValuesChange?: (values: {
    sleepHours: number;
    waterGlasses: number;
    stressLevel: number;
  }) => void;
};

export function DailyJournalMergedCard({
  selectedYmd,
  initialSleepHours,
  initialWaterGlasses,
  initialStressLevel,
  token,
  compact = false,
  fillHeight = false,
  style,
  onValuesChange,
}: Props) {
  const router = useRouter();
  const [sleepHours, setSleepHours] = useState(initialSleepHours);
  const [waterGlasses, setWaterGlasses] = useState(initialWaterGlasses);
  const [stressLevel, setStressLevel] = useState(initialStressLevel);
  const prevYmdRef = useRef(selectedYmd);
  const { saveStatus, scheduleSave, flushSave, markReady, markNotReady } =
    useDebouncedTrackerAutoSave(token);

  // Sync from parent (server load / optimistic sync) without cancelling in-flight saves.
  useEffect(() => {
    setSleepHours(initialSleepHours);
    setWaterGlasses(initialWaterGlasses);
    setStressLevel(initialStressLevel);
  }, [selectedYmd, initialSleepHours, initialWaterGlasses, initialStressLevel]);

  // Flush pending save when switching journal days.
  useEffect(() => {
    if (prevYmdRef.current === selectedYmd) return;
    prevYmdRef.current = selectedYmd;
    void flushSave();
  }, [selectedYmd, flushSave]);

  useEffect(() => {
    if (token) markReady();
    else markNotReady();
  }, [token, markReady, markNotReady]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void flushSave();
      };
    }, [flushSave])
  );

  function notifyChange(next: {
    sleepHours: number;
    waterGlasses: number;
    stressLevel: number;
  }) {
    onValuesChange?.(next);
  }

  function persist(next: {
    sleepHours?: number;
    waterGlasses?: number;
    stressLevel?: number;
  }) {
    const merged = {
      sleepHours: next.sleepHours ?? sleepHours,
      waterGlasses: next.waterGlasses ?? waterGlasses,
      stressLevel: next.stressLevel ?? stressLevel,
    };
    scheduleSave(selectedYmd, merged);
    notifyChange(merged);
  }

  function adjustSleep(delta: number) {
    const next = Math.min(24, Math.max(0, Math.round((sleepHours + delta) * 2) / 2));
    setSleepHours(next);
    persist({ sleepHours: next });
  }

  function adjustWater(delta: number) {
    const next = Math.min(40, Math.max(0, waterGlasses + delta));
    setWaterGlasses(next);
    persist({ waterGlasses: next });
  }

  function adjustStress(delta: number) {
    const next = Math.min(10, Math.max(0, stressLevel + delta));
    setStressLevel(next);
    persist({ stressLevel: next });
  }

  const stressHigh = stressLevel > 6;

  function navigateToTracker(path: string) {
    router.push(`${path}?date=${encodeURIComponent(selectedYmd)}` as Href);
  }

  const bodyStyle = fillHeight && compact ? styles.bodyFillHeight : undefined;
  const rowFillStyle = fillHeight && compact ? styles.rowFillHeight : undefined;

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        fillHeight && compact && styles.cardFillHeight,
        style,
      ]}
    >
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerLead}>
          <View style={[styles.headerIcon, compact && styles.headerIconCompact]}>
            <Ionicons name="journal" size={compact ? 13 : 16} color="#fff" />
          </View>
          <Text style={[styles.title, compact && styles.titleCompact]}>DAILY JOURNAL</Text>
        </View>
        <View>
          {saveStatus === "saving" ? (
            <Text style={styles.saveHint}>Saving…</Text>
          ) : saveStatus === "saved" ? (
            <Text style={[styles.saveHint, styles.saveHintOk]}>Saved ✓</Text>
          ) : saveStatus === "error" ? (
            <Text style={[styles.saveHint, styles.saveHintErr]}>Could not save</Text>
          ) : null}
        </View>
      </View>

      <View style={bodyStyle}>
      <View style={[styles.row, compact && styles.rowCompact, rowFillStyle]}>
        <Pressable
          style={({ pressed }) => [styles.rowLink, pressed && styles.rowLinkPressed]}
          onPress={() => navigateToTracker("/(drawer)/sleep-tracker")}
        >
          <View
            style={[
              styles.iconCircle,
              compact && styles.iconCircleCompact,
              { backgroundColor: "#16a34a" },
            ]}
          >
            <Ionicons name="bed" size={compact ? 16 : 20} color="#fff" />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowLabel, compact && styles.rowLabelCompact]}>
              Sleep Duration
            </Text>
            <Text style={[styles.rowValue, compact && styles.rowValueCompact]}>
              {formatSleep(sleepHours)}
            </Text>
          </View>
          {!compact ? <Ionicons name="chevron-forward" size={16} color="#94a3b8" /> : null}
        </Pressable>
        <View style={styles.stepper}>
          <Pressable
            style={({ pressed }) => [styles.stepBtn, compact && styles.stepBtnCompact, pressed && styles.stepBtnPressed]}
            onPress={() => adjustSleep(-0.5)}
            accessibilityLabel="Decrease sleep"
          >
            <Ionicons name="remove" size={compact ? 14 : 18} color={DASHBOARD_NAVY} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.stepBtn, compact && styles.stepBtnCompact, pressed && styles.stepBtnPressed]}
            onPress={() => adjustSleep(0.5)}
            accessibilityLabel="Increase sleep"
          >
            <Ionicons name="add" size={compact ? 14 : 18} color={DASHBOARD_NAVY} />
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={[styles.row, compact && styles.rowCompact, rowFillStyle]}>
        <Pressable
          style={({ pressed }) => [styles.rowLink, pressed && styles.rowLinkPressed]}
          onPress={() => navigateToTracker("/(drawer)/hydration-tracker")}
        >
          <View
            style={[
              styles.iconCircle,
              compact && styles.iconCircleCompact,
              { backgroundColor: "#3B82F6" },
            ]}
          >
            <Ionicons name="water" size={compact ? 16 : 20} color="#fff" />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowLabel, compact && styles.rowLabelCompact]}>Hydration</Text>
            <Text style={[styles.rowValue, compact && styles.rowValueCompact]}>
              {formatWaterLiters(waterGlasses)} L
            </Text>
          </View>
          {!compact ? <Ionicons name="chevron-forward" size={16} color="#94a3b8" /> : null}
        </Pressable>
        <View style={styles.stepper}>
          <Pressable
            style={({ pressed }) => [styles.stepBtn, compact && styles.stepBtnCompact, pressed && styles.stepBtnPressed]}
            onPress={() => adjustWater(-1)}
            accessibilityLabel="Decrease hydration"
          >
            <Ionicons name="remove" size={compact ? 14 : 18} color={DASHBOARD_NAVY} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.stepBtn, compact && styles.stepBtnCompact, pressed && styles.stepBtnPressed]}
            onPress={() => adjustWater(1)}
            accessibilityLabel="Increase hydration"
          >
            <Ionicons name="add" size={compact ? 14 : 18} color={DASHBOARD_NAVY} />
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={[styles.row, compact && styles.rowCompact, rowFillStyle]}>
        <Pressable
          style={({ pressed }) => [styles.rowLink, pressed && styles.rowLinkPressed]}
          onPress={() => navigateToTracker("/(drawer)/stress-tracker")}
        >
          <View
            style={[
              styles.iconCircle,
              compact && styles.iconCircleCompact,
              { backgroundColor: stressHigh ? "#DC2626" : "#F59E0B" },
            ]}
          >
            <Ionicons
              name={stressHigh ? "sad" : "happy"}
              size={compact ? 16 : 20}
              color="#fff"
            />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowLabel, compact && styles.rowLabelCompact]}>
              Stress Level
            </Text>
            <Text style={[styles.rowValue, compact && styles.rowValueCompact]}>{stressLevel}</Text>
          </View>
          {!compact ? <Ionicons name="chevron-forward" size={16} color="#94a3b8" /> : null}
        </Pressable>
        <View style={styles.stepper}>
          <Pressable
            style={({ pressed }) => [styles.stepBtn, compact && styles.stepBtnCompact, pressed && styles.stepBtnPressed]}
            onPress={() => adjustStress(-1)}
            accessibilityLabel="Decrease stress level"
          >
            <Ionicons name="remove" size={compact ? 14 : 18} color={DASHBOARD_NAVY} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.stepBtn, compact && styles.stepBtnCompact, pressed && styles.stepBtnPressed]}
            onPress={() => adjustStress(1)}
            accessibilityLabel="Increase stress level"
          >
            <Ionicons name="add" size={compact ? 14 : 18} color={DASHBOARD_NAVY} />
          </Pressable>
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DASHBOARD_CARD_BG,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: DASHBOARD_CARD_BORDER,
    ...dashboardCardShadow,
  },
  cardCompact: {
    borderRadius: 16,
    padding: 10,
  },
  cardFillHeight: {
    justifyContent: "space-between",
  },
  bodyFillHeight: {
    flex: 1,
    justifyContent: "space-between",
  },
  rowFillHeight: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerCompact: { marginBottom: 8 },
  headerLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: DASHBOARD_NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: DASHBOARD_NAVY,
  },
  titleCompact: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  saveHint: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  saveHintOk: { color: "#16a34a" },
  saveHintErr: { color: "#d97706" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  rowCompact: {
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  rowLink: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    paddingVertical: 4,
    paddingRight: 4,
    minWidth: 0,
  },
  rowLinkPressed: {
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: "500", color: "#6B7280" },
  rowLabelCompact: { fontSize: 9, lineHeight: 11 },
  rowValue: { fontSize: 22, fontWeight: "800", color: "#18181b", marginTop: 2 },
  rowValueCompact: { fontSize: 14, marginTop: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DASHBOARD_CARD_BORDER,
    backgroundColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  stepBtnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.88 }],
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginHorizontal: 8,
  },
});
