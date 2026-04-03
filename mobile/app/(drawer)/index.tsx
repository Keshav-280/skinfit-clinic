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
import { normalizeRoutineSteps } from "@/lib/routine";

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
} | null;

type HomeData = {
  skinScanHistory: SkinScanItem[];
  todayLog: TodayLog;
  amItems: string[];
  pmItems: string[];
  routineScore: number;
  weeklyChangePercent: number;
  doctorFeedback: string;
};

const MOODS = ["Neutral", "Great", "Okay", "Low", "Stressed"] as const;

export default function DashboardScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedScanIdx, setSelectedScanIdx] = useState(0);
  const [routine, setRoutine] = useState({ am: [] as boolean[], pm: [] as boolean[] });

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

  const loadHome = useCallback(async () => {
    if (!token) return;
    setError(null);
    const json = await apiJson<HomeData>(`/api/patient/home`, token, {
      method: "GET",
    });
    setData(json);
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
        } else {
          setSleep("0");
          setStress("5");
          setWater("0");
          setJournalText("");
          setMood("Neutral");
          setAmRoutine(false);
          setPmRoutine(false);
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

  const skinScanHistory = data?.skinScanHistory ?? [];
  const selectedScan =
    skinScanHistory.length > 0
      ? skinScanHistory[Math.min(selectedScanIdx, skinScanHistory.length - 1)]
      : null;
  const latestScan = skinScanHistory[0] ?? null;
  const params = useMemo(
    () => analysisResultsToParams(selectedScan?.analysisResults ?? null),
    [selectedScan?.analysisResults]
  );

  const skinPercent = latestScan
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

  async function saveJournal() {
    if (!token) return;
    setJournalSaving(true);
    setJournalHint(null);
    try {
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
        <Gauge label="Skin Score" value={skinPercent} />
        <Gauge label="Consistency" value={data.routineScore} />
        <Gauge label="Weekly Δ" value={data.weeklyChangePercent} />
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>AM / PM routine</Text>
          <Text style={styles.muted}>{format(new Date(), "dd/MM/yy")}</Text>
        </View>
        <View style={styles.routineRow}>
          <View style={styles.routineCol}>
            <Text style={styles.sub}>AM</Text>
            {data.amItems.map((item, i) => (
              <Pressable key={item} style={styles.stepRow} onPress={() => toggleAm(i)}>
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
              <Pressable key={item} style={styles.stepRow} onPress={() => togglePm(i)}>
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
      </View>

      <Text style={[styles.h2, { marginTop: 20, marginBottom: 8 }]}>Daily journal</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>
          {journalDate === todayStr ? "Today" : format(parseISO(`${journalDate}T12:00:00`), "MMM d, yyyy")}
          {journalLoading ? " · Loading…" : ""}
        </Text>
        {journalHint ? <Text style={styles.warn}>{journalHint}</Text> : null}
        <View style={styles.journalGrid}>
          <Field label="Sleep (h)" value={sleep} onChangeText={setSleep} />
          <Field label="Stress (1–10)" value={stress} onChangeText={setStress} />
          <Field label="Water" value={water} onChangeText={setWater} />
        </View>
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
                <Text style={styles.paramNum}>{Math.round(p.value)}/100</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFg, { width: `${p.value}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16, marginBottom: 32 }]}>
        <Text style={styles.h2}>Doctor&apos;s feedback</Text>
        {data.doctorFeedback?.trim() ? (
          <Text style={styles.feedback}>{data.doctorFeedback}</Text>
        ) : (
          <View style={styles.feedbackEmpty} />
        )}
      </View>
    </ScrollView>
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
  gaugeLbl: { fontSize: 11, color: "#52525b", marginTop: 4, textAlign: "center", maxWidth: 88 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  routineRow: { flexDirection: "row", marginTop: 12, gap: 16 },
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
  barBg: { height: 8, borderRadius: 4, backgroundColor: "rgba(107,142,142,0.25)", marginTop: 8, overflow: "hidden" },
  barFg: { height: 8, borderRadius: 4, backgroundColor: TEAL },
  feedback: { marginTop: 8, fontSize: 15, color: "#3f3f46", lineHeight: 22 },
  feedbackEmpty: { minHeight: 100, borderWidth: 1, borderStyle: "dashed", borderColor: "#e4e4e7", borderRadius: 14, marginTop: 8 },
});
