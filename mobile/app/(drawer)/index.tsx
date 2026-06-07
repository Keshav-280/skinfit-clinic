import { Audio } from "expo-av";
import { format, addDays, subDays, startOfWeek, parseISO, isSameDay } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import Svg, { Circle, Polygon, Line, G, Text as SvgText } from "react-native-svg";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { DailyJournalMergedCard } from "@/components/dashboard/DailyJournalMergedCard";
import { DashboardStreakCard } from "@/components/dashboard/DashboardStreakCard";
import { FirstScanCta } from "@/components/dashboard/FirstScanCta";
import { NavyMetricsCard } from "@/components/dashboard/NavyMetricsCard";
import { NotificationBell } from "@/components/NotificationBell";
import { WeeklyInsightSection } from "@/components/dashboard/WeeklyInsightSection";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { configurePlaybackAudioMode, primeAudioSessionForPlayback } from "@/lib/audioSession";
import { resolvePlayableAudioUri } from "@/lib/resolvePlayableAudioUri";
import { getCached, setCached } from "@/lib/apiCache";
import {
  extractSkinHealthMetrics,
  extractSkinParamMetrics,
  kaiParamClarity,
  SKIN_HEALTH_PARAM_KEYS,
} from "@/lib/skinAnalysis";
import { useDebouncedTrackerAutoSave } from "@/hooks/useDebouncedTrackerAutoSave";
import {
  clearJournalSyncPatch,
  peekJournalSyncPatch,
  subscribeJournalUpdated,
} from "@/lib/journalSync";
import { normalizeRoutineSteps } from "@/lib/routine";
import {
  DASHBOARD_BG,
  DASHBOARD_CARD_BG,
  DASHBOARD_CARD_BORDER,
  DASHBOARD_GREEN,
  DASHBOARD_NAVY,
  DASHBOARD_URGENT,
  dashboardCardShadow,
} from "@/lib/dashboardTheme";

function kaiParamsFromAnalysis(analysis: unknown): { label: string; value: number }[] {
  return SKIN_HEALTH_PARAM_KEYS.map(({ key, label }) => ({
    label,
    value: kaiParamClarity(analysis, key, 0),
  }));
}

function formatScanChipLabel(
  scan: SkinScanItem,
  scans: SkinScanItem[]
): string {
  const d = new Date(scan.createdAt);
  const datePart = format(d, "MMM d");
  const sameDay = scans.filter((s) =>
    isSameDay(new Date(s.createdAt), d)
  ).length;
  const timePart = sameDay > 1 ? ` · ${format(d, "h:mm a")}` : "";
  return `${datePart}${timePart} · ${Math.round(scan.skinScore)}`;
}

function formatScanDetailLabel(scan: SkinScanItem): string {
  return `${format(new Date(scan.createdAt), "MMM d, yyyy 'at' h:mm a")} · Overall ${Math.round(scan.skinScore)}/100`;
}

const NAVY = DASHBOARD_NAVY;
const GLASS = DASHBOARD_CARD_BG;
const GLASS_BORDER = DASHBOARD_CARD_BORDER;
const GREEN_ACCENT = DASHBOARD_GREEN;

type SkinScanItem = {
  id: string;
  skinScore: number;
  createdAt: string;
  analysisResults: unknown;
};

type TodayLog = {
  journalEntry?: string | null;
  sleepHours?: number;
  stressLevel?: number;
  waterGlasses?: number;
  mood?: string | null;
  amRoutine?: boolean;
  pmRoutine?: boolean;
  routineAmSteps?: boolean[] | null;
  routinePmSteps?: boolean[] | null;
  dietType?: string | null;
  sunExposure?: string | null;
  cycleDay?: number | null;
  comments?: string | null;
} | null;

type HomeData = {
  skinScanHistory: SkinScanItem[];
  todayLog: TodayLog;
  amItems: string[];
  pmItems: string[];
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  weeklyDeltaMeaningful?: boolean;
  lifestyleAlignmentScore: number;
  routineScore: number;
  weeklyChangePercent: number;
  doctorFeedback: string;
  homeDateYmd?: string;
  streakCurrent: number;
  streakLongest: number;
  weekCompletedDates?: string[];
  cycleTrackingEnabled: boolean;
  doctorVoiceNotes?: Array<{
    id: string;
    audioDataUri: string;
    createdAt: string;
    listened: boolean;
  }>;
  doctorArchivedVoiceNotes?: Array<{
    id: string;
    audioDataUri: string;
    createdAt: string;
    listened: boolean;
  }>;
  /** @deprecated use doctorVoiceNotes */
  doctorVoiceNote: {
    id: string;
    audioDataUri: string;
    createdAt: string;
  } | null;
  doctorVoiceNoteIsNew: boolean;
  onboardingComplete?: boolean;
  hasQuestionnaire?: boolean;
  userName?: string;
  /** False after onboarding until clinician saves AM/PM step list. */
  routinePlanReady?: boolean;
  routineAmReminderHm?: string;
  routinePmReminderHm?: string;
  kaiInsightsEnabled?: boolean;
  feedbackEntries?: Array<{
    id: string;
    feedbackText: string | null;
    audioDataUri: string | null;
    createdAt: string;
    listened: boolean;
    doctorName: string | null;
    doctorPhotoUrl: string | null;
    doctorId: string | null;
  }>;
  archivedFeedbackEntries?: Array<{
    id: string;
    feedbackText: string | null;
    audioDataUri: string | null;
    createdAt: string;
    listened: boolean;
    doctorName: string | null;
    doctorPhotoUrl: string | null;
    doctorId: string | null;
  }>;
};

const MOODS = ["Neutral", "Great", "Okay", "Low", "Stressed"] as const;
const DIETS = ["heavy", "balanced", "light"] as const;
const SUNS = ["low", "moderate", "high"] as const;

type SkinParamWithContext = {
  label: string;
  value: number;
  deltaFromPrev: number | null;
  prevWeekAvg: number | null;
};

