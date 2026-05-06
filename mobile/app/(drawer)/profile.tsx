import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { ComponentProps } from "react";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { router } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { apiUrl } from "@/lib/apiBase";

const WEB_PORTAL_URL =
  process.env.EXPO_PUBLIC_WEB_PORTAL_URL?.replace(/\/$/, "") ??
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "";

const REMINDER_HOURS_MAX = 168;
const REMINDER_DEFAULT = 24;

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  phoneCountryCode: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  skinType: string | null;
  primaryGoal: string | null;
  appointmentReminderHoursBefore: number;
  timezone: string;
  routineRemindersEnabled: boolean;
  routineAmReminderHm: string;
  routinePmReminderHm: string;
  cycleTrackingEnabled?: boolean;
};

type SkinProfilePayload = {
  skinDna: {
    skinType: string | null;
    primaryConcern: string | null;
    sensitivityIndex: number | null;
    uvSensitivity: string | null;
    hormonalCorrelation: string | null;
  };
  lastWeekObservations: string | null;
  priorityKnowDo: { know: string[]; do: string[] };
  sparklines: Record<string, { values: (number | null)[]; sources: string[] }>;
  paramLabels: Record<string, string>;
  visits: Array<{
    id: string;
    visitDate: string;
    doctorName: string;
    purpose: string | null;
    treatments: string | null;
    notes: string;
    responseRating: string | null;
  }>;
};

type SkinIdentitySignals = {
  skinType?: string;
  primaryConcern?: string;
  sensitivityIndex?: string;
  uvSensitivity?: string;
  hormonalCorrelation?: string;
};

type SkinIdentityPayload = {
  user: { name: string; email: string };
  timeline: {
    initial: {
      asOfDate: string;
      skinType: string | null;
      primaryConcern: string | null;
      sensitivityIndex: number | null;
      uvSensitivity: string | null;
      hormonalCorrelation: string | null;
      signals: SkinIdentitySignals;
      dataDepth: { scansConsidered: number; logsConsidered: number };
    };
    current: {
      asOfDate: string;
      skinType: string | null;
      primaryConcern: string | null;
      sensitivityIndex: number | null;
      uvSensitivity: string | null;
      hormonalCorrelation: string | null;
      signals: SkinIdentitySignals;
      dataDepth: { scansConsidered: number; logsConsidered: number };
    };
    changed: Array<{ field: string; from: string | number | null; to: string | number | null }>;
  };
};

type MonthlyInsightPayload = {
  locked: boolean;
  nextInsightAt: string;
  latestMonthStart: string | null;
  monthly: {
    summaryTitle: string;
    summaryBody: string;
    highlights: string[];
    risks: string[];
    nextMonthFocus: string[];
    kaiMonthAvgFromParams: number | null;
    detail?: unknown;
  } | null;
};

