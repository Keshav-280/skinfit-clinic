import { Audio } from "expo-av";
import { format, addDays, subDays, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { analysisResultsToParams } from "@/lib/skinAnalysis";
import { normalizeRoutineSteps, routineStepsProgress } from "@/lib/routine";
import { useEndOfDayCountdown } from "@/lib/useEndOfDayCountdown";

const TEAL = "#6B8E8E";
const MINT = "#E0F0ED";
const CARD = "#ffffff";

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
  lifestyleAlignmentScore: number;
  routineScore: number;
  weeklyChangePercent: number;
  doctorFeedback: string;
  homeDateYmd?: string;
  streakCurrent: number;
  streakLongest: number;
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
  /** False after onboarding until clinician saves AM/PM step list. */
  routinePlanReady?: boolean;
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
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedScanIdx, setSelectedScanIdx] = useState(0);
  const [routine, setRoutine] = useState({ am: [] as boolean[], pm: [] as boolean[] });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const routineHasSteps = (d: HomeData | null) =>
    Boolean(
      d?.onboardingComplete &&
        d.routinePlanReady &&
        (d.amItems?.length ?? 0) > 0 &&
        (d.pmItems?.length ?? 0) > 0
    );
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
  const [dietType, setDietType] = useState<string>("balanced");
  const [sunExposure, setSunExposure] = useState<string>("low");
  const [cycleDay, setCycleDay] = useState("");
  const [doctorReply, setDoctorReply] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [showArchivedVoices, setShowArchivedVoices] = useState(false);
  const [voiceBusyId, setVoiceBusyId] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    if (!token) return;
    setError(null);
    const json = await apiJson<HomeData>(`/api/patient/home`, token, {
      method: "GET",
    });
    setData({
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
    });
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
  }, [token]);

  const patchVoiceNote = useCallback(
    async (id: string, body: { listened?: boolean; archived?: boolean }) => {
      if (!token) return;
      setVoiceBusyId(id);
      try {
        await apiJson(`/api/patient/voice-notes/${id}`, token, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        await loadHome();
      } catch {
        /* ignore */
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
      setJournalLoading(true);
      setJournalHint(null);
      try {
        const res = await apiJson<{ entry: Record<string, unknown> | null }>(
          `/api/journal?date=${encodeURIComponent(ymd)}`,
          token,
          { method: "GET" }
        );
        const entry = res.entry;
        if (entry) {
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
          setSleep("0");
          setStress("5");
          setWater("0");
          setJournalText("");
          setMood("Neutral");
          setAmRoutine(false);
          setPmRoutine(false);
          setDietType("balanced");
          setSunExposure("low");
          setCycleDay("");
        }
      } catch {
        setJournalHint("Could not load journal for that day.");
      } finally {
        setJournalLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void loadJournalForDate(journalDate);
  }, [journalDate, loadJournalForDate]);

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
    const current = analysisResultsToParams(selectedScan?.analysisResults ?? null);
    const prevScan =
      selectedScanIdx < skinScanHistory.length - 1
        ? skinScanHistory[selectedScanIdx + 1]
        : null;
    const prevMap = new Map(
      analysisResultsToParams(prevScan?.analysisResults ?? null).map((p) => [p.label, p.value])
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
      const rows = analysisResultsToParams(s.analysisResults ?? null);
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

  const routineProgress = useMemo(
    () => routineStepsProgress(routine.am, routine.pm),
    [routine.am, routine.pm]
  );

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
          sleepHours: Number.parseInt(sleep, 10) || 0,
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
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await loadHome();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      <Text style={styles.h1}>Dashboard</Text>

      <View style={styles.gauges}>
        <Gauge label="kAI Skin Score" value={kaiSkinScore} />
        <GaugeDelta label="Weekly Δ" delta={data.weeklyDeltaScore} />
        <Gauge label="Lifestyle alignment" value={data.lifestyleAlignmentScore} />
      </View>

      {data.homeDateYmd ? (
        <View style={[styles.card, { marginTop: 14, paddingVertical: 10 }]}>
          <Text style={[styles.muted, { marginBottom: 0 }]}>Day: {data.homeDateYmd}</Text>
        </View>
      ) : null}

      <View style={styles.streakRow}>
        <Text style={styles.streakText}>
          Streak: <Text style={styles.streakNum}>{data.streakCurrent}</Text> day
          {data.streakCurrent === 1 ? "" : "s"} · Best {data.streakLongest}d
        </Text>
      </View>

      <DayQuestBannerMobile
        routineProgress={routineProgress}
        questSubtext={
          data.onboardingComplete && !routineHasSteps(data)
            ? "Your customised daily plan will be given by the clinic soon."
            : null
        }
      />

      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.h2}>AM / PM routine</Text>
            <CountdownPillMobile />
          </View>
          <Text style={styles.muted}>{format(new Date(), "dd/MM/yy")}</Text>
        </View>
        {data.onboardingComplete === false ? (
          <Text style={styles.routinePending}>
            Finish onboarding first. Your clinician will then set your AM/PM steps.
          </Text>
        ) : !routineHasSteps(data) ? (
          <Text style={styles.routinePending}>
            Your customised daily plan will be given by the clinic soon.
          </Text>
        ) : (
          <View style={styles.routineRow}>
            <View style={styles.routineCol}>
              <Text style={styles.sub}>AM</Text>
              {data.amItems.map((item, i) => (
                <Pressable
                  key={`am-${i}-${item}`}
                  style={styles.stepRow}
                  onPress={() => toggleAm(i)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      routine.am[i] ? { backgroundColor: TEAL, borderColor: TEAL } : null,
                    ]}
                  />
                  <Text style={styles.stepLabel}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.routineCol}>
              <Text style={styles.sub}>PM</Text>
              {data.pmItems.map((item, i) => (
                <Pressable
                  key={`pm-${i}-${item}`}
                  style={styles.stepRow}
                  onPress={() => togglePm(i)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      routine.pm[i] ? { backgroundColor: TEAL, borderColor: TEAL } : null,
                    ]}
                  />
                  <Text style={styles.stepLabel}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={{ marginTop: 20, marginBottom: 8, gap: 8 }}>
        <Text style={styles.h2}>Daily journal</Text>
        <CountdownPillMobile />
      </View>
      <View style={styles.card}>
        <Text style={styles.muted}>
          {journalDate === todayStr ? "Today" : format(parseISO(`${journalDate}T12:00:00`), "MMM d, yyyy")}
          {journalLoading ? " · Loading…" : ""}
        </Text>
        {journalDate === todayStr ? <JournalTodayStripMobile /> : null}
        {journalHint ? <Text style={styles.warn}>{journalHint}</Text> : null}
        <View style={styles.journalGrid}>
          <Field label="Sleep (h)" value={sleep} onChangeText={setSleep} />
          <Field label="Stress (1–10)" value={stress} onChangeText={setStress} />
          <Field label="Water" value={water} onChangeText={setWater} />
        </View>
        <Text style={styles.label}>Mood</Text>
        <Text style={styles.label}>Diet</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
          {DIETS.map((d) => (
            <Pressable
              key={d}
              onPress={() => setDietType(d)}
              style={[styles.moodChip, dietType === d && styles.moodChipOn]}
            >
              <Text style={dietType === d ? styles.moodChipTextOn : styles.moodChipText}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>Sun exposure</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
          {SUNS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSunExposure(s)}
              style={[styles.moodChip, sunExposure === s && styles.moodChipOn]}
            >
              <Text style={sunExposure === s ? styles.moodChipTextOn : styles.moodChipText}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {data.cycleTrackingEnabled ? (
          <>
            <Text style={styles.label}>Cycle day (optional)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="1–35"
              value={cycleDay}
              onChangeText={setCycleDay}
              placeholderTextColor="#94a3b8"
            />
          </>
        ) : null}
        <Text style={styles.label}>Mood</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
          {MOODS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMood(m)}
              style={[styles.moodChip, mood === m && styles.moodChipOn]}
            >
              <Text style={mood === m ? styles.moodChipTextOn : styles.moodChipText}>{m}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="How is your skin feeling today?"
          value={journalText}
          onChangeText={setJournalText}
          placeholderTextColor="#94a3b8"
        />
        <View style={styles.journalActions}>
          <Pressable style={styles.btn} onPress={saveJournal} disabled={journalSaving}>
            <Text style={styles.btnText}>{journalSaving ? "Saving…" : "Save entry"}</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() =>
              setJournalDate(format(subDays(parseISO(`${journalDate}T12:00:00`), 1), "yyyy-MM-dd"))
            }
          >
            <Text style={styles.btnText}>Previous day</Text>
          </Pressable>
          {journalDate < todayStr ? (
            <Pressable
              style={styles.btn}
              onPress={() => {
                const d = addDays(parseISO(`${journalDate}T12:00:00`), 1);
                const cap = parseISO(`${todayStr}T12:00:00`);
                setJournalDate(format(d > cap ? cap : d, "yyyy-MM-dd"));
              }}
            >
              <Text style={styles.btnText}>Next day</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>Skin parameters</Text>
        </View>
        {skinScanHistory.length > 1 ? (
          <ScrollView horizontal style={{ marginBottom: 8 }}>
            {skinScanHistory.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedScanIdx(i)}
                style={[styles.chip, selectedScanIdx === i && styles.chipOn]}
              >
                <Text style={selectedScanIdx === i ? styles.chipTextOn : styles.chipText}>
                  {format(new Date(s.createdAt), "MMM d")} · {s.skinScore}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Text style={styles.muted}>
          {selectedScan
            ? `Scan: ${format(new Date(selectedScan.createdAt), "dd/MM/yy")}`
            : "No scans yet — sample targets"}
        </Text>
        <View style={styles.paramGrid}>
          {params.map((p) => (
            <View key={p.label} style={[styles.paramCell, { backgroundColor: MINT }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.paramLabel}>{p.label}</Text>
                <View style={{ alignItems: "flex-end" }}>
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
                <View style={[styles.barFg, { width: `${p.value}%` }]} />
              </View>
              <Text style={styles.paramWeekAvg}>
                Prev week avg: {p.prevWeekAvg == null ? "—" : `${p.prevWeekAvg}/100`}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16, marginBottom: 32 }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>Doctor&apos;s feedback</Text>
          {data.doctorVoiceNoteIsNew ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>New</Text>
            </View>
          ) : null}
        </View>
        {(data.doctorVoiceNotes?.length ?? 0) > 0 ? (
          <View style={{ gap: 14 }}>
            {data.doctorVoiceNotes!.map((vn) => (
              <View
                key={vn.id}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#bae6fd",
                  backgroundColor: "rgba(224, 242, 254, 0.5)",
                  padding: 12,
                }}
              >
                <Text style={{ fontSize: 12, color: "#0369a1", marginBottom: 8 }}>
                  {format(parseISO(vn.createdAt), "dd/MM/yy · h:mm a")}
                </Text>
                <DoctorVoiceNotePlayer uri={vn.audioDataUri} />
                <Pressable
                  style={styles.stepRow}
                  disabled={voiceBusyId === vn.id}
                  onPress={() =>
                    void patchVoiceNote(vn.id, { listened: !vn.listened })
                  }
                >
                  <View
                    style={[
                      styles.checkbox,
                      vn.listened ? { backgroundColor: TEAL, borderColor: TEAL } : null,
                    ]}
                  />
                  <Text style={styles.stepLabel}>I listened</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.btnGhost,
                    { marginTop: 8, opacity: vn.listened && voiceBusyId !== vn.id ? 1 : 0.45 },
                  ]}
                  disabled={!vn.listened || voiceBusyId === vn.id}
                  onPress={() => void patchVoiceNote(vn.id, { archived: true })}
                >
                  <Text style={styles.btnGhostText}>Archive</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : data.onboardingComplete === false ? (
          <Text style={styles.voicePlaceholder}>
            Your doctor will send a voice note after reviewing your baseline. The bell will
            update when it arrives.
          </Text>
        ) : null}
        {(data.doctorArchivedVoiceNotes?.length ?? 0) > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Pressable onPress={() => setShowArchivedVoices((v) => !v)}>
              <Text style={styles.editLink}>
                {showArchivedVoices ? "Hide" : "Show"} archived voice notes (
                {data.doctorArchivedVoiceNotes!.length})
              </Text>
            </Pressable>
            {showArchivedVoices
              ? data.doctorArchivedVoiceNotes!.map((vn) => (
                  <View
                    key={vn.id}
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#e4e4e7",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <Text style={styles.muted}>
                      {format(parseISO(vn.createdAt), "dd/MM/yy")}
                    </Text>
                    <DoctorVoiceNotePlayer uri={vn.audioDataUri} />
                  </View>
                ))
              : null}
          </View>
        ) : null}
        {data.doctorFeedback?.trim() ? (
          <Text style={styles.feedback}>{data.doctorFeedback}</Text>
        ) : (data.doctorVoiceNotes?.length ?? 0) === 0 ? (
          <View style={styles.feedbackEmpty} />
        ) : null}
        <Text style={[styles.label, { marginTop: 12 }]}>Reply to your doctor</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Message (posts to doctor chat)"
          value={doctorReply}
          onChangeText={setDoctorReply}
          placeholderTextColor="#94a3b8"
        />
        <Pressable
          style={[styles.btn, { marginTop: 8, opacity: replyBusy ? 0.6 : 1 }]}
          disabled={replyBusy || !doctorReply.trim()}
          onPress={async () => {
            if (!token || !doctorReply.trim()) return;
            setReplyBusy(true);
            try {
              await apiJson(`/api/chat/plain/message`, token, {
                method: "POST",
                body: JSON.stringify({
                  assistantId: "doctor",
                  text: doctorReply.trim(),
                }),
              });
              setDoctorReply("");
            } catch {
              setJournalHint("Could not send reply.");
            } finally {
              setReplyBusy(false);
            }
          }}
        >
          <Text style={styles.btnText}>{replyBusy ? "Sending…" : "Send reply"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function DayQuestBannerMobile({
  routineProgress,
  questSubtext,
}: {
  routineProgress: number;
  questSubtext?: string | null;
}) {
  const cd = useEndOfDayCountdown();
  const p = Math.min(1, Math.max(0, routineProgress));
  const percent = Math.round(p * 100);
  return (
    <View
      style={[
        styles.card,
        styles.questCard,
        cd.isLastHour && styles.questCardUrgent,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      accessibilityLabel={`AM and PM routine: ${percent} percent of steps completed today`}
    >
      <Text style={styles.questKicker}>{"Today's quest"}</Text>
      <Text style={styles.questTitle}>
        {questSubtext?.trim()
          ? questSubtext.trim()
          : "Lock in routine & journal before the day resets"}
      </Text>
      <Text style={styles.questSub}>
        Counts until <Text style={styles.questBold}>11:59:59 PM</Text> local time
      </Text>
      <View style={styles.questBarBg}>
        <View style={[styles.questBarFg, { width: `${p * 100}%` }]} />
      </View>
      <Text
        style={styles.questTimer}
        accessibilityRole="text"
        accessibilityLabel={`Time remaining until end of day: ${cd.formatted}`}
      >
        {cd.formatted}
      </Text>
      <Text style={styles.questHint}>Time left today</Text>
      {cd.isLastHour ? (
        <Text style={styles.questFinal}>Final hour — finish strong</Text>
      ) : null}
    </View>
  );
}

function CountdownPillMobile() {
  const cd = useEndOfDayCountdown();
  return (
    <View
      style={[styles.countPill, cd.isLastHour && styles.countPillUrgent]}
      accessibilityRole="text"
      accessibilityLabel={`Time left today until 11:59 PM: ${cd.formatted}`}
    >
      <Text style={styles.countPillText}>
        <Text style={styles.countPillMono}>{cd.formatted}</Text>
      </Text>
    </View>
  );
}

function JournalTodayStripMobile() {
  const cd = useEndOfDayCountdown();
  return (
    <View
      style={[styles.journalStrip, cd.isLastHour && styles.journalStripUrgent]}
      accessibilityRole="text"
    >
      <Text style={styles.journalStripLeft}>
        Closes at <Text style={styles.questBold}>11:59:59 PM</Text>
      </Text>
      <Text style={[styles.journalStripRight, cd.isLastHour && { color: "#b45309" }]}>
        {cd.formatted} left
      </Text>
    </View>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <View style={styles.gauge}>
      <Text style={styles.gaugeVal}>{v}%</Text>
      <Text style={styles.gaugeLbl}>{label}</Text>
    </View>
  );
}

function GaugeDelta({ label, delta }: { label: string; delta: number }) {
  const d = Math.round(delta);
  const sign = d > 0 ? "+" : "";
  return (
    <View style={styles.gauge}>
      <Text style={styles.gaugeVal}>
        {sign}
        {d}
      </Text>
      <Text style={styles.gaugeLbl}>{label}</Text>
    </View>
  );
}

function DoctorVoiceNotePlayer({
  uri,
  onPlayStart,
}: {
  uri: string;
  onPlayStart?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      style={styles.voiceBtn}
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await onPlayStart?.();
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
          const { sound } = await Audio.Sound.createAsync({ uri });
          await sound.playAsync();
          sound.setOnPlaybackStatusUpdate((st) => {
            if (st.isLoaded && st.didJustFinish) void sound.unloadAsync();
          });
        } catch {
          /* ignore */
        } finally {
          setBusy(false);
        }
      }}
    >
      <Text style={styles.voiceBtnText}>{busy ? "…" : "Play voice note"}</Text>
    </Pressable>
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

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fdf9f0" },
  err: { color: "#b91c1c", padding: 16 },
  h1: { fontSize: 24, fontWeight: "700", textAlign: "center", color: "#18181b" },
  h2: { fontSize: 18, fontWeight: "700", color: "#18181b" },
  sub: { fontSize: 11, fontWeight: "600", color: "#71717a", marginBottom: 8, textTransform: "uppercase" },
  muted: { fontSize: 13, color: "#71717a", marginBottom: 8 },
  warn: { color: "#b45309", marginBottom: 8 },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gauges: { flexDirection: "row", justifyContent: "space-around", marginTop: 16 },
  gauge: { alignItems: "center" },
  gaugeVal: { fontSize: 22, fontWeight: "700", color: "#18181b" },
  gaugeLbl: { fontSize: 11, color: "#52525b", marginTop: 4, textAlign: "center", maxWidth: 100 },
  streakRow: { marginTop: 10, alignItems: "center" },
  streakText: { fontSize: 13, color: "#52525b", fontWeight: "600" },
  streakNum: { color: TEAL, fontWeight: "800" },
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
    borderColor: TEAL,
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
  moodChipOn: { backgroundColor: TEAL },
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
  btn: { backgroundColor: TEAL, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
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
  chipOn: { backgroundColor: "#ccfbf1" },
  chipText: { color: "#52525b", fontSize: 13 },
  chipTextOn: { color: "#0f766e", fontWeight: "600", fontSize: 13 },
  paramGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  paramCell: { width: "47%", borderRadius: 16, padding: 12 },
  paramLabel: { fontSize: 14, fontWeight: "600", color: "#27272a" },
  paramNum: { fontSize: 12, color: "#52525b" },
  paramDelta: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  deltaUp: { color: "#047857" },
  deltaDown: { color: "#b91c1c" },
  deltaNeutral: { color: "#71717a" },
  barBg: { height: 8, borderRadius: 4, backgroundColor: "rgba(107,142,142,0.25)", marginTop: 8, overflow: "hidden" },
  barFg: { height: 8, borderRadius: 4, backgroundColor: TEAL },
  paramWeekAvg: { marginTop: 6, fontSize: 11, color: "#71717a", fontVariant: ["tabular-nums"] },
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
  questCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.45)",
    backgroundColor: "#fffbeb",
  },
  questCardUrgent: { borderColor: "rgba(245, 158, 11, 0.7)" },
  questKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#92400e",
    marginBottom: 6,
  },
  questTitle: { fontSize: 16, fontWeight: "700", color: "#18181b", marginBottom: 4 },
  questSub: { fontSize: 12, color: "#52525b", marginBottom: 10 },
  questBold: { fontWeight: "800", color: "#27272a" },
  questBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(107,142,142,0.2)",
    overflow: "hidden",
    marginBottom: 10,
  },
  questBarFg: { height: 8, borderRadius: 4, backgroundColor: TEAL },
  questTimer: {
    fontSize: 28,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    color: "#18181b",
    textAlign: "center",
  },
  questHint: { fontSize: 11, fontWeight: "600", color: "#71717a", textAlign: "center", marginTop: 2 },
  questFinal: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
    textAlign: "center",
  },
  countPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(224, 240, 237, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(107,142,142,0.35)",
  },
  countPillUrgent: { backgroundColor: "#fff7ed", borderColor: "rgba(245, 158, 11, 0.5)" },
  countPillText: { fontSize: 12, fontWeight: "600", color: "#134e4a" },
  countPillMono: { fontVariant: ["tabular-nums"], fontWeight: "800" },
  journalStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(224, 240, 237, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(107,142,142,0.25)",
  },
  journalStripUrgent: { backgroundColor: "#fffbeb", borderColor: "rgba(245, 158, 11, 0.35)" },
  journalStripLeft: { fontSize: 13, fontWeight: "600", color: "#134e4a", flex: 1, minWidth: 140 },
  journalStripRight: {
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    color: TEAL,
  },
});