export default function DashboardScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedScanIdx, setSelectedScanIdx] = useState(0);
  const [routine, setRoutine] = useState({ am: [] as boolean[], pm: [] as boolean[] });
  const [weekOffset, setWeekOffset] = useState(0);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [journalDate, setJournalDate] = useState(todayStr);
  const [sleep, setSleep] = useState("0");
  const [stress, setStress] = useState("5");
  const [water, setWater] = useState("0");
  const [journalText, setJournalText] = useState("");
  const [mood, setMood] = useState("Neutral");
  const [amRoutine, setAmRoutine] = useState(false);
  const [pmRoutine, setPmRoutine] = useState(false);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalSaving, setJournalSaving] = useState(false);
  const [journalHint, setJournalHint] = useState<string | null>(null);
  const [showingCachedHome, setShowingCachedHome] = useState(false);
  const [dietType, setDietType] = useState<string>("balanced");
  const [sunExposure, setSunExposure] = useState<string>("low");
  const [cycleDay, setCycleDay] = useState("");
  const [voiceBusyId, setVoiceBusyId] = useState<string | null>(null);
  const [skinInsightReloadNonce, setSkinInsightReloadNonce] = useState(0);
  const [sosBusy, setSosBusy] = useState(false);
  const { markReady: markJournalReady, markNotReady: markJournalNotReady } =
    useDebouncedTrackerAutoSave(token);

  const hasLoadedOnce = useRef(false);
  const journalLoadGenRef = useRef(0);

  const applyJournalSyncPatch = useCallback(
    (patch: { sleepHours?: number; stressLevel?: number; waterGlasses?: number }) => {
      if (patch.sleepHours != null) setSleep(String(patch.sleepHours));
      if (patch.stressLevel != null) setStress(String(patch.stressLevel));
      if (patch.waterGlasses != null) setWater(String(patch.waterGlasses));
    },
    []
  );

  const loadHome = useCallback(async (opts?: { skipCache?: boolean }) => {
    if (!token) return;
    setError(null);
    const cacheKey = `home:${journalDate}`;
    if (!opts?.skipCache) {
      const cached = await getCached<HomeData>(cacheKey);
      if (cached) {
        setData({
          ...cached,
          kaiSkinScore: cached.kaiSkinScore ?? 0,
          weeklyDeltaScore: cached.weeklyDeltaScore ?? cached.weeklyChangePercent ?? 0,
          lifestyleAlignmentScore: cached.lifestyleAlignmentScore ?? cached.routineScore ?? 0,
          streakCurrent: cached.streakCurrent ?? 0,
          streakLongest: cached.streakLongest ?? 0,
          cycleTrackingEnabled: cached.cycleTrackingEnabled ?? false,
          homeDateYmd: cached.homeDateYmd,
          doctorVoiceNotes: cached.doctorVoiceNotes ?? [],
          doctorArchivedVoiceNotes: cached.doctorArchivedVoiceNotes ?? [],
          doctorVoiceNote: cached.doctorVoiceNote ?? null,
          doctorVoiceNoteIsNew: cached.doctorVoiceNoteIsNew ?? false,
          routinePlanReady: cached.routinePlanReady ?? false,
        });
        setShowingCachedHome(true);
      }
    }
    const json = await apiJson<HomeData>(`/api/patient/home?date=${encodeURIComponent(journalDate)}`, token, {
      method: "GET",
    });
    const nextData: HomeData = {
      ...json,
      kaiSkinScore: json.kaiSkinScore ?? 0,
      weeklyDeltaScore:
        json.weeklyDeltaScore ?? json.weeklyChangePercent ?? 0,
      lifestyleAlignmentScore:
        json.lifestyleAlignmentScore ?? json.routineScore ?? 0,
      streakCurrent: json.streakCurrent ?? 0,
      streakLongest: json.streakLongest ?? 0,
      cycleTrackingEnabled: json.cycleTrackingEnabled ?? false,
      homeDateYmd: json.homeDateYmd,
      doctorVoiceNotes: json.doctorVoiceNotes ?? [],
      doctorArchivedVoiceNotes: json.doctorArchivedVoiceNotes ?? [],
      doctorVoiceNote: json.doctorVoiceNote ?? null,
      doctorVoiceNoteIsNew: json.doctorVoiceNoteIsNew ?? false,
      routinePlanReady: json.routinePlanReady ?? false,
    };
    setData(nextData);
    setShowingCachedHome(false);
    setSkinInsightReloadNonce((n) => n + 1);
    await setCached(cacheKey, nextData);
    setSelectedScanIdx(0);
    const am = normalizeRoutineSteps(
      json.todayLog?.routineAmSteps,
      json.amItems.length,
      undefined
    );
    const pm = normalizeRoutineSteps(
      json.todayLog?.routinePmSteps,
      json.pmItems.length,
      undefined
    );
    setRoutine({ am, pm });

    const log = json.todayLog;
    if (log) {
      clearJournalSyncPatch(journalDate);
      setSleep(String(log.sleepHours ?? 0));
      setStress(String(log.stressLevel ?? 5));
      setWater(String(log.waterGlasses ?? 0));
      setJournalText(String(log.journalEntry ?? ""));
      setMood(String(log.mood ?? "Neutral"));
      setAmRoutine(Boolean(log.amRoutine));
      setPmRoutine(Boolean(log.pmRoutine));
      setDietType(typeof log.dietType === "string" ? log.dietType : "balanced");
      setSunExposure(typeof log.sunExposure === "string" ? log.sunExposure : "low");
      setCycleDay(
        typeof log.cycleDay === "number" && log.cycleDay > 0 ? String(log.cycleDay) : ""
      );
    } else {
      const optimistic = peekJournalSyncPatch(journalDate);
      if (optimistic) applyJournalSyncPatch(optimistic);
    }
  }, [token, journalDate, applyJournalSyncPatch]);

  const patchVoiceNote = useCallback(
    async (id: string, body: { listened?: boolean; archived?: boolean }) => {
      if (!token) return false;
      setVoiceBusyId(id);
      try {
        await apiJson(`/api/patient/voice-notes/${id}`, token, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        await loadHome({ skipCache: true });
        return true;
      } catch {
        return false;
      } finally {
        setVoiceBusyId(null);
      }
    },
    [token, loadHome]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await loadHome();
      } catch (e) {
        if (alive) {
          setError(e instanceof ApiError ? e.message : "Could not load dashboard.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadHome]);

  const loadJournalForDate = useCallback(
    async (ymd: string) => {
      if (!token) return;
      const loadGen = ++journalLoadGenRef.current;
      markJournalNotReady();
      setJournalLoading(true);
      setJournalHint(null);
      try {
        const res = await apiJson<{ entry: Record<string, unknown> | null }>(
          `/api/journal?date=${encodeURIComponent(ymd)}`,
          token,
          { method: "GET" }
        );
        if (loadGen !== journalLoadGenRef.current) return;

        const entry = res.entry;
        if (entry) {
          clearJournalSyncPatch(ymd);
          setSleep(String(entry.sleepHours ?? 0));
          setStress(String(entry.stressLevel ?? 5));
          setWater(String(entry.waterGlasses ?? 0));
          setJournalText(String(entry.journalEntry ?? ""));
          setMood(String(entry.mood ?? "Neutral"));
          setAmRoutine(Boolean(entry.amRoutine));
          setPmRoutine(Boolean(entry.pmRoutine));
          const d = typeof entry.dietType === "string" ? entry.dietType : "balanced";
          setDietType(DIETS.includes(d as (typeof DIETS)[number]) ? d : "balanced");
          const s = typeof entry.sunExposure === "string" ? entry.sunExposure : "low";
          setSunExposure(SUNS.includes(s as (typeof SUNS)[number]) ? s : "low");
          setCycleDay(
            typeof entry.cycleDay === "number" && entry.cycleDay > 0
              ? String(entry.cycleDay)
              : ""
          );
        } else {
          const optimistic = peekJournalSyncPatch(ymd);
          if (
            optimistic &&
            (optimistic.sleepHours != null ||
              optimistic.stressLevel != null ||
              optimistic.waterGlasses != null)
          ) {
            applyJournalSyncPatch(optimistic);
          } else {
            setSleep("0");
            setStress("5");
            setWater("0");
          }
          setJournalText("");
          setMood("Neutral");
          setAmRoutine(false);
          setPmRoutine(false);
          setDietType("balanced");
          setSunExposure("low");
          setCycleDay("");
        }
      } catch {
        if (loadGen === journalLoadGenRef.current) {
          setJournalHint("Could not load journal for that day.");
        }
      } finally {
        if (loadGen === journalLoadGenRef.current) {
          setJournalLoading(false);
          markJournalReady();
        }
      }
    },
    [token, markJournalNotReady, markJournalReady, applyJournalSyncPatch]
  );

  useEffect(() => {
    void loadJournalForDate(journalDate);
  }, [journalDate, loadJournalForDate]);

  useEffect(() => {
    return subscribeJournalUpdated((patch) => {
      if (patch.date !== journalDate) return;
      applyJournalSyncPatch(patch);
    });
  }, [journalDate, applyJournalSyncPatch]);

  useFocusEffect(
    useCallback(() => {
      const backSub = BackHandler.addEventListener("hardwareBackPress", () => true);

      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        return () => backSub.remove();
      }
      if (token) {
        void loadHome({ skipCache: true }).catch(() => {
          /* 401 handled globally; ignore other refresh errors on focus */
        });
        void loadJournalForDate(journalDate).catch(() => {
          /* ignore refresh errors on focus */
        });
      }
      return () => backSub.remove();
    }, [token, loadHome, loadJournalForDate, journalDate])
  );

  const skinScanHistory = useMemo(
    () => data?.skinScanHistory ?? [],
    [data?.skinScanHistory]
  );
  const selectedScan =
    skinScanHistory.length > 0
      ? skinScanHistory[Math.min(selectedScanIdx, skinScanHistory.length - 1)]
      : null;
  const latestScan = skinScanHistory[0] ?? null;
  const params = useMemo<SkinParamWithContext[]>(() => {
    const current = kaiParamsFromAnalysis(selectedScan?.analysisResults ?? null);
    const prevScan =
      selectedScanIdx < skinScanHistory.length - 1
        ? skinScanHistory[selectedScanIdx + 1]
        : null;
    const prevMap = new Map(
      kaiParamsFromAnalysis(prevScan?.analysisResults ?? null).map((p) => [p.label, p.value])
    );
    const selectedTs = selectedScan ? new Date(selectedScan.createdAt).getTime() : null;
    const weekStartTs =
      selectedTs == null ? null : selectedTs - 7 * 24 * 60 * 60 * 1000;
    const weekScans =
      selectedTs == null || weekStartTs == null
        ? []
        : skinScanHistory.filter((s) => {
            const t = new Date(s.createdAt).getTime();
            return t < selectedTs && t >= weekStartTs;
          });
    const weekBuckets = new Map<string, number[]>();
    for (const s of weekScans) {
      const rows = kaiParamsFromAnalysis(s.analysisResults ?? null);
      for (const r of rows) {
        const arr = weekBuckets.get(r.label) ?? [];
        arr.push(r.value);
        weekBuckets.set(r.label, arr);
      }
    }
    return current.map((p) => {
      const prev = prevMap.get(p.label);
      const vals = weekBuckets.get(p.label) ?? [];
      return {
        ...p,
        deltaFromPrev: typeof prev === "number" ? Math.round(p.value - prev) : null,
        prevWeekAvg:
          vals.length > 0
            ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length)
            : null,
      };
    });
  }, [selectedScan, selectedScanIdx, skinScanHistory]);

  const kaiSkinScore = data
    ? Math.min(100, Math.max(0, Math.round(data.kaiSkinScore)))
    : latestScan
      ? Math.min(100, Math.max(0, Math.round(latestScan.skinScore)))
      : 40;

  async function persistRoutine(nextAm: boolean[], nextPm: boolean[]) {
    if (!token) return;
    try {
      await apiJson(`/api/journal`, token, {
        method: "PATCH",
        body: JSON.stringify({
          date: format(new Date(), "yyyy-MM-dd"),
          routineAmSteps: nextAm,
          routinePmSteps: nextPm,
        }),
      });
      void loadHome({ skipCache: true });
    } catch {
      void loadHome();
    }
  }

  function toggleAm(i: number) {
    if (!data) return;
    setRoutine((r) => {
      const nextAm = r.am.map((v, j) => (j === i ? !v : v));
      const next = { am: nextAm, pm: r.pm };
      void persistRoutine(next.am, next.pm);
      return next;
    });
  }

  function togglePm(i: number) {
    if (!data) return;
    setRoutine((r) => {
      const nextPm = r.pm.map((v, j) => (j === i ? !v : v));
      const next = { am: r.am, pm: nextPm };
      void persistRoutine(next.am, next.pm);
      return next;
    });
  }

  async function saveJournal() {
    if (!token) return;
    setJournalSaving(true);
    setJournalHint(null);
    try {
      const cycRaw = Number.parseInt(cycleDay, 10);
      const cyc =
        cycleDay.trim() === "" || Number.isNaN(cycRaw)
          ? null
          : Math.min(35, Math.max(1, cycRaw));
      await apiJson(`/api/journal`, token, {
        method: "POST",
        body: JSON.stringify({
          date: journalDate,
          sleepHours: Number.parseFloat(sleep) || 0,
          stressLevel: Number.parseInt(stress, 10) || 0,
          waterGlasses: Number.parseInt(water, 10) || 0,
          journalEntry: journalText.trim() || null,
          mood,
          amRoutine,
          pmRoutine,
          dietType,
          sunExposure,
          cycleDay: cyc && cyc > 0 ? cyc : null,
        }),
      });
    } catch {
      setJournalHint("Could not save. Try again.");
    } finally {
      setJournalSaving(false);
    }
  }

  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isWideLayout = windowWidth >= 768;

  const triggerSos = useCallback(async () => {
    if (sosBusy || !token) return;

    const sendSos = async (detail: string) => {
      const text = detail.trim()
        ? `SOS: ${detail.trim()}`
        : "SOS: Adverse reaction after treatment. Need urgent doctor help.";
      setSosBusy(true);
      try {
        await apiJson("/api/chat/plain/message", token, {
          method: "POST",
          body: JSON.stringify({ assistantId: "doctor", isUrgent: true, text }),
        });
        router.push("/(drawer)/chat?assistant=doctor" as Href);
      } catch (e) {
        const msg =
          e instanceof ApiError && e.message
            ? e.message
            : "Could not send urgent alert. Try again.";
        Alert.alert("Urgent alert failed", msg);
      } finally {
        setSosBusy(false);
      }
    };

    if (Platform.OS === "ios") {
      Alert.prompt(
        "SOS alert",
        "Describe symptoms briefly (redness, swelling, pain, etc).",
        (detail) => {
          if (detail != null) void sendSos(detail);
        },
        "plain-text",
        ""
      );
    } else {
      Alert.alert(
        "Urgent SOS",
        "Send an urgent alert to your doctor?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Send",
            onPress: () => void sendSos(""),
          },
        ]
      );
    }
  }, [sosBusy, token, router]);

  const greetingName = useMemo(() => {
    const raw = data?.userName?.trim();
    if (!raw) return "there";
    return raw.split(/\s+/)[0] ?? raw;
  }, [data?.userName]);

  const selectedDate = useMemo(() => parseISO(`${journalDate}T12:00:00`), [journalDate]);
  const weekDays = useMemo(() => {
    const today = new Date();
    const thisWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const start = addDays(thisWeekStart, weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const ymd = format(d, "yyyy-MM-dd");
      const isFuture = ymd > todayStr;
      const isSelected = ymd === journalDate;
      return {
        date: d,
        ymd,
        label: format(d, "EEE"),
        day: format(d, "dd"),
        month: format(d, "MMM"),
        isToday: isSameDay(d, today),
        isFuture,
        isSelected,
      };
    });
  }, [weekOffset, selectedDate, todayStr, journalDate]);

  const weekMonthLabel = useMemo(() => {
    const start = weekDays[0]?.date;
    const end = weekDays[6]?.date;
    if (!start || !end) return "";
    const startMonth = format(start, "MMMM");
    const endMonth = format(end, "MMMM");
    if (startMonth === endMonth) return startMonth;
    return `${format(start, "MMM")} – ${format(end, "MMM")}`;
  }, [weekDays]);

  const amDone = useMemo(() => routine.am.filter(Boolean).length, [routine.am]);
  const pmDone = useMemo(() => routine.pm.filter(Boolean).length, [routine.pm]);
  const totalRoutineSteps = (data?.amItems.length ?? 0) + (data?.pmItems.length ?? 0);
  const completedRoutineSteps = amDone + pmDone;

  const streakDays = useMemo(() => {
    const completedSet = new Set(data?.weekCompletedDates ?? []);
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const dayLabel = format(d, "EEE");
      const ymd = format(d, "yyyy-MM-dd");
      return {
        label: dayLabel,
        done: completedSet.has(ymd),
        isFuture: d > today && !isSameDay(d, today),
      };
    });
  }, [data?.weekCompletedDates, selectedDate]);

  const weekDoneCount = useMemo(
    () => streakDays.filter((d) => d.done).length,
    [streakDays]
  );
  const allRoutineDone =
    totalRoutineSteps > 0 && completedRoutineSteps >= totalRoutineSteps;

  if (loading || !data) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.err}>{error}</Text> : <ActivityIndicator size="large" />}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 16 },
        isWideLayout && styles.scrollContentWide,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={NAVY}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await Promise.all([loadHome(), loadJournalForDate(journalDate)]);
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      {/* ── Greeting ── */}
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingText}>
            Hello {greetingName} ☀️
          </Text>
          <Text style={styles.greetingSub}>Let's achieve your best skin day!</Text>
        </View>
        <View style={styles.greetingActions}>
          <Pressable
            style={[styles.sosBtn, sosBusy && styles.sosBtnDisabled]}
            onPress={() => void triggerSos()}
            disabled={sosBusy}
            accessibilityLabel="Urgent: notify doctor immediately"
          >
            {sosBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="warning" size={13} color="#fff" />
            )}
          </Pressable>
          <NotificationBell />
        </View>
      </View>

      {/* ── Date strip: arrows + week chips in one row ── */}
      <View style={styles.dateCalendarRow}>
        <Pressable
          onPress={() => setWeekOffset((o) => o - 1)}
          style={styles.dateNavArrow}
          hitSlop={10}
          accessibilityLabel="Previous week"
        >
          <Ionicons name="chevron-back" size={16} color={NAVY} />
        </Pressable>

        <View style={styles.dateChipsTrack}>
          {weekDays.map((d) => (
            <Pressable
              key={d.ymd}
              onPress={() => {
                if (d.isFuture) return;
                setJournalDate(d.ymd);
                setWeekOffset(0);
              }}
              disabled={d.isFuture}
              style={[
                styles.dateChip,
                d.isSelected && styles.dateChipToday,
                d.isFuture && styles.dateChipDisabled,
                d.isToday && !d.isSelected && styles.dateChipIsToday,
              ]}
            >
              <Text style={[styles.dateChipLabel, d.isSelected && styles.dateChipLabelToday]}>
                {d.label}
              </Text>
              <Text style={[styles.dateChipDay, d.isSelected && styles.dateChipDayToday]}>
                {d.day}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setWeekOffset((o) => o + 1)}
          style={styles.dateNavArrow}
          hitSlop={10}
          accessibilityLabel="Next week"
        >
          <Ionicons name="chevron-forward" size={16} color={NAVY} />
        </Pressable>
      </View>

      {weekMonthLabel ? (
        <Text style={styles.weekMonthLabel}>{weekMonthLabel}</Text>
      ) : null}

      {/* ── Top row: navy metrics + radar ── */}
      <View style={[styles.topRow, isWideLayout && styles.topRowWide]}>
        <NavyMetricsCard
          kaiSkinScore={kaiSkinScore}
          weeklyDeltaScore={data.weeklyDeltaScore}
          weeklyDeltaMeaningful={data.weeklyDeltaMeaningful !== false}
          latestScanAt={latestScan?.createdAt ?? null}
          consistencyScore={data.lifestyleAlignmentScore}
          style={isWideLayout ? styles.topRowHalf : undefined}
        />
        {latestScan ? (
          <SkinHealthMetricsCard
            analysis={latestScan.analysisResults}
            compact
            style={[isWideLayout && styles.topRowHalf, styles.skinHealthCardInRow]}
          />
        ) : (
          <FirstScanCta
            message="Take a scan to see skin health metrics"
            style={[isWideLayout && styles.topRowHalf, styles.skinHealthCardInRow]}
          />
        )}
      </View>

      {/* ── Routine (left) | skin params (right) ── */}
      <View style={styles.dashboardGrid}>
      <View style={styles.dashboardRow}>
      <View style={styles.dashboardRoutineCol}>
      {(() => {
        const amTotal = data.amItems.length || 0;
        const pmTotal = data.pmItems.length || 0;
        const totalSteps = amTotal + pmTotal;
        const completedSteps = amDone + pmDone;
        const progressPct =
          totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        const amComplete = amTotal > 0 && amDone >= amTotal;
        const pmComplete = pmTotal > 0 && pmDone >= pmTotal;

        return (
          <View
            style={[
              styles.routineMergedCard,
              styles.routineMergedCardCompact,
              styles.dashboardPairedCard,
            ]}
          >
            <View style={styles.routineMergedHeader}>
              <View style={styles.dashboardSectionHeaderLead}>
                <View style={styles.dashboardSectionIcon}>
                  <Ionicons name="list" size={14} color="#fff" />
                </View>
                <Text style={styles.dashboardSectionTitle}>DAILY ROUTINE</Text>
              </View>
              <Text style={styles.routineMergedMeta}>
                {completedSteps}/{totalSteps || 0} steps
              </Text>
            </View>
            {totalSteps > 0 ? (
              <View style={styles.routineProgressTrack}>
                <View
                  style={[styles.routineProgressFill, { width: `${progressPct}%` }]}
                />
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.routineMergedRow,
                styles.routineMergedRowCompact,
                pressed && styles.routineMergedRowPressed,
              ]}
              onPress={() =>
                router.push(
                  `/(drawer)/morning-routine?date=${encodeURIComponent(journalDate)}` as Href
                )
              }
            >
              <View style={[styles.routineIconCircle, styles.routineIconCircleCompact]}>
                <Ionicons name="sunny" size={18} color="#F59E0B" />
              </View>
              <View style={styles.routineMergedCopy}>
                <Text style={styles.routineMergedRowTitleCompact}>Morning</Text>
                <Text style={styles.routineMergedRowSubCompact} numberOfLines={1}>
                  {amTotal > 0
                    ? amComplete
                      ? "Completed for today"
                      : `Step ${amDone} of ${amTotal}`
                    : "No steps yet"}
                </Text>
              </View>
              {amComplete ? (
                <Ionicons name="checkmark-circle" size={18} color={GREEN_ACCENT} />
              ) : (
                <View style={styles.routineStepPillCompact}>
                  <Text style={styles.routineStepTextCompact}>
                    {amDone}/{amTotal || 0}
                  </Text>
                </View>
              )}
              <View style={styles.routineArrowCompact}>
                <Ionicons name="arrow-forward" size={12} color="#fff" />
              </View>
            </Pressable>

            <View style={styles.routineMergedDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.routineMergedRow,
                styles.routineMergedRowCompact,
                pressed && styles.routineMergedRowPressed,
              ]}
              onPress={() =>
                router.push(
                  `/(drawer)/night-routine?date=${encodeURIComponent(journalDate)}` as Href
                )
              }
            >
              <View style={[styles.routineIconCircle, styles.routineIconCircleCompact]}>
                <Ionicons name="cloudy-night" size={18} color="#fff" />
              </View>
              <View style={styles.routineMergedCopy}>
                <Text style={styles.routineMergedRowTitleCompact}>Night</Text>
                <Text style={styles.routineMergedRowSubCompact} numberOfLines={1}>
                  {pmTotal > 0
                    ? pmComplete
                      ? "Completed for today"
                      : `Step ${pmDone} of ${pmTotal}`
                    : "No steps yet"}
                </Text>
              </View>
              {pmComplete ? (
                <Ionicons name="checkmark-circle" size={18} color={GREEN_ACCENT} />
              ) : (
                <View style={styles.routineStepPillCompact}>
                  <Text style={styles.routineStepTextCompact}>
                    {pmDone}/{pmTotal || 0}
                  </Text>
                </View>
              )}
              <View style={styles.routineArrowCompact}>
                <Ionicons name="arrow-forward" size={12} color="#fff" />
              </View>
            </Pressable>
          </View>
        );
      })()}

        <DailyJournalMergedCard
          compact
          fillHeight
          style={styles.dashboardPairedCard}
          selectedYmd={journalDate}
          initialSleepHours={Number(sleep) || 0}
          initialWaterGlasses={Number.parseInt(water, 10) || 0}
          initialStressLevel={Number.parseInt(stress, 10) || 5}
          token={token}
          onValuesChange={({ sleepHours, waterGlasses, stressLevel }) => {
            setSleep(String(sleepHours));
            setWater(String(waterGlasses));
            setStress(String(stressLevel));
          }}
        />
      </View>

      <View style={styles.dashboardSideCol}>
        {latestScan ? (
          <SkinParamMetricsCard
            compact
            fillHeight
            style={styles.dashboardPairedCard}
            analysis={latestScan.analysisResults}
            onViewAll={() => router.push("/(drawer)/all-skin-params" as Href)}
          />
        ) : (
          <FirstScanCta
            compact
            style={styles.dashboardPairedCard}
            message="Skin parameters appear after your first scan"
          />
        )}
      </View>
      </View>

      <DashboardStreakCard
        compact
        streakCurrent={data.streakCurrent}
        streakLongest={data.streakLongest}
        weekDoneCount={weekDoneCount}
        streakDays={streakDays}
        allRoutineDone={allRoutineDone}
        routinePlanReady={data.routinePlanReady ?? false}
        style={styles.dashboardFullWidth}
      />

      <DoctorFeedbackSection
        section="feedback"
        feedbackEntries={data.feedbackEntries ?? []}
        archivedEntries={data.archivedFeedbackEntries ?? []}
        legacyFeedback={data.doctorFeedback}
        legacyVoiceNotes={data.doctorVoiceNotes ?? []}
        legacyArchivedVoiceNotes={data.doctorArchivedVoiceNotes ?? []}
        onboardingComplete={data.onboardingComplete}
        token={token}
        onPatchVoiceNote={patchVoiceNote}
        voiceBusyId={voiceBusyId}
        onRefresh={loadHome}
      />

      <DoctorFeedbackSection
        section="voice"
        feedbackEntries={data.feedbackEntries ?? []}
        archivedEntries={data.archivedFeedbackEntries ?? []}
        legacyFeedback={data.doctorFeedback}
        legacyVoiceNotes={data.doctorVoiceNotes ?? []}
        legacyArchivedVoiceNotes={data.doctorArchivedVoiceNotes ?? []}
        voiceNoteIsNew={data.doctorVoiceNoteIsNew ?? false}
        onboardingComplete={data.onboardingComplete}
        token={token}
        onPatchVoiceNote={patchVoiceNote}
        voiceBusyId={voiceBusyId}
        onRefresh={loadHome}
      />

      <WeeklyInsightSection
        style={styles.dashboardFullWidth}
        reloadNonce={skinInsightReloadNonce}
        home={
          data
            ? {
                kaiSkinScore: data.kaiSkinScore,
                weeklyDeltaScore: data.weeklyDeltaScore,
                kaiInsightsEnabled: data.kaiInsightsEnabled,
              }
            : null
        }
      />

      </View>

      {/* Skin parameters section hidden for now — uncomment to restore.
      <View style={[styles.card, styles.skinParamsLegacySection]}>
        <View style={styles.skinParamsHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h2}>Skin parameters</Text>
          </View>
          {skinScanHistory.length > 0 ? (
            <Pressable
              onPress={() => router.push("/(drawer)/all-skin-params" as Href)}
              hitSlop={8}
            >
              <Text style={styles.skinParamsLink}>View all</Text>
            </Pressable>
          ) : null}
        </View>
        {skinScanHistory.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scanChipRow}
          >
            {skinScanHistory.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedScanIdx(i)}
                style={[styles.scanChip, selectedScanIdx === i && styles.scanChipOn]}
              >
                <Text
                  style={selectedScanIdx === i ? styles.scanChipTextOn : styles.scanChipText}
                  numberOfLines={1}
                >
                  {formatScanChipLabel(s, skinScanHistory)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Text style={styles.skinParamsMeta}>
          {selectedScan
            ? `Scan · ${formatScanDetailLabel(selectedScan)}`
            : "No scans yet — sample targets shown"}
        </Text>
        <View style={styles.paramGrid}>
          {params.map((p) => (
            <View key={p.label} style={styles.paramCell}>
              <View style={styles.paramHeader}>
                <Text style={styles.paramLabel} numberOfLines={2}>
                  {p.label}
                </Text>
                <View style={styles.paramScoreRow}>
                  <Text style={styles.paramNum}>{Math.round(p.value)}/100</Text>
                  <Text
                    style={[
                      styles.paramDelta,
                      p.deltaFromPrev == null
                        ? styles.deltaNeutral
                        : p.deltaFromPrev > 0
                          ? styles.deltaUp
                          : p.deltaFromPrev < 0
                            ? styles.deltaDown
                            : styles.deltaNeutral,
                    ]}
                  >
                    {p.deltaFromPrev == null
                      ? "Δ —"
                      : `Δ ${p.deltaFromPrev > 0 ? "+" : ""}${p.deltaFromPrev}`}
                  </Text>
                </View>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFg, { width: `${Math.min(100, Math.max(0, p.value))}%` }]} />
              </View>
              <Text style={styles.paramWeekAvg}>
                Prev week avg{" "}
                <Text style={styles.paramWeekAvgVal}>
                  {p.prevWeekAvg == null ? "—" : `${p.prevWeekAvg}/100`}
                </Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
      */}
    </ScrollView>
  );
}