const SAGE = "#6B8E8E";
const DNA_BORDER = "#eee7dc";
const DNA_MUTED = "#e8e2d8";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMonthlyInsightHtml(
  monthly: NonNullable<MonthlyInsightPayload["monthly"]>
): string {
  const items = (arr: string[], ordered: boolean) => {
    const tag = ordered ? "ol" : "ul";
    const inner = arr.map((x) => `<li>${escHtml(x)}</li>`).join("");
    return `<${tag}>${inner}</${tag}>`;
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:20px;color:#18181b;line-height:1.5}
h1{font-size:18px;font-weight:700}
.kai{font-size:32px;font-weight:800;color:#4338ca;margin:12px 0}
p.body{white-space:pre-wrap}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin-top:16px;color:#52525b}
</style></head><body>
<h1>${escHtml(monthly.summaryTitle)}</h1>
<p class="body">${escHtml(monthly.summaryBody)}</p>
<p class="kai">Month kAI: ${monthly.kaiMonthAvgFromParams ?? "—"}</p>
<h2>Highlights</h2>${items((monthly.highlights ?? []).slice(0, 8), false)}
<h2>Risks</h2>${items((monthly.risks ?? []).slice(0, 8), false)}
<h2>Next focus</h2>${items((monthly.nextMonthFocus ?? []).slice(0, 8), true)}
</body></html>`;
}

function fmtIdent(
  v: string | number | null,
  format?: (v: string | number) => string
) {
  if (v == null || (typeof v === "string" && !v.trim())) return "—";
  return format ? format(v) : String(v);
}

function DnaStatRn({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dnaStatCell}>
      <Text style={styles.dnaStatLabel}>{label}</Text>
      <Text style={styles.dnaStatValue}>{value}</Text>
    </View>
  );
}

function MetricTileRn({
  label,
  pendingOnly,
  values,
}: {
  label: string;
  pendingOnly: boolean;
  values: (number | null)[];
}) {
  const latest = values[0];
  const hasScore = !pendingOnly && latest != null && Number.isFinite(latest);
  const n = hasScore ? Math.round(latest as number) : null;
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricTileLabel}>{label}</Text>
      {pendingOnly || n == null ? (
        <Text style={styles.metricPending}>In-clinic measurement</Text>
      ) : (
        <>
          <Text style={styles.metricScore}>{n}</Text>
          <View style={styles.metricBarTrack}>
            <View style={[styles.metricBarFill, { width: `${Math.min(100, Math.max(0, n))}%` }]} />
          </View>
        </>
      )}
    </View>
  );
}

function EvolvingFieldRn({
  label,
  initial,
  current,
  rationale,
  icon,
  format,
}: {
  label: string;
  initial: string | number | null;
  current: string | number | null;
  rationale: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  format?: (v: string | number) => string;
}) {
  const changed = initial !== current;
  return (
    <View style={styles.evoField}>
      <View style={styles.evoFieldTop}>
        <View style={styles.evoIconWrap}>
          <Ionicons name={icon} size={16} color="#5b21b6" />
        </View>
        <Text style={styles.evoLabel}>{label}</Text>
        <Text style={[styles.evoBadge, changed ? styles.evoBadgeOn : styles.evoBadgeOff]}>
          {changed ? "Evolved" : "Stable"}
        </Text>
      </View>
      <View style={styles.evoValues}>
        <View>
          <Text style={styles.evoSub}>Initial</Text>
          <Text style={styles.evoVal}>{fmtIdent(initial, format)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        <View>
          <Text style={styles.evoSubNow}>Now</Text>
          <Text style={styles.evoValNow}>{fmtIdent(current, format)}</Text>
        </View>
      </View>
      <Text style={styles.evoWhy}>
        <Text style={styles.evoWhyBold}>why: </Text>
        {rationale}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { token, applySessionFromProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [skinType, setSkinType] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [reminderHours, setReminderHours] = useState(String(REMINDER_DEFAULT));
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [routineRemindersEnabled, setRoutineRemindersEnabled] = useState(true);
  const [routineAmHm, setRoutineAmHm] = useState("08:30");
  const [routinePmHm, setRoutinePmHm] = useState("22:00");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skinExtra, setSkinExtra] = useState<SkinProfilePayload | null>(null);
  const [skinIdentity, setSkinIdentity] = useState<SkinIdentityPayload | null>(null);
  const [monthlyInsight, setMonthlyInsight] = useState<MonthlyInsightPayload | null>(null);
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [profileRes, skin, identity, monthly] = await Promise.all([
        apiJson<{ user: ProfileUser }>("/api/user/profile", token, {
          method: "GET",
        }),
        apiJson<SkinProfilePayload>("/api/patient/skin-profile", token, {
          method: "GET",
        }).catch(() => null),
        apiJson<SkinIdentityPayload>("/api/patient/skin-identity", token, {
          method: "GET",
        }).catch(() => null),
        apiJson<MonthlyInsightPayload>("/api/patient/monthly-insight", token, {
          method: "GET",
        }).catch(() => null),
      ]);
      const { user } = profileRes;
      setName(user.name);
      setEmail(user.email);
      setPhoneCountryCode(user.phoneCountryCode ?? "+91");
      setPhone(user.phone ?? "");
      setAge(user.age != null ? String(user.age) : "");
      setGender(user.gender ?? "");
      setSkinType(user.skinType ?? "");
      setPrimaryGoal(user.primaryGoal ?? "");
      setReminderHours(String(user.appointmentReminderHoursBefore ?? REMINDER_DEFAULT));
      setTimezone(user.timezone ?? "Asia/Kolkata");
      setRoutineRemindersEnabled(user.routineRemindersEnabled ?? true);
      setRoutineAmHm(user.routineAmReminderHm ?? "08:30");
      setRoutinePmHm(user.routinePmReminderHm ?? "22:00");
      setCycleTrackingEnabled(
        user.gender === "female" ? (user.cycleTrackingEnabled ?? false) : false
      );
      setSkinExtra(skin);
      setSkinIdentity(identity);
      setMonthlyInsight(monthly);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onSave() {
    if (!token) return;
    setError(null);
    setSavedBanner(false);
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Enter at least 10 digits for your phone number.");
      return;
    }
    if (newPassword || currentPassword) {
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
    }
    const rh = Number.parseInt(reminderHours.trim(), 10);
    if (!Number.isFinite(rh) || rh < 0 || rh > REMINDER_HOURS_MAX) {
      setError(`Reminder must be 0 (off) or 1–${REMINDER_HOURS_MAX} hours before a visit.`);
      return;
    }
    const ageTrim = age.trim();
    let ageVal: number | null = null;
    if (ageTrim !== "") {
      const n = Number.parseInt(ageTrim, 10);
      if (!Number.isFinite(n) || n < 1 || n > 120) {
        setError("Age must be 1–120 or blank.");
        return;
      }
      ageVal = n;
    }

    setSaving(true);
    try {
      const hmOk = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!hmOk.test(routineAmHm.trim()) || !hmOk.test(routinePmHm.trim())) {
        setError("Routine reminder times must be HH:mm (24h), e.g. 08:30 and 22:00.");
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        phoneCountryCode: phoneCountryCode.trim() || "+91",
        phone: phone.trim(),
        gender: gender || null,
        skinType: skinType.trim() || null,
        primaryGoal: primaryGoal.trim() || null,
        age: ageVal,
        appointmentReminderHoursBefore: rh,
        timezone: timezone.trim() || "Asia/Kolkata",
        routineRemindersEnabled,
        routineAmReminderHm: routineAmHm.trim(),
        routinePmReminderHm: routinePmHm.trim(),
        cycleTrackingEnabled: gender === "female" ? cycleTrackingEnabled : false,
      };
      if (newPassword || currentPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch(apiUrl("/api/user/profile"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Skinfit-Client": "native",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        token?: string;
        user?: ProfileUser;
      };
      if (!res.ok) {
        throw new Error(data.message || "Could not save.");
      }
      if (data.user) {
        await applySessionFromProfile({
          token: data.token,
          user: {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
          },
        });
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3200);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const exportMonthlyPdf = useCallback(
    async (monthly: NonNullable<MonthlyInsightPayload["monthly"]>) => {
      try {
        const { uri } = await Print.printToFileAsync({
          html: buildMonthlyInsightHtml(monthly),
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Monthly insight",
          });
        } else {
          Alert.alert("PDF", "Sharing is not available on this device.");
        }
      } catch (e) {
        Alert.alert("Export", e instanceof Error ? e.message : "Could not create PDF.");
      }
    },
    []
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your profile</Text>
      <Text style={styles.subWeb}>
        Same account as the mobile app — Skin DNA, visits, and settings stay in sync.
      </Text>
      {savedBanner ? (
        <View style={styles.savedBanner}>
          <Text style={styles.savedBannerText}>Profile saved.</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      {skinExtra ? (
        <View style={styles.cardDnaOuter}>
          <LinearGradient
            colors={["rgba(240,253,250,0.92)", "rgba(255,255,255,0.4)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardDnaHeader}
          >
            <View style={styles.cardDnaHeaderRow}>
              <View style={styles.dnaHeaderIcon}>
                <Ionicons name="color-filter-outline" size={26} color="#115e59" />
              </View>
              <View style={styles.cardDnaHeaderText}>
                <Text style={styles.cardDnaTitle}>Skin DNA snapshot</Text>
                <Text style={styles.cardDnaSubtitle}>
                  A quick read on your skin profile and recent scan parameters.
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.scanReportsBtn}
              onPress={() => router.push("/(drawer)/history")}
            >
              <Text style={styles.scanReportsBtnText}>View scan reports</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </Pressable>
          </LinearGradient>

          <View style={styles.cardDnaBody}>
            <View style={styles.dnaStatsGrid}>
              <DnaStatRn label="Skin type" value={skinExtra.skinDna.skinType ?? "—"} />
              <DnaStatRn
                label="Primary concern"
                value={skinExtra.skinDna.primaryConcern ?? "—"}
              />
              <DnaStatRn
                label="Sensitivity index"
                value={
                  skinExtra.skinDna.sensitivityIndex != null
                    ? `${skinExtra.skinDna.sensitivityIndex}/10`
                    : "—"
                }
              />
              <DnaStatRn
                label="UV sensitivity"
                value={skinExtra.skinDna.uvSensitivity ?? "—"}
              />
              <DnaStatRn
                label="Hormonal correlation"
                value={skinExtra.skinDna.hormonalCorrelation ?? "—"}
              />
            </View>

            {skinExtra.lastWeekObservations ? (
              <View style={styles.lastCheckIn}>
                <Text style={styles.lastCheckInLabel}>Last check-in</Text>
                <Text style={styles.lastCheckInBody}>{skinExtra.lastWeekObservations}</Text>
              </View>
            ) : null}

            <View style={styles.focusBlock}>
              <View style={styles.focusHeadingRow}>
                <Ionicons name="list-outline" size={20} color="#115e59" />
                <Text style={styles.focusHeading}>3 things to focus on</Text>
              </View>
              {skinExtra.priorityKnowDo.do.map((t, i) => (
                <View key={i} style={styles.focusRow}>
                  <View style={styles.focusNum}>
                    <Text style={styles.focusNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.focusText}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.scansBlock}>
              <View style={styles.scansHeadingRow}>
                <Ionicons name="analytics-outline" size={20} color="#115e59" />
                <Text style={styles.scansHeading}>Last scans (up to 4)</Text>
              </View>
              <Text style={styles.scansHint}>Newest scan first · scores when available</Text>
              <View style={styles.metricGrid}>
                {Object.keys(skinExtra.sparklines).map((key) => {
                  const sp = skinExtra.sparklines[key];
                  const label = skinExtra.paramLabels[key] ?? key;
                  const pendingOnly =
                    sp?.sources?.every((s) => s === "pending" || s === "dummy") ?? false;
                  return (
                    <MetricTileRn
                      key={key}
                      label={label}
                      pendingOnly={pendingOnly}
                      values={sp?.values ?? []}
                    />
                  );
                })}
              </View>
            </View>
          </View>

          {skinExtra.visits.length > 0 ? (
            <View style={styles.visitsOuter}>
              <Text style={styles.visitsSectionTitle}>Recent visits</Text>
              <Text style={styles.visitsSectionSub}>Notes from your clinic appointments.</Text>
              {skinExtra.visits.slice(0, 5).map((v) => (
                <View key={v.id} style={styles.visitCard}>
                  <Text style={styles.visitDate}>
                    {v.visitDate} · {v.doctorName}
                  </Text>
                  {v.purpose ? <Text style={styles.visitBody}>Purpose: {v.purpose}</Text> : null}
                  {v.treatments ? (
                    <Text style={styles.visitBody}>Treatments: {v.treatments}</Text>
                  ) : null}
                  <Text style={styles.visitBody} numberOfLines={4}>
                    {v.notes}
                  </Text>
                  {v.responseRating ? (
                    <Text style={styles.visitRating}>Response: {v.responseRating}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {skinIdentity ? (
        <View style={styles.identitySection}>
          <View style={styles.identityTopRow}>
            <View style={styles.identityHeaderLeft}>
              <View style={styles.identityIconWrap}>
                <Ionicons name="color-filter-outline" size={22} color="#5b21b6" />
              </View>
              <View>
                <Text style={styles.identityKicker}>Skin identity card · time-aware</Text>
                <Text style={styles.identityNameTitle}>
                  {skinIdentity.user.name}&apos;s skin DNA
                </Text>
                <Text style={styles.identityMeta}>
                  Initial analysis {skinIdentity.timeline.initial.asOfDate} → current{" "}
                  {skinIdentity.timeline.current.asOfDate} ·{" "}
                  {skinIdentity.timeline.current.dataDepth.scansConsidered} scans ·{" "}
                  {skinIdentity.timeline.current.dataDepth.logsConsidered} logs
                </Text>
              </View>
            </View>
            <Text style={styles.identityEvolvedPill}>
              {skinIdentity.timeline.changed.length} field
              {skinIdentity.timeline.changed.length !== 1 ? "s" : ""} evolved
            </Text>
          </View>
          <View style={styles.evoGrid}>
            <EvolvingFieldRn
              label="Skin type"
              initial={skinIdentity.timeline.initial.skinType}
              current={skinIdentity.timeline.current.skinType}
              rationale={skinIdentity.timeline.current.signals.skinType ?? "—"}
              icon="color-filter-outline"
            />
            <EvolvingFieldRn
              label="Primary concern"
              initial={skinIdentity.timeline.initial.primaryConcern}
              current={skinIdentity.timeline.current.primaryConcern}
              rationale={skinIdentity.timeline.current.signals.primaryConcern ?? "—"}
              icon="locate-outline"
            />
            <EvolvingFieldRn
              label="Sensitivity index"
              initial={skinIdentity.timeline.initial.sensitivityIndex}
              current={skinIdentity.timeline.current.sensitivityIndex}
              rationale={skinIdentity.timeline.current.signals.sensitivityIndex ?? "—"}
              icon="water-outline"
              format={(v) => `${v}/10`}
            />
            <EvolvingFieldRn
              label="UV sensitivity"
              initial={skinIdentity.timeline.initial.uvSensitivity}
              current={skinIdentity.timeline.current.uvSensitivity}
              rationale={skinIdentity.timeline.current.signals.uvSensitivity ?? "—"}
              icon="sunny-outline"
            />
            <EvolvingFieldRn
              label="Hormonal correlation"
              initial={skinIdentity.timeline.initial.hormonalCorrelation}
              current={skinIdentity.timeline.current.hormonalCorrelation}
              rationale={skinIdentity.timeline.current.signals.hormonalCorrelation ?? "—"}
              icon="pulse-outline"
            />
          </View>
          {skinIdentity.timeline.changed.length > 0 ? (
            <View style={styles.changedBox}>
              <Text style={styles.changedTitle}>What changed since initial analysis</Text>
              {skinIdentity.timeline.changed.map((c, i) => (
                <View key={i} style={styles.changedRow}>
                  <Text style={styles.changedField}>{c.field}:</Text>
                  <Text style={styles.changedFrom}>{String(c.from ?? "—")}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                  <Text style={styles.changedTo}>{String(c.to ?? "—")}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {monthlyInsight ? (
        <View style={styles.monthlySection}>
          <LinearGradient
            colors={["rgba(224,231,255,0.85)", "rgba(255,255,255,0.5)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.monthlyHeader}
          >
            <View style={styles.monthlyHeaderRow}>
              <View style={styles.monthlyIconWrap}>
                <Ionicons name="book-outline" size={26} color="#4338ca" />
              </View>
              <View style={styles.monthlyHeaderText}>
                <Text style={styles.monthlyTitle}>Monthly insight</Text>
                <Text style={styles.monthlySubtitle}>
                  Cron-based monthly summary. Unlocks after the scheduled monthly run.
                </Text>
              </View>
            </View>
            <Pressable
              style={[
                styles.monthlyPdfBtn,
                (!monthlyInsight.monthly || monthlyInsight.locked) && styles.monthlyPdfBtnDis,
              ]}
              disabled={!monthlyInsight.monthly || monthlyInsight.locked}
              onPress={() => {
                if (monthlyInsight.monthly && !monthlyInsight.locked) {
                  void exportMonthlyPdf(monthlyInsight.monthly);
                }
              }}
            >
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.monthlyPdfBtnText}>Monthly PDF</Text>
            </Pressable>
          </LinearGradient>
          <View style={styles.monthlyBodyPad}>
            <Text style={styles.monthlyCronHint}>
              Next cron window: {new Date(monthlyInsight.nextInsightAt).toLocaleString()}
            </Text>
            {monthlyInsight.locked || !monthlyInsight.monthly ? (
              <View style={styles.monthlyLockedCard}>
                <View style={styles.monthlyLockedRow}>
                  <Ionicons name="lock-closed-outline" size={18} color="#4338ca" />
                  <Text style={styles.monthlyLockedTitle}>Locked until next monthly run</Text>
                </View>
                <Text style={styles.monthlyLockedBody}>
                  Next insight on{" "}
                  <Text style={styles.monthlyLockedEm}>
                    {new Date(monthlyInsight.nextInsightAt).toLocaleString()}
                  </Text>{" "}
                  (cron).
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.monthlyKaiRow}>
                  <View style={styles.monthlyKaiCard}>
                    <Text style={styles.monthlyKaiLabel}>Month kAI</Text>
                    <Text style={styles.monthlyKaiBig}>
                      {monthlyInsight.monthly.kaiMonthAvgFromParams ?? "—"}
                    </Text>
                    <Text style={styles.monthlyKaiCaption}>
                      Weighted month score from mean of 8 parameters.
                    </Text>
                  </View>
                  <View style={styles.monthlySummaryCard}>
                    <Text style={styles.monthlySummaryLabel}>
                      {monthlyInsight.monthly.summaryTitle}
                    </Text>
                    <Text style={styles.monthlySummaryBody}>
                      {monthlyInsight.monthly.summaryBody}
                    </Text>
                  </View>
                </View>
                <View style={styles.monthlyCols}>
                  <View style={[styles.monthlyColCard, styles.monthlyColEmerald]}>
                    <Text style={styles.monthlyColTitleEmerald}>Highlights</Text>
                    {(monthlyInsight.monthly.highlights ?? []).slice(0, 4).map((x, i) => (
                      <Text key={i} style={styles.monthlyBullet}>
                        • {x}
                      </Text>
                    ))}
                  </View>
                  <View style={[styles.monthlyColCard, styles.monthlyColRose]}>
                    <Text style={styles.monthlyColTitleRose}>Risks</Text>
                    {(monthlyInsight.monthly.risks ?? []).slice(0, 4).map((x, i) => (
                      <Text key={i} style={styles.monthlyBullet}>
                        • {x}
                      </Text>
                    ))}
                  </View>
                  <View style={[styles.monthlyColCard, styles.monthlyColViolet]}>
                    <Text style={styles.monthlyColTitleViolet}>Next focus</Text>
                    {(monthlyInsight.monthly.nextMonthFocus ?? []).slice(0, 4).map((x, i) => (
                      <Text key={i} style={styles.monthlyBulletNum}>
                        {i + 1}. {x}
                      </Text>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>Your details</Text>
        <Text style={styles.formCardDesc}>
          This information appears on your treatment history and reports.
        </Text>
        <L label="Full name" value={name} onChangeText={setName} />
        <L
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <L label="Country code" value={phoneCountryCode} onChangeText={setPhoneCountryCode} />
        <L
          label="National number *"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
          keyboardType="phone-pad"
        />
        <Text style={styles.fieldHint}>
          Country code defaults to +91. Enter at least 10 digits for your number.
        </Text>
        <L
          label="Age (years)"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          placeholder="e.g. 28"
        />
        <Text style={styles.lab}>Gender</Text>
        <View style={styles.genderRow}>
          {[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
            { value: "other", label: "Other" },
            { value: "prefer_not_say", label: "Prefer not to say" },
          ].map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.genderChip,
                gender === opt.value ? styles.genderChipActive : null,
              ]}
              onPress={() => {
                setGender(opt.value);
                if (opt.value !== "female") setCycleTrackingEnabled(false);
              }}
            >
              <Text
                style={[
                  styles.genderChipText,
                  gender === opt.value ? styles.genderChipTextActive : null,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <L
          label="Skin type"
          value={skinType}
          onChangeText={setSkinType}
          placeholder="e.g. Dry, Combination, Oily"
        />
        <L
          label="Primary goal"
          value={primaryGoal}
          onChangeText={setPrimaryGoal}
          placeholder="e.g. Acne reduction, Hydration"
        />
        {gender === "female" ? (
          <View style={styles.switchRow}>
            <Text style={styles.lab}>Track menstrual cycle day in journal</Text>
            <Switch
              value={cycleTrackingEnabled}
              onValueChange={setCycleTrackingEnabled}
              trackColor={{ false: "#d4d4d8", true: "#c5d4d4" }}
              thumbColor={cycleTrackingEnabled ? SAGE : "#f4f4f5"}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>Visit reminders</Text>
        <Text style={styles.formCardDesc}>
          SkinnFit Clinic can send you a message in <Text style={styles.formCardStrong}>Clinic Support</Text>{" "}
          chat before each confirmed appointment.
        </Text>
        <L
          label="Remind me how many hours before the visit?"
          value={reminderHours}
          onChangeText={setReminderHours}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>Daily routine reminders</Text>
        <Text style={styles.formCardDesc}>
          SkinnFit Clinic can message you in <Text style={styles.formCardStrong}>Clinic Support</Text> if your
          AM or PM checklist still has steps left that day. Times use your timezone below.
        </Text>
        <View style={styles.switchRow}>
          <Text style={styles.lab}>Enable AM / PM routine reminders</Text>
          <Switch
            value={routineRemindersEnabled}
            onValueChange={setRoutineRemindersEnabled}
            trackColor={{ false: "#d4d4d8", true: "#c5d4d4" }}
            thumbColor={routineRemindersEnabled ? SAGE : "#f4f4f5"}
          />
        </View>
        <L label="Timezone (IANA)" value={timezone} onChangeText={setTimezone} placeholder="e.g. Asia/Kolkata" />
        <Pressable
          style={styles.tzBtn}
          onPress={() => {
            try {
              setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
            } catch {
              /* ignore */
            }
          }}
        >
          <Text style={styles.tzBtnText}>Use this device</Text>
        </Pressable>
        <L
          label="Morning reminder"
          value={routineAmHm}
          onChangeText={setRoutineAmHm}
          autoCapitalize="none"
          placeholder="HH:mm (24h)"
          editable={routineRemindersEnabled}
        />
        <L
          label="Evening reminder"
          value={routinePmHm}
          onChangeText={setRoutinePmHm}
          autoCapitalize="none"
          placeholder="HH:mm (24h)"
          editable={routineRemindersEnabled}
        />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>Change password</Text>
        <Text style={styles.formCardDesc}>Leave blank to keep your current password.</Text>
        <L
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secure
        />
        <L label="New password" value={newPassword} onChangeText={setNewPassword} secure />
        <L
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secure
        />
      </View>

      <Pressable
        style={[styles.saveBtn, { backgroundColor: SAGE }, saving && styles.saveBtnDis]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save profile"}</Text>
      </Pressable>

      {WEB_PORTAL_URL ? (
        <Pressable
          style={styles.webPortalBtn}
          onPress={() => void Linking.openURL(WEB_PORTAL_URL)}
        >
          <Text style={styles.webPortalBtnText}>Open web portal (same account)</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.outBtn}
        onPress={() => {
          Alert.alert("Sign out", "You will need to sign in again.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign out",
              style: "destructive",
              onPress: async () => {
                await signOut();
                router.replace("/login");
              },
            },
          ]);
        }}
      >
        <Text style={styles.outBtnText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function L({
  label,
  value,
  onChangeText,
  secure,
  autoCapitalize = "sentences",
  keyboardType,
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "number-pad" | "phone-pad" | "email-address";
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.lab}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType ?? "default"}
        placeholder={placeholder}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fdf9f0" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", color: "#18181b" },
  subWeb: {
    textAlign: "center",
    color: "#52525b",
    marginBottom: 16,
    lineHeight: 20,
    fontSize: 14,
    paddingHorizontal: 8,
  },
  savedBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  savedBannerText: { color: "#064e3b", fontSize: 14, fontWeight: "600", textAlign: "center" },
  err: { color: "#b91c1c", marginBottom: 12, textAlign: "center" },
  lab: { fontSize: 13, color: "#52525b", marginBottom: 4, fontWeight: "500" },
  fieldHint: { fontSize: 12, color: "#71717a", marginTop: -6, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#18181b",
  },
  inputDisabled: { opacity: 0.55, backgroundColor: "#f4f4f5" },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f4f4f5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  formCardTitle: { fontSize: 18, fontWeight: "700", color: "#18181b" },
  formCardDesc: { marginTop: 6, fontSize: 14, color: "#71717a", lineHeight: 20 },
  formCardStrong: { fontWeight: "600", color: "#3f3f46" },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: "center",
  },
  saveBtnDis: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  webPortalBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f4f7f7",
    borderWidth: 1,
    borderColor: "rgba(107,142,142,0.35)",
    alignItems: "center",
  },
  webPortalBtnText: { color: "#5a7373", fontWeight: "700", fontSize: 15 },
  outBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#6B8E8E",
    alignItems: "center",
  },
  outBtnText: { color: "#6B8E8E", fontWeight: "700", fontSize: 16 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  genderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  genderChip: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  genderChipActive: {
    borderColor: "#6B8E8E",
    backgroundColor: "#f4f7f7",
  },
  genderChipText: { color: "#3f3f46", fontSize: 12, fontWeight: "600" },
  genderChipTextActive: { color: "#5a7373" },
  tzBtn: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fafafa",
    alignSelf: "flex-start",
  },
  tzBtnText: { fontSize: 14, fontWeight: "600", color: "#3f3f46" },
  cardDnaOuter: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: DNA_BORDER,
    backgroundColor: "#FFFCF7",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  cardDnaHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(231,229,228,0.6)",
  },
  cardDnaHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dnaHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  cardDnaHeaderText: { flex: 1, minWidth: 0 },
  cardDnaTitle: { fontSize: 18, fontWeight: "700", color: "#18181b" },
  cardDnaSubtitle: { marginTop: 4, fontSize: 14, color: "#52525b", lineHeight: 20 },
  scanReportsBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0d9488",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "stretch",
  },
  scanReportsBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardDnaBody: { padding: 16, backgroundColor: "#FFFCF7" },
  dnaStatsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  dnaStatCell: {
    width: "31%",
    flexGrow: 1,
    minWidth: "28%",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: DNA_MUTED,
  },
  dnaStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dnaStatValue: { marginTop: 4, fontSize: 13, fontWeight: "600", color: "#18181b", lineHeight: 18 },
  lastCheckIn: {
    marginTop: 16,
    backgroundColor: "#f5f2ed",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e4ddd4",
  },
  lastCheckInLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#115e59",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lastCheckInBody: { marginTop: 8, fontSize: 14, color: "#3f3f46", lineHeight: 20 },
  focusBlock: { marginTop: 20 },
  focusHeadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  focusHeading: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  focusRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: DNA_MUTED,
  },
  focusNum: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  focusNumText: { fontSize: 14, fontWeight: "700", color: "#134e4a" },
  focusText: { flex: 1, fontSize: 14, color: "#27272a", lineHeight: 20, paddingTop: 4 },
  scansBlock: { marginTop: 20 },
  scansHeadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scansHeading: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  scansHint: { fontSize: 12, color: "#71717a", marginTop: 6, marginBottom: 10 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricTile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: DNA_MUTED,
  },
  metricTileLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricPending: { marginTop: 8, fontSize: 12, color: "#71717a", fontWeight: "500" },
  metricScore: { marginTop: 4, fontSize: 24, fontWeight: "700", color: "#115e59", fontVariant: ["tabular-nums"] },
  metricBarTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e4e4e7",
    overflow: "hidden",
  },
  metricBarFill: { height: 6, borderRadius: 999, backgroundColor: "#0d9488" },
  visitsOuter: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(231,229,228,0.8)",
    backgroundColor: "#faf8f4",
  },
  visitsSectionTitle: { fontSize: 18, fontWeight: "700", color: "#18181b" },
  visitsSectionSub: { marginTop: 4, fontSize: 14, color: "#52525b" },
  visitCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: DNA_MUTED,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  visitDate: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  visitBody: { marginTop: 6, fontSize: 13, color: "#52525b", lineHeight: 18 },
  visitRating: { marginTop: 8, fontSize: 12, fontWeight: "700", color: "#0d9488" },
  identitySection: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    padding: 16,
    backgroundColor: "#faf5ff",
  },
  identityTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  identityHeaderLeft: { flexDirection: "row", gap: 12, flex: 1, minWidth: 0 },
  identityIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  identityKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6d28d9",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  identityNameTitle: { marginTop: 4, fontSize: 18, fontWeight: "700", color: "#0f172a" },
  identityMeta: { marginTop: 6, fontSize: 12, color: "#64748b", lineHeight: 18 },
  identityEvolvedPill: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3730a3",
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  evoGrid: { marginTop: 14, gap: 8 },
  evoField: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  evoFieldTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  evoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  evoLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  evoBadge: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  evoBadgeOn: { backgroundColor: "#e0e7ff", color: "#3730a3" },
  evoBadgeOff: { backgroundColor: "#f1f5f9", color: "#64748b" },
  evoValues: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  evoSub: { fontSize: 9, fontWeight: "600", color: "#64748b", textTransform: "uppercase" },
  evoVal: { fontSize: 14, fontWeight: "600", color: "#475569" },
  evoSubNow: { fontSize: 9, fontWeight: "600", color: "#059669", textTransform: "uppercase" },
  evoValNow: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  evoWhy: { marginTop: 8, fontSize: 11, color: "#64748b", lineHeight: 16 },
  evoWhyBold: { fontWeight: "600", color: "#475569" },
  changedBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "rgba(224,231,255,0.5)",
    padding: 12,
  },
  changedTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3730a3",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  changedRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 },
  changedField: { fontSize: 11, fontWeight: "700", color: "#4338ca" },
  changedFrom: { fontSize: 13, color: "#64748b" },
  changedTo: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  monthlySection: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e7ff",
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  monthlyHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(199,210,254,0.8)",
  },
  monthlyHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  monthlyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  monthlyHeaderText: { flex: 1, minWidth: 0 },
  monthlyTitle: { fontSize: 18, fontWeight: "700", color: "#18181b" },
  monthlySubtitle: { marginTop: 4, fontSize: 14, color: "#52525b", lineHeight: 20 },
  monthlyPdfBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4f46e5",
    paddingVertical: 11,
    borderRadius: 12,
  },
  monthlyPdfBtnDis: { opacity: 0.45 },
  monthlyPdfBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  monthlyBodyPad: { padding: 16 },
  monthlyCronHint: { fontSize: 12, color: "#71717a", marginBottom: 12 },
  monthlyLockedCard: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "#e0e7ff",
    padding: 14,
  },
  monthlyLockedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthlyLockedTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3730a3",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  monthlyLockedBody: { marginTop: 10, fontSize: 14, color: "#3f3f46", lineHeight: 20 },
  monthlyLockedEm: { fontWeight: "700", color: "#18181b" },
  monthlyKaiRow: { flexDirection: "column", gap: 12 },
  monthlyKaiCard: {
    backgroundColor: "rgba(79,70,229,0.95)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#4338ca",
  },
  monthlyKaiLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(224,231,255,0.95)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  monthlyKaiBig: {
    marginTop: 8,
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  monthlyKaiCaption: { marginTop: 8, fontSize: 12, color: "rgba(224,231,255,0.9)", lineHeight: 16 },
  monthlySummaryCard: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: DNA_MUTED,
  },
  monthlySummaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  monthlySummaryBody: { marginTop: 8, fontSize: 14, color: "#27272a", lineHeight: 21 },
  monthlyCols: { marginTop: 12, gap: 10 },
  monthlyColCard: { borderRadius: 12, padding: 14, borderWidth: 1 },
  monthlyColEmerald: { backgroundColor: "rgba(255,255,255,0.98)", borderColor: "#a7f3d0" },
  monthlyColRose: { backgroundColor: "rgba(255,255,255,0.98)", borderColor: "#fecdd3" },
  monthlyColViolet: { backgroundColor: "rgba(255,255,255,0.98)", borderColor: "#ddd6fe" },
  monthlyColTitleEmerald: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  monthlyColTitleRose: {
    fontSize: 11,
    fontWeight: "700",
    color: "#be123c",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  monthlyColTitleViolet: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6d28d9",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  monthlyBullet: { marginTop: 6, fontSize: 14, color: "#3f3f46", lineHeight: 20 },
  monthlyBulletNum: { marginTop: 6, fontSize: 14, color: "#3f3f46", lineHeight: 20 },
});