const RADAR_LEVELS = 4;
const RADAR_SIZE_DEFAULT = 260;
const RADAR_LABEL_OFFSET_DEFAULT = 30;

function RadarChart({
  metrics,
  compact = false,
}: {
  metrics: { label: string; value: number }[];
  compact?: boolean;
}) {
  const radarSize = compact ? 176 : RADAR_SIZE_DEFAULT;
  const radarCenter = radarSize / 2;
  const radarRadius = compact ? 68 : 90;
  const labelOffset = compact ? 24 : RADAR_LABEL_OFFSET_DEFAULT;
  const radarOuter = radarSize + labelOffset * 2;
  const n = metrics.length;
  const angleSlice = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  function pointOnAxis(i: number, ratio: number, radius = radarRadius) {
    const angle = startAngle + i * angleSlice;
    return {
      x: radarCenter + radius * ratio * Math.cos(angle),
      y: radarCenter + radius * ratio * Math.sin(angle),
    };
  }

  const gridLevels = Array.from({ length: RADAR_LEVELS }, (_, l) => {
    const ratio = (l + 1) / RADAR_LEVELS;
    return metrics.map((_, i) => pointOnAxis(i, ratio)).map((p) => `${p.x},${p.y}`).join(" ");
  });

  const dataPoints = metrics
    .map((m, i) => pointOnAxis(i, m.value / 100))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  return (
    <View
      style={{
        width: radarOuter,
        height: radarOuter,
        alignSelf: "center",
        marginVertical: compact ? 0 : 8,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: labelOffset,
          top: labelOffset,
          width: radarSize,
          height: radarSize,
        }}
      >
        <Svg width={radarSize} height={radarSize}>
          {gridLevels.map((pts, l) => (
            <Polygon key={l} points={pts} fill="none" stroke="#D1D5DB" strokeWidth={1} />
          ))}
          {metrics.map((_, i) => {
            const p = pointOnAxis(i, 1);
            return (
              <Line
                key={i}
                x1={radarCenter}
                y1={radarCenter}
                x2={p.x}
                y2={p.y}
                stroke="#E5E7EB"
                strokeWidth={1}
              />
            );
          })}
          <Polygon
            points={dataPoints}
            fill="rgba(22,163,74,0.2)"
            stroke={GREEN_ACCENT}
            strokeWidth={2}
          />
          {metrics.map((m, i) => {
            const p = pointOnAxis(i, m.value / 100);
            return <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={compact ? 3 : 4} fill={GREEN_ACCENT} />;
          })}
        </Svg>
      </View>
      {metrics.map((m, i) => {
        const angle = startAngle + i * angleSlice;
        const cosVal = Math.cos(angle);
        const sinVal = Math.sin(angle);
        const labelDist = radarRadius + (compact ? 10 : 8);
        const anchor = pointOnAxis(i, 1, labelDist);
        const labelW = compact ? 72 : 88;
        const labelH = compact ? 28 : 32;

        let left = labelOffset + anchor.x;
        let top = labelOffset + anchor.y;

        if (cosVal > 0.3) left -= 0;
        else if (cosVal < -0.3) left -= labelW;
        else left -= labelW / 2;

        if (sinVal > 0.5) top -= 0;
        else if (sinVal < -0.5) top -= labelH;
        else top -= labelH / 2;

        return (
          <View
            key={m.label}
            style={{
              position: "absolute",
              left,
              top,
              width: labelW,
              alignItems: cosVal > 0.3 ? "flex-start" : cosVal < -0.3 ? "flex-end" : "center",
            }}
          >
            <Text
              style={{
                fontSize: compact ? 9 : 12,
                color: "#64748b",
                fontWeight: "500",
              }}
              numberOfLines={1}
            >
              {m.label}
            </Text>
            <Text
              style={{
                fontSize: compact ? 11 : 14,
                color: "#18181b",
                fontWeight: "800",
              }}
            >
              {m.value}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SkinHealthMetricsCard({
  analysis,
  compact = false,
  style,
}: {
  analysis: unknown;
  compact?: boolean;
  style?: object;
}) {
  const metrics = useMemo(() => extractSkinHealthMetrics(analysis), [analysis]);
  return (
    <View style={[styles.skinHealthCard, compact && styles.skinHealthCardCompact, style]}>
      <View style={styles.skinHealthHeader}>
        <View style={[styles.skinHealthIconWrap, compact && styles.skinHealthIconWrapCompact]}>
          <Ionicons name="pulse" size={compact ? 14 : 16} color="#fff" />
        </View>
        <Text style={[styles.skinHealthTitle, compact && styles.skinHealthTitleCompact]}>
          SKIN HEALTH METRICS
        </Text>
      </View>
      <RadarChart metrics={metrics} compact={compact} />
    </View>
  );
}

function ParamRing({ value, color, size = 72 }: { value: number; color: string; size?: number }) {
  const sw = size <= 48 ? 4 : 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  const valueFontSize = size <= 44 ? 12 : size <= 48 ? 13 : 18;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E5E7EB" strokeWidth={sw} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={sw} fill="none"
          strokeDasharray={`${circ}`} strokeDashoffset={offset}
          strokeLinecap="round" rotation="-90" origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text
        style={{
          position: "absolute",
          fontSize: valueFontSize,
          fontWeight: "800",
          color: "#18181b",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SkinParamMetricsCard({
  analysis,
  onViewAll,
  compact = false,
  fillHeight = false,
  style,
}: {
  analysis: unknown;
  onViewAll: () => void;
  compact?: boolean;
  fillHeight?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const topMetrics = useMemo(
    () => extractSkinParamMetrics(analysis).slice(0, 3),
    [analysis]
  );
  const ringSize = compact ? 44 : 52;

  return (
    <View
      style={[
        compact ? styles.routineMergedCard : styles.skinParamsCard,
        compact && styles.skinParamsCardCompact,
        compact && styles.skinParamsCardFlush,
        fillHeight && styles.skinParamsCardFill,
        style,
      ]}
    >
      <View style={[styles.routineMergedHeader, compact && styles.skinParamsHeaderCompact]}>
        <Text style={styles.dashboardSectionTitle}>SKIN PARAMETER</Text>
      </View>
      {compact ? (
        <View
          style={[
            styles.paramMetricsListColumn,
            fillHeight && styles.paramMetricsListColumnFill,
          ]}
        >
          {topMetrics.map((m) => (
            <View
              key={m.label}
              style={[
                styles.paramMetricListCell,
                fillHeight && styles.paramMetricListCellFill,
              ]}
            >
              <ParamRing value={m.value} color={m.color} size={ringSize} />
              <Text style={styles.paramMetricListLabel} numberOfLines={2}>
                {m.label}
              </Text>
              <Text style={[styles.paramMetricListStatus, { color: m.color }]}>
                {m.status}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.paramMetricsGrid}>
          {[0, 2].map((rowStart) => (
            <View key={rowStart} style={styles.paramMetricsRow}>
              {topMetrics.slice(rowStart, rowStart + 2).map((m) => (
                <View key={m.label} style={styles.paramMetricCell}>
                  <ParamRing value={m.value} color={m.color} size={ringSize} />
                  <Text style={styles.paramMetricLabel} numberOfLines={2}>
                    {m.label}
                  </Text>
                  <Text style={[styles.paramMetricStatus, { color: m.color }]}>
                    {m.status}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
      <Pressable
        style={[styles.viewAllParamsBtn, compact && styles.viewAllParamsBtnCompact]}
        onPress={onViewAll}
      >
        <Text style={[styles.viewAllParamsText, compact && styles.viewAllParamsTextCompact]}>
          View all Parameters
        </Text>
      </Pressable>
    </View>
  );
}

function NextReminderCard({
  amHm,
  pmHm,
  amDone,
  amTotal,
  pmDone,
  pmTotal,
  onPress,
}: {
  amHm: string;
  pmHm: string;
  amDone: number;
  amTotal: number;
  pmDone: number;
  pmTotal: number;
  onPress: (target: "am" | "pm") => void;
}) {
  const allCompleted = amTotal > 0 && pmTotal > 0 && amDone >= amTotal && pmDone >= pmTotal;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (allCompleted) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [allCompleted]);

  const { target, hours, minutes, seconds } = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const [amH, amM] = amHm.split(":").map(Number);
    const [pmH, pmM] = pmHm.split(":").map(Number);
    const amTotalMin = (amH || 0) * 60 + (amM || 0);
    const pmTotalMin = (pmH || 0) * 60 + (pmM || 0);

    let targetTime: number;
    let tgt: "am" | "pm";

    if (nowMinutes < amTotalMin) {
      targetTime = amTotalMin;
      tgt = "am";
    } else if (nowMinutes < pmTotalMin) {
      targetTime = pmTotalMin;
      tgt = "pm";
    } else {
      targetTime = amTotalMin + 24 * 60;
      tgt = "am";
    }

    const diffMin = targetTime - nowMinutes;
    const diffSec = Math.max(0, diffMin * 60 - now.getSeconds());
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;

    return { target: tgt, hours: h, minutes: m, seconds: s };
  }, [tick, amHm, pmHm]);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (allCompleted) {
    return (
      <View style={[styles.reminderCard, { borderColor: GREEN_ACCENT }]}>
        <View style={styles.reminderLeft}>
          <Ionicons name="checkmark-circle" size={28} color={GREEN_ACCENT} />
          <View>
            <Text style={[styles.reminderLabel, { color: GREEN_ACCENT }]}>All Done for Today!</Text>
            <Text style={[styles.reminderTime, { fontSize: 16 }]}>AM & PM routines completed</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderLeft}>
        <Ionicons name="time-outline" size={28} color={GREEN_ACCENT} />
        <View>
          <Text style={styles.reminderLabel}>Next Reminder in</Text>
          <Text style={styles.reminderTime}>
            {pad(hours)}: {pad(minutes)}: {pad(seconds)}
          </Text>
        </View>
      </View>
      <Pressable
        style={styles.viewTasksBtn}
        onPress={() => onPress(target)}
      >
        <Text style={styles.viewTasksText}>View All Tasks</Text>
      </Pressable>
    </View>
  );
}

function DoctorVoiceNotePlayer({ uri }: { uri: string }) {
  const [playing, setPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [positionSec, setPositionSec] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const fileRef = useRef<string | null>(null);

  const resolveUri = useCallback(async (): Promise<string> => {
    if (fileRef.current) return fileRef.current;
    const path = await resolvePlayableAudioUri(uri, "voice");
    fileRef.current = path;
    return path;
  }, [uri]);

  const cleanup = useCallback(async () => {
    try { await soundRef.current?.unloadAsync(); } catch { /* */ }
    soundRef.current = null;
    setPlaying(false);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      await configurePlaybackAudioMode();
      await primeAudioSessionForPlayback();
      if (!soundRef.current) {
        const playUri = await resolveUri();
        const { sound } = await Audio.Sound.createAsync(
          { uri: playUri },
          { shouldPlay: false, volume: 1, isMuted: false }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded) return;
          setPositionSec(Math.floor((st.positionMillis ?? 0) / 1000));
          setDurationSec(Math.floor((st.durationMillis ?? 0) / 1000));
          if (st.didJustFinish) {
            setPlaying(false);
            setPositionSec(0);
            void sound.setPositionAsync(0);
          }
        });
      }
      await soundRef.current.playAsync();
      setPlaying(true);
    } catch (e) {
      console.warn("[VoicePlayer] playback error:", e);
      await cleanup();
    }
  }, [playing, resolveUri, cleanup]);

  useEffect(() => () => { void cleanup(); }, [cleanup]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const progress = durationSec > 0 ? positionSec / durationSec : 0;

  return (
    <View style={fbStyles.playerRow}>
      <Pressable onPress={toggle} style={fbStyles.playBtn} hitSlop={8}>
        <Ionicons name={playing ? "pause" : "play"} size={20} color="#fff" />
      </Pressable>
      <View style={fbStyles.waveContainer}>
        {Array.from({ length: 24 }).map((_, i) => {
          const h = 6 + Math.sin(i * 0.7 + 2) * 8 + Math.cos(i * 1.3) * 4;
          const filled = i / 24 <= progress;
          return (
            <View
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 1.5,
                backgroundColor: filled ? NAVY : "#CBD5E1",
                marginHorizontal: 1,
              }}
            />
          );
        })}
      </View>
      <Text style={fbStyles.playerTime}>{fmt(playing ? positionSec : durationSec)}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
}) {
  return (
    <View style={{ flex: 1, minWidth: 90 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

type FeedbackEntry = NonNullable<HomeData["feedbackEntries"]>[number];

function feedbackReplySnippet(entry: FeedbackEntry): string {
  const text = entry.feedbackText?.trim();
  if (text) return text.length > 400 ? `${text.slice(0, 397)}…` : text;
  if (entry.audioDataUri) return "your doctor's voice note";
  return "your doctor's feedback";
}

type DoctorFeedbackGroup = {
  key: string;
  doctorId: string | null;
  doctorName: string | null;
  doctorPhotoUrl: string | null;
  entries: FeedbackEntry[];
};

function groupFeedbackEntries(entries: FeedbackEntry[]): DoctorFeedbackGroup[] {
  const order: string[] = [];
  const map = new Map<string, DoctorFeedbackGroup>();
  for (const entry of entries) {
    const key = entry.doctorId ?? "__unassigned__";
    if (!map.has(key)) {
      order.push(key);
      map.set(key, {
        key,
        doctorId: entry.doctorId,
        doctorName: entry.doctorName,
        doctorPhotoUrl: entry.doctorPhotoUrl,
        entries: [],
      });
    }
    map.get(key)!.entries.push(entry);
  }
  return order.map((k) => map.get(k)!);
}

function filterFeedbackEntriesForSection(
  entries: FeedbackEntry[],
  section: "feedback" | "voice"
): FeedbackEntry[] {
  if (section === "feedback") {
    return entries.filter((e) => Boolean(e.feedbackText?.trim()));
  }
  return entries.filter((e) => Boolean(e.audioDataUri));
}

function DoctorFeedbackSection({
  section,
  feedbackEntries,
  archivedEntries,
  legacyFeedback,
  legacyVoiceNotes,
  legacyArchivedVoiceNotes,
  voiceNoteIsNew = false,
  onboardingComplete,
  token,
  onPatchVoiceNote,
  voiceBusyId,
  onRefresh,
}: {
  section: "feedback" | "voice";
  feedbackEntries: FeedbackEntry[];
  archivedEntries: FeedbackEntry[];
  legacyFeedback?: string;
  legacyVoiceNotes: Array<{ id: string; audioDataUri: string; createdAt: string; listened: boolean }>;
  legacyArchivedVoiceNotes: Array<{ id: string; audioDataUri: string; createdAt: string; listened: boolean }>;
  voiceNoteIsNew?: boolean;
  onboardingComplete?: boolean;
  token: string | null;
  onPatchVoiceNote: (id: string, body: { listened?: boolean; archived?: boolean }) => Promise<boolean>;
  voiceBusyId: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [showArchived, setShowArchived] = useState(false);

  const entries: FeedbackEntry[] = useMemo(() => {
    if (feedbackEntries.length > 0) return feedbackEntries;
    const combined: FeedbackEntry[] = [];
    if (legacyFeedback?.trim()) {
      combined.push({
        id: "__legacy-text__",
        feedbackText: legacyFeedback.trim(),
        audioDataUri: legacyVoiceNotes[0]?.audioDataUri ?? null,
        createdAt: legacyVoiceNotes[0]?.createdAt ?? new Date().toISOString(),
        listened: legacyVoiceNotes[0]?.listened ?? true,
        doctorName: null,
        doctorPhotoUrl: null,
        doctorId: null,
      });
      const remainingNotes = legacyVoiceNotes.slice(1);
      for (const vn of remainingNotes) {
        combined.push({
          id: vn.id,
          feedbackText: null,
          audioDataUri: vn.audioDataUri,
          createdAt: vn.createdAt,
          listened: vn.listened,
          doctorName: null,
          doctorPhotoUrl: null,
          doctorId: null,
        });
      }
    } else {
      for (const vn of legacyVoiceNotes) {
        combined.push({
          id: vn.id,
          feedbackText: null,
          audioDataUri: vn.audioDataUri,
          createdAt: vn.createdAt,
          listened: vn.listened,
          doctorName: null,
          doctorPhotoUrl: null,
          doctorId: null,
        });
      }
    }
    return combined;
  }, [feedbackEntries, legacyFeedback, legacyVoiceNotes]);

  const sectionEntries = useMemo(
    () => filterFeedbackEntriesForSection(entries, section),
    [entries, section]
  );

  const archived: FeedbackEntry[] = useMemo(() => {
    if (archivedEntries.length > 0) return archivedEntries;
    return legacyArchivedVoiceNotes.map((vn) => ({
      id: vn.id,
      feedbackText: null,
      audioDataUri: vn.audioDataUri,
      createdAt: vn.createdAt,
      listened: vn.listened,
      doctorName: null,
      doctorPhotoUrl: null,
      doctorId: null,
    }));
  }, [archivedEntries, legacyArchivedVoiceNotes]);

  const sectionArchived = useMemo(
    () => filterFeedbackEntriesForSection(archived, section),
    [archived, section]
  );

  const entryGroups = useMemo(
    () => groupFeedbackEntries(sectionEntries),
    [sectionEntries]
  );
  const archivedGroups = useMemo(
    () => groupFeedbackEntries(sectionArchived),
    [sectionArchived]
  );

  const hasEntries = sectionEntries.length > 0;
  const headerTitle = section === "feedback" ? "DOCTOR FEEDBACK" : "VOICE NOTES";
  const emptyPlaceholder =
    section === "feedback"
      ? onboardingComplete === false
        ? "Your doctor will send feedback after reviewing your baseline."
        : "No feedback yet. When your doctor sends notes, they will appear here."
      : "No voice notes yet. When your doctor sends audio notes, they will appear here.";

  return (
    <View
      style={[
        fbStyles.container,
        !hasEntries && fbStyles.containerEmpty,
        styles.dashboardFullWidth,
        { marginBottom: hasEntries ? 16 : 8 },
      ]}
    >
      <View style={[fbStyles.headerRow, !hasEntries && fbStyles.headerRowEmpty]}>
        <Text style={[fbStyles.headerTitle, !hasEntries && fbStyles.headerTitleCompact]}>
          {headerTitle}
        </Text>
        {section === "voice" && voiceNoteIsNew ? (
          <View style={fbStyles.newBadge}>
            <Text style={fbStyles.newBadgeText}>New</Text>
          </View>
        ) : null}
      </View>

      {hasEntries ? (
        <>
          {entryGroups.map((group) => (
            <DoctorFeedbackGroupBlock
              key={group.key}
              section={section}
              group={group}
              token={token}
              onPatch={onPatchVoiceNote}
              voiceBusyId={voiceBusyId}
            />
          ))}
        </>
      ) : (
        <Text style={fbStyles.placeholder}>{emptyPlaceholder}</Text>
      )}

      {sectionArchived.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Pressable onPress={() => setShowArchived((v) => !v)} style={fbStyles.archiveToggle}>
            <Ionicons name={showArchived ? "chevron-up" : "chevron-down"} size={16} color={NAVY} />
            <Text style={fbStyles.archiveToggleText}>
              {showArchived ? "Hide" : "Show"} past notes ({sectionArchived.length})
            </Text>
          </Pressable>
          {showArchived
            ? archivedGroups.map((group) => (
                <View key={group.key} style={{ marginTop: 8 }}>
                  {group.doctorName ? (
                    <Text style={fbStyles.groupDoctorLabel}>{group.doctorName}</Text>
                  ) : null}
                  {group.entries.map((entry) => (
                    <FeedbackEntryCard
                      key={entry.id}
                      entry={entry}
                      section={section}
                      onPatch={onPatchVoiceNote}
                      busyId={voiceBusyId}
                      archived
                      showDoctorHeader={group.entries.length === 1 || !group.doctorName}
                    />
                  ))}
                </View>
              ))
            : null}
        </View>
      ) : null}

    </View>
  );
}

function DoctorFeedbackGroupBlock({
  section,
  group,
  token,
  onPatch,
  voiceBusyId,
}: {
  section: "feedback" | "voice";
  group: DoctorFeedbackGroup;
  token: string | null;
  onPatch: (id: string, body: { listened?: boolean; archived?: boolean }) => Promise<boolean>;
  voiceBusyId: string | null;
}) {
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const replyTarget = group.entries[0] ?? null;
  const replyDoctorId = group.doctorId;
  const replyDoctorName = group.doctorName ?? "your doctor";
  const showGroupHeader = group.entries.length > 1 || Boolean(group.doctorName);

  const sendReply = useCallback(async () => {
    if (!token || !replyText.trim() || !replyTarget || !replyDoctorId) return;
    setReplyBusy(true);
    setReplyError(null);
    try {
      const intro = `Hi doctor, I had a query from the feedback: ${feedbackReplySnippet(replyTarget)}`;
      await apiJson(`/api/chat/plain/message`, token, {
        method: "POST",
        body: JSON.stringify({
          assistantId: "doctor",
          doctorId: replyDoctorId,
          text: intro,
        }),
      });
      await apiJson(`/api/chat/plain/message`, token, {
        method: "POST",
        body: JSON.stringify({
          assistantId: "doctor",
          doctorId: replyDoctorId,
          text: replyText.trim(),
        }),
      });
      setReplyText("");
    } catch {
      setReplyError("Could not send your reply. Please try again.");
    } finally {
      setReplyBusy(false);
    }
  }, [token, replyText, replyTarget, replyDoctorId]);

  return (
    <View style={fbStyles.groupBlock}>
      {showGroupHeader ? (
        <View style={fbStyles.groupHeaderRow}>
          {group.doctorPhotoUrl ? (
            <Image source={{ uri: group.doctorPhotoUrl }} style={fbStyles.doctorPhoto} />
          ) : (
            <View style={fbStyles.doctorAvatar}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={fbStyles.groupDoctorLabel}>{replyDoctorName}</Text>
            <Text style={fbStyles.doctorSpec}>Dermatologist</Text>
          </View>
        </View>
      ) : null}
      {group.entries.map((entry) => (
        <FeedbackEntryCard
          key={entry.id}
          entry={entry}
          section={section}
          onPatch={onPatch}
          busyId={voiceBusyId}
          showDoctorHeader={!showGroupHeader}
        />
      ))}
      {section === "feedback" ? (
        <>
          <View style={fbStyles.replyRow}>
            <TextInput
              style={fbStyles.replyInput}
              placeholder={
                replyDoctorId ? `Reply to ${replyDoctorName}…` : "Write a reply..."
              }
              value={replyText}
              onChangeText={(t) => {
                setReplyText(t);
                if (replyError) setReplyError(null);
              }}
              placeholderTextColor="#94a3b8"
              editable={Boolean(replyDoctorId) && !replyBusy}
            />
            <Pressable
              style={[
                fbStyles.sendBtn,
                { opacity: replyBusy || !replyText.trim() || !replyDoctorId ? 0.4 : 1 },
              ]}
              disabled={replyBusy || !replyText.trim() || !replyDoctorId}
              onPress={() => void sendReply()}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
          {replyError ? (
            <Text style={fbStyles.replyError}>{replyError}</Text>
          ) : replyDoctorId ? (
            <Text style={fbStyles.replyHint}>
              Sends to {replyDoctorName} only. We&apos;ll note which feedback you&apos;re asking about first.
            </Text>
          ) : (
            <Text style={fbStyles.replyError}>
              Could not find which doctor to reply to. Open Chat and message your doctor there.
            </Text>
          )}
        </>
      ) : null}
    </View>
  );
}

function feedbackAckLabel(entry: FeedbackEntry, acknowledged: boolean): string {
  if (acknowledged) return "Noted";
  return entry.audioDataUri ? "I've listened" : "I've read this";
}

function FeedbackEntryCard({
  entry,
  section,
  onPatch,
  busyId,
  archived,
  showDoctorHeader = true,
}: {
  entry: FeedbackEntry;
  section: "feedback" | "voice";
  onPatch: (id: string, body: { listened?: boolean; archived?: boolean }) => Promise<boolean>;
  busyId: string | null;
  archived?: boolean;
  showDoctorHeader?: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState(entry.listened);

  useEffect(() => {
    setAcknowledged(entry.listened);
  }, [entry.id, entry.listened]);

  const isBusy = busyId === entry.id;

  async function toggleAcknowledged() {
    const next = !acknowledged;
    setAcknowledged(next);
    const ok = await onPatch(entry.id, { listened: next });
    if (!ok) setAcknowledged(!next);
  }

  async function archiveEntry() {
    const ok = await onPatch(entry.id, { archived: true });
    if (ok) setAcknowledged(true);
  }

  return (
    <View style={[fbStyles.entryCard, archived && fbStyles.entryCardArchived]}>
      {showDoctorHeader ? (
        <View style={fbStyles.doctorRow}>
          {entry.doctorPhotoUrl ? (
            <Image
              source={{ uri: entry.doctorPhotoUrl }}
              style={fbStyles.doctorPhoto}
            />
          ) : (
            <View style={fbStyles.doctorAvatar}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={fbStyles.doctorName}>{entry.doctorName ?? "Your Doctor"}</Text>
            <Text style={fbStyles.doctorSpec}>Dermatologist</Text>
            <Text style={fbStyles.entryDate}>
              {format(parseISO(entry.createdAt), "dd MMM yyyy, hh:mm a")}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={fbStyles.entryDate}>
          {format(parseISO(entry.createdAt), "dd MMM yyyy, hh:mm a")}
        </Text>
      )}

      {section === "feedback" && entry.feedbackText ? (
        <Text style={fbStyles.feedbackText}>{entry.feedbackText}</Text>
      ) : null}

      {section === "voice" && entry.audioDataUri ? (
        <View style={fbStyles.audioRow}>
          <DoctorVoiceNotePlayer uri={entry.audioDataUri} />
        </View>
      ) : null}

      {!archived && entry.id !== "__legacy-text__" ? (
        <View style={fbStyles.actionRow}>
          <Pressable
            style={[fbStyles.actionBtn, acknowledged && fbStyles.actionBtnDone]}
            disabled={isBusy}
            onPress={() => void toggleAcknowledged()}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={acknowledged ? "#16a34a" : NAVY} />
            ) : (
              <Ionicons
                name={acknowledged ? "checkmark-circle" : "checkmark-circle-outline"}
                size={18}
                color={acknowledged ? "#16a34a" : NAVY}
              />
            )}
            <Text style={[fbStyles.actionText, acknowledged && fbStyles.actionTextDone]}>
              {feedbackAckLabel(entry, acknowledged)}
            </Text>
          </Pressable>
          {acknowledged ? (
            <Pressable
              style={fbStyles.actionBtn}
              disabled={isBusy}
              onPress={() => void archiveEntry()}
            >
              <Ionicons name="archive-outline" size={16} color="#64748b" />
              <Text style={fbStyles.actionText}>Move to past notes</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const fbStyles = StyleSheet.create({
  container: {
    marginTop: 4,
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: GLASS,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...dashboardCardShadow,
  },
  containerEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerRowEmpty: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: NAVY,
    letterSpacing: 1,
  },
  headerTitleCompact: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  newBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  newBadgeText: { fontSize: 11, fontWeight: "800", color: "#92400e" },
  placeholder: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "left",
    lineHeight: 17,
  },
  groupBlock: {
    marginBottom: 18,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  groupDoctorLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: NAVY,
  },
  entryCard: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  entryCardArchived: {
    opacity: 0.6,
    marginTop: 8,
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  doctorPhoto: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
  },
  doctorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  doctorName: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  doctorSpec: { fontSize: 13, color: "#6B7280", marginTop: 1 },
  entryDate: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  feedbackText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 23,
    marginBottom: 12,
  },
  audioRow: {
    marginTop: 2,
    marginBottom: 6,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  waveContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 28,
  },
  waveTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "transparent",
    borderRadius: 1.5,
  },
  waveFill: {
    height: 3,
    backgroundColor: "transparent",
    borderRadius: 1.5,
  },
  playerTime: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    minWidth: 36,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionBtnDone: {
    backgroundColor: "rgba(22, 163, 74, 0.08)",
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  actionText: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  actionTextDone: { color: "#16a34a" },
  archiveToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  archiveToggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  replyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: "#F8FAFC",
  },
  replyInput: {
    flex: 1,
    fontSize: 14,
    color: "#334155",
    paddingVertical: 10,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  replyHint: {
    marginTop: 8,
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 16,
  },
  replyError: {
    marginTop: 8,
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 17,
  },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: DASHBOARD_BG },
  scrollContent: { padding: 16, paddingBottom: 40 },
  scrollContentWide: { maxWidth: 1280, alignSelf: "center", width: "100%" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: DASHBOARD_BG,
  },
  err: { color: "#b91c1c", padding: 16 },

  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  greetingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sosBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DASHBOARD_URGENT,
    borderRadius: 15,
    opacity: 0.92,
  },
  sosBtnDisabled: { opacity: 0.5 },
  greetingText: { fontSize: 28, fontWeight: "800", color: "#18181b" },
  greetingSub: { fontSize: 15, color: "#6B7280", marginTop: 4 },

  dateCalendarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  dateNavArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dateChipsTrack: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  dateChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 12,
    backgroundColor: GLASS,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  dateChipToday: { backgroundColor: NAVY, borderColor: NAVY },
  dateChipIsToday: { borderColor: "rgba(76,175,80,0.5)", borderWidth: 1.5 },
  dateChipLabel: { fontSize: 9, fontWeight: "600", color: "#6B7280", lineHeight: 11 },
  dateChipLabelToday: { color: "rgba(255,255,255,0.9)" },
  dateChipDay: { fontSize: 13, fontWeight: "800", color: "#1A1A2E", marginTop: 2, lineHeight: 15 },
  dateChipDayToday: { color: "#fff" },
  dateChipDisabled: { opacity: 0.35 },
  weekMonthLabel: {
    width: "100%",
    marginTop: 2,
    marginBottom: 10,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    opacity: 0.55,
    letterSpacing: 0.3,
  },

  topRow: { gap: 16, marginBottom: 16 },
  topRowWide: { flexDirection: "row", alignItems: "stretch" },
  topRowHalf: { flex: 1, minWidth: 0, marginBottom: 0 },
  dashboardFullWidth: { width: "100%", alignSelf: "stretch" },
  dashboardGrid: { gap: 10, marginBottom: 16 },
  dashboardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  dashboardRoutineCol: { flex: 3, minWidth: 0, gap: 10 },
  dashboardSideCol: { flex: 2, minWidth: 0 },
  dashboardPairedCard: {
    flex: 1,
    minHeight: 0,
  },
  dashboardJournalStreakRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  dashboardJournalStreakHalf: { flex: 1, minWidth: 0 },
  dashboardSectionHeaderLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  dashboardSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  dashboardSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: NAVY,
    flexShrink: 1,
  },

  sectionCard: {
    backgroundColor: GLASS,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...dashboardCardShadow,
  },
  sectionCardFlush: { marginBottom: 0 },
  sectionCardSkinParams: {
    backgroundColor: "transparent",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 0,
    shadowColor: "#2D3E6B",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 8,
  },

  skinHealthCardInRow: { marginBottom: 0 },

  cacheBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  cacheBannerText: { fontSize: 12, color: "#92400e", fontWeight: "600" },

  routineMergedCard: {
    backgroundColor: GLASS,
    borderRadius: 20,
    padding: 20,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...dashboardCardShadow,
  },
  routineMergedCardCompact: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 16,
    borderRadius: 16,
    minHeight: 200,
    justifyContent: "space-between",
  },
  routineMergedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 6,
  },
  routineMergedTitle: { fontSize: 18, fontWeight: "800", color: "#18181b" },
  routineMergedMeta: { fontSize: 10, fontWeight: "600", color: "#6B7280" },
  routineProgressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: DASHBOARD_BG,
    overflow: "hidden",
    marginBottom: 8,
  },
  routineProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: GREEN_ACCENT,
  },
  routineMergedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  routineMergedRowCompact: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 0,
    flex: 1,
    justifyContent: "center",
  },
  routineMergedRowPressed: { backgroundColor: "rgba(255,255,255,0.35)" },
  routineMergedCopy: { flex: 1, minWidth: 0 },
  routineMergedRowTitle: { fontSize: 16, fontWeight: "800", color: "#18181b" },
  routineMergedRowTitleCompact: { fontSize: 13, fontWeight: "800", color: "#18181b" },
  routineMergedRowSub: { fontSize: 13, fontWeight: "500", color: "#6B7280", marginTop: 2 },
  routineMergedRowSubCompact: { fontSize: 10, fontWeight: "500", color: "#6B7280", marginTop: 1 },
  routineMergedDivider: {
    height: 1,
    backgroundColor: GLASS_BORDER,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  routineStepPillCompact: {
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  routineStepTextCompact: { color: "#fff", fontSize: 10, fontWeight: "700" },
  routineIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  routineIconCircleCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  routineArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  routineArrowCompact: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  routineStepPill: {
    alignSelf: "flex-start",
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  routineStepText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  streakCard: {
    backgroundColor: GLASS,
    borderRadius: 20,
    padding: 20,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...dashboardCardShadow,
  },
  streakTitleNavy: {
    fontSize: 20,
    fontWeight: "800",
    color: NAVY,
    marginBottom: 4,
  },
  streakPersonalBest: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
  },
  streakWeekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  streakWeekLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  streakWeekTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: DASHBOARD_BG,
    overflow: "hidden",
    marginBottom: 16,
  },
  streakWeekFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: GREEN_ACCENT,
  },
  streakDotFuture: {
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  streakDotLetter: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  streakCompleteToday: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
  },
  streakSkinRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginBottom: 16,
  },
  streakSkinHalf: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  streakTitle: { fontSize: 18, fontWeight: "800", color: "#18181b", marginBottom: 14 },
  streakTitleCompact: {
    fontSize: 13,
    fontWeight: "800",
    color: "#18181b",
    marginBottom: 10,
  },
  streakDotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  streakDotsRowCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 0,
  },
  streakDayCol: { alignItems: "center", gap: 6 },
  streakDayColCompact: { alignItems: "center", gap: 4, flex: 1 },
  streakDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakDotCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakDotDone: { backgroundColor: GREEN_ACCENT, borderColor: GREEN_ACCENT },
  streakDayLabel: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  streakDayLabelCompact: { fontSize: 9, fontWeight: "700", color: "#6B7280" },
  streakMessage: { fontSize: 15, fontWeight: "700", marginTop: 10 },
  streakMessageCompact: { fontSize: 11, fontWeight: "700", marginTop: 8, lineHeight: 14 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#18181b",
    marginBottom: 12,
    marginTop: 4,
  },
  scoreRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  scoreCard: {
    flex: 1,
    backgroundColor: GLASS,
    borderRadius: 22,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  scoreLabel: { fontSize: 14, fontWeight: "700", color: "#374151", textAlign: "center" },
  scoreValue: { fontSize: 36, fontWeight: "800", color: GREEN_ACCENT, marginTop: 4 },
  scoreUpdated: { fontSize: 12, color: "#9CA3AF", marginTop: 4, textAlign: "center" },

  skinHealthCard: {
    backgroundColor: GLASS,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...dashboardCardShadow,
  },
  skinHealthCardCompact: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    overflow: "visible",
  },
  skinHealthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  skinHealthIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  skinHealthIconWrapCompact: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  skinHealthTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: NAVY,
  },
  skinHealthTitleCompact: {
    fontSize: 12,
    letterSpacing: 0.3,
  },

  skinParamsCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...dashboardCardShadow,
  },
  skinParamsCardFlush: {
    marginTop: 0,
  },
  skinParamsCardCompact: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 16,
  },
  skinParamsCardFill: {
    justifyContent: "space-between",
  },
  skinParamsHeaderCompact: {
    marginBottom: 6,
    minHeight: 0,
    justifyContent: "center",
  },
  skinParamsTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: NAVY,
    marginBottom: 8,
  },
  paramMetricsGrid: {
    gap: 8,
  },
  paramMetricsListColumn: {
    gap: 6,
  },
  paramMetricsListColumnFill: {
    flex: 1,
    justifyContent: "space-between",
  },
  paramMetricListCell: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EBE8",
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 3,
  },
  paramMetricListLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#18181b",
    lineHeight: 13,
    textAlign: "center",
  },
  paramMetricListStatus: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  paramMetricListCellFill: {
    flex: 1,
    justifyContent: "center",
  },
  paramMetricsRow: {
    flexDirection: "row",
    gap: 5,
  },
  paramMetricCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 118,
    backgroundColor: "#F5F7F5",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8EBE8",
    gap: 3,
  },
  paramMetricCellCompact: {
    minHeight: 96,
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 10,
    gap: 2,
  },
  paramMetricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#18181b",
    textAlign: "center",
  },
  paramMetricLabelCompact: {
    fontSize: 8,
    lineHeight: 10,
  },
  paramMetricStatus: { fontSize: 13, fontWeight: "700" },
  paramMetricStatusCompact: { fontSize: 10 },
  paramMetricDetail: {
    marginTop: 4,
    fontSize: 9,
    lineHeight: 12,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 4,
  },

  viewAllParamsBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  viewAllParamsBtnCompact: {
    paddingVertical: 9,
    marginTop: 8,
    borderRadius: 10,
  },
  viewAllParamsText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  viewAllParamsTextCompact: { fontSize: 11 },


  journalMergedCard: {
    backgroundColor: GLASS,
    borderRadius: 22,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  journalMergedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  journalSaveHint: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  journalMergedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  journalMergedCopy: { flex: 1, minWidth: 0 },
  journalMergedValue: { fontSize: 22, fontWeight: "800", color: "#18181b", marginTop: 2 },
  journalMergedDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginHorizontal: 8,
  },
  journalStepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  journalStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  journalCard: {
    backgroundColor: GLASS,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...dashboardCardShadow,
  },
  journalCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  journalCardLabel: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  journalCardValue: { fontSize: 28, fontWeight: "800", color: "#18181b", marginTop: 2 },
  journalCardIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  journalEnterBtn: {
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  journalEnterText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  reminderCard: {
    backgroundColor: GLASS,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  reminderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  reminderLabel: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  reminderTime: { fontSize: 22, fontWeight: "800", color: "#18181b", fontVariant: ["tabular-nums"] as any },
  viewTasksBtn: {
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  viewTasksText: { fontSize: 13, fontWeight: "700", color: NAVY },

  h1: { fontSize: 24, fontWeight: "700", textAlign: "center", color: "#18181b" },
  h2: { fontSize: 18, fontWeight: "700", color: "#18181b" },
  sectionCaption: {
    fontSize: 13,
    color: "#71717a",
    marginTop: 6,
    lineHeight: 18,
  },
  editLink: { fontSize: 14, fontWeight: "600", color: NAVY },
  sub: { fontSize: 11, fontWeight: "600", color: "#71717a", marginBottom: 8, textTransform: "uppercase" },
  muted: { fontSize: 13, color: "#71717a", marginBottom: 8 },
  warn: { color: "#b45309", marginBottom: 8 },
  card: {
    backgroundColor: GLASS,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  newBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  newBadgeText: { fontSize: 10, fontWeight: "800", color: "#92400e" },
  voiceBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#7dd3fc",
  },
  voiceBtnText: { fontSize: 14, fontWeight: "700", color: "#0369a1" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  routineRow: { flexDirection: "row", marginTop: 12, gap: 16 },
  routinePending: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#3f3f46",
    fontWeight: "600",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fafafa",
  },
  routineCol: { flex: 1 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: NAVY,
  },
  stepLabel: { fontSize: 14, color: "#27272a", flex: 1 },
  journalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  label: { fontSize: 12, color: "#52525b", marginBottom: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  moodRow: { marginVertical: 10 },
  moodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f4f4f5",
    marginRight: 8,
  },
  moodChipOn: { backgroundColor: NAVY },
  moodChipText: { color: "#3f3f46", fontWeight: "600" },
  moodChipTextOn: { color: "#fff", fontWeight: "600" },
  textArea: {
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    borderRadius: 14,
    padding: 12,
    textAlignVertical: "top",
    fontSize: 15,
    backgroundColor: "#fafafa",
  },
  journalActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btn: { backgroundColor: NAVY, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  btnGhost: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#fff",
  },
  btnGhostText: { color: "#3f3f46", fontWeight: "700", fontSize: 13 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f4f4f5",
    marginRight: 8,
  },
  chipOn: { backgroundColor: DASHBOARD_BG },
  chipText: { color: "#52525b", fontSize: 13 },
  chipTextOn: { color: NAVY, fontWeight: "600", fontSize: 13 },
  skinParamsLegacySection: { marginTop: 16 },
  skinParamsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  skinParamsSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: "#71717a",
  },
  skinParamsLink: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  scanChipRow: {
    paddingVertical: 8,
    paddingRight: 4,
    gap: 8,
  },
  scanChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  scanChipOn: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  scanChipText: { color: "#52525b", fontSize: 13, fontWeight: "600" },
  scanChipTextOn: { color: "#fff", fontSize: 13, fontWeight: "700" },
  skinParamsMeta: {
    fontSize: 12,
    color: "#71717a",
    marginBottom: 4,
  },
  paramGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  paramCell: {
    width: "47%",
    borderRadius: 16,
    padding: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  paramHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
  },
  paramLabel: { fontSize: 13, fontWeight: "700", color: "#18181b", flex: 1, flexShrink: 1 },
  paramScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  paramValCol: { alignItems: "flex-end", flexShrink: 0 },
  paramNum: { fontSize: 12, fontWeight: "700", color: "#3f3f46", fontVariant: ["tabular-nums"] },
  paramDelta: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  deltaUp: { color: "#047857" },
  deltaDown: { color: "#b91c1c" },
  deltaNeutral: { color: "#71717a" },
  barBg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(44, 62, 107, 0.12)",
    marginTop: 10,
    overflow: "hidden",
  },
  barFg: { height: 10, borderRadius: 999, backgroundColor: NAVY },
  paramWeekAvg: { marginTop: 8, fontSize: 11, color: "#71717a" },
  paramWeekAvgVal: { fontWeight: "700", color: "#52525b", fontVariant: ["tabular-nums"] },
  feedback: { marginTop: 8, fontSize: 15, color: "#3f3f46", lineHeight: 22 },
  feedbackEmpty: { minHeight: 100, borderWidth: 1, borderStyle: "dashed", borderColor: "#e4e4e7", borderRadius: 14, marginTop: 8 },
  voicePlaceholder: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    fontSize: 14,
    color: "#78350f",
    lineHeight: 20,
  },
});
