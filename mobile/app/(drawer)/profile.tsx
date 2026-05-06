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
      signals: Record<string, string>;
      dataDepth: { scansConsidered: number; logsConsidered: number };
    };
    current: {
      asOfDate: string;
      skinType: string | null;
      primaryConcern: string | null;
      sensitivityIndex: number | null;
      uvSensitivity: string | null;
      hormonalCorrelation: string | null;
      signals: Record<string, string>;
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
  } | null;
};

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
      Alert.alert("Profile", "Saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

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
      <Text style={styles.sub}>Same fields as the web portal.</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}

      {skinExtra ? (
        <View style={styles.dnaCard}>
          <Text style={styles.dnaTitle}>Skin DNA snapshot</Text>
          <Text style={styles.dnaLine}>
            Type: {skinExtra.skinDna.skinType ?? "—"} · Concern:{" "}
            {skinExtra.skinDna.primaryConcern ?? "—"}
          </Text>
          {skinExtra.lastWeekObservations ? (
            <Text style={styles.dnaObs}>{skinExtra.lastWeekObservations}</Text>
          ) : null}
          <Text style={styles.dnaSub}>3 things to do</Text>
          {skinExtra.priorityKnowDo.do.map((t, i) => (
            <Text key={i} style={styles.dnaBullet}>
              {i + 1}. {t}
            </Text>
          ))}
          <Text style={[styles.section, { marginTop: 14 }]}>Last scans (up to 4)</Text>
          {Object.keys(skinExtra.sparklines).map((key) => {
            const sp = skinExtra.sparklines[key];
            const label = skinExtra.paramLabels[key] ?? key;
            const allDummy = sp?.sources?.every((s) => s === "dummy") ?? false;
            return (
              <Text key={key} style={styles.sparkLine}>
                {label}:{" "}
                {(sp?.values ?? []).map((v) => (v == null ? "—" : String(v))).join(" · ")}
                {allDummy ? " (dummy)" : ""}
              </Text>
            );
          })}
        </View>
      ) : null}

      {skinIdentity ? (
        <View style={styles.identityCard}>
          <Text style={styles.identityTitle}>Skin identity card (time-aware)</Text>
          <Text style={styles.identitySub}>
            Initial {skinIdentity.timeline.initial.asOfDate} → now{" "}
            {skinIdentity.timeline.current.asOfDate} ·{" "}
            {skinIdentity.timeline.current.dataDepth.scansConsidered} scans ·{" "}
            {skinIdentity.timeline.current.dataDepth.logsConsidered} logs
          </Text>
          <Text style={styles.identityLine}>
            Skin type: {skinIdentity.timeline.initial.skinType ?? "—"} →{" "}
            {skinIdentity.timeline.current.skinType ?? "—"}
          </Text>
          <Text style={styles.identityLine}>
            Primary concern: {skinIdentity.timeline.initial.primaryConcern ?? "—"} →{" "}
            {skinIdentity.timeline.current.primaryConcern ?? "—"}
          </Text>
          <Text style={styles.identityLine}>
            Sensitivity index: {skinIdentity.timeline.initial.sensitivityIndex ?? "—"} →{" "}
            {skinIdentity.timeline.current.sensitivityIndex ?? "—"}
          </Text>
          <Text style={styles.identityLine}>
            UV sensitivity: {skinIdentity.timeline.initial.uvSensitivity ?? "—"} →{" "}
            {skinIdentity.timeline.current.uvSensitivity ?? "—"}
          </Text>
        </View>
      ) : null}

      {monthlyInsight ? (
        <View style={styles.monthlyCard}>
          <Text style={styles.monthlyTitle}>Monthly insight</Text>
          {monthlyInsight.locked || !monthlyInsight.monthly ? (
            <Text style={styles.monthlyLocked}>
              Locked. Next insight on {new Date(monthlyInsight.nextInsightAt).toLocaleString()}.
            </Text>
          ) : (
            <>
              <Text style={styles.monthlyKai}>
                Month kAI: {monthlyInsight.monthly.kaiMonthAvgFromParams ?? "—"}
              </Text>
              <Text style={styles.monthlySummary}>
                {monthlyInsight.monthly.summaryTitle}
              </Text>
              <Text style={styles.monthlyBody}>{monthlyInsight.monthly.summaryBody}</Text>
            </>
          )}
        </View>
      ) : null}

      {skinExtra && skinExtra.visits.length > 0 ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.section}>Recent visits</Text>
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

      <L label="Name" value={name} onChangeText={setName} />
      <L label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <L label="Country code" value={phoneCountryCode} onChangeText={setPhoneCountryCode} />
      <L label="Phone (national digits)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <L label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
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
      <L label="Skin type" value={skinType} onChangeText={setSkinType} />
      <L label="Primary goal" value={primaryGoal} onChangeText={setPrimaryGoal} />
      {gender === "female" ? (
        <View style={styles.switchRow}>
          <Text style={styles.lab}>Track menstrual cycle day in journal</Text>
          <Switch
            value={cycleTrackingEnabled}
            onValueChange={setCycleTrackingEnabled}
            trackColor={{ false: "#d4d4d8", true: "#99f6e4" }}
            thumbColor={cycleTrackingEnabled ? "#0d9488" : "#f4f4f5"}
          />
        </View>
      ) : null}
      <L
        label={`Visit reminder (hours before, 0=off, max ${REMINDER_HOURS_MAX})`}
        value={reminderHours}
        onChangeText={setReminderHours}
        keyboardType="number-pad"
      />

      <Text style={styles.section}>Daily routine reminders (Clinic Support)</Text>
      <View style={styles.switchRow}>
        <Text style={styles.lab}>Enable AM/PM routine reminders</Text>
        <Switch
          value={routineRemindersEnabled}
          onValueChange={setRoutineRemindersEnabled}
          trackColor={{ false: "#d4d4d8", true: "#99f6e4" }}
          thumbColor={routineRemindersEnabled ? "#0d9488" : "#f4f4f5"}
        />
      </View>
      <L label="Timezone (IANA, e.g. Asia/Kolkata)" value={timezone} onChangeText={setTimezone} />
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
        <Text style={styles.tzBtnText}>Use this device timezone</Text>
      </Pressable>
      <L
        label="Morning reminder (HH:mm 24h)"
        value={routineAmHm}
        onChangeText={setRoutineAmHm}
        autoCapitalize="none"
      />
      <L
        label="Evening reminder (HH:mm 24h)"
        value={routinePmHm}
        onChangeText={setRoutinePmHm}
        autoCapitalize="none"
      />

      <Text style={styles.section}>Change password (optional)</Text>
      <L
        label="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secure
      />
      <L label="New password" value={newPassword} onChangeText={setNewPassword} secure />
      <L label="Confirm new" value={confirmPassword} onChangeText={setConfirmPassword} secure />

      <Pressable style={[styles.saveBtn, saving && styles.saveBtnDis]} onPress={onSave} disabled={saving}>
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
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "number-pad" | "phone-pad";
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.lab}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType ?? "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fdf9f0" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  sub: { textAlign: "center", color: "#52525b", marginBottom: 16 },
  err: { color: "#b91c1c", marginBottom: 12 },
  lab: { fontSize: 13, color: "#52525b", marginBottom: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  section: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  saveBtn: {
    marginTop: 20,
    backgroundColor: "#0d9488",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnDis: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  webPortalBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "rgba(13,148,136,0.35)",
    alignItems: "center",
  },
  webPortalBtnText: { color: "#0f766e", fontWeight: "700", fontSize: 15 },
  outBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#0d9488",
    alignItems: "center",
  },
  outBtnText: { color: "#0d9488", fontWeight: "700", fontSize: 16 },
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
    borderColor: "#0d9488",
    backgroundColor: "#f0fdfa",
  },
  genderChipText: { color: "#3f3f46", fontSize: 12, fontWeight: "600" },
  genderChipTextActive: { color: "#0f766e" },
  tzBtn: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    backgroundColor: "#fafafa",
    alignSelf: "flex-start",
  },
  tzBtnText: { fontSize: 14, fontWeight: "600", color: "#0f766e" },
  dnaCard: {
    backgroundColor: "#ecfeff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(13,148,136,0.25)",
  },
  dnaTitle: { fontSize: 16, fontWeight: "800", color: "#134e4a" },
  dnaLine: { marginTop: 8, fontSize: 14, color: "#0f766e", lineHeight: 20 },
  dnaObs: { marginTop: 10, fontSize: 13, color: "#334155", lineHeight: 20 },
  dnaSub: { marginTop: 12, fontSize: 13, fontWeight: "700", color: "#18181b" },
  dnaBullet: { marginTop: 4, fontSize: 13, color: "#475569" },
  visitCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  visitDate: { fontSize: 13, fontWeight: "800", color: "#18181b" },
  visitBody: { marginTop: 6, fontSize: 13, color: "#52525b", lineHeight: 18 },
  visitRating: { marginTop: 8, fontSize: 12, fontWeight: "700", color: "#0d9488" },
  sparkLine: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  identityCard: {
    backgroundColor: "#f5f3ff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
  },
  identityTitle: { fontSize: 16, fontWeight: "800", color: "#312e81" },
  identitySub: { marginTop: 8, fontSize: 12, color: "#4c1d95", lineHeight: 18 },
  identityLine: { marginTop: 6, fontSize: 13, color: "#3730a3" },
  monthlyCard: {
    backgroundColor: "#eef2ff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
  },
  monthlyTitle: { fontSize: 16, fontWeight: "800", color: "#312e81" },
  monthlyLocked: { marginTop: 8, fontSize: 13, color: "#4338ca" },
  monthlyKai: { marginTop: 8, fontSize: 14, fontWeight: "700", color: "#312e81" },
  monthlySummary: { marginTop: 8, fontSize: 13, fontWeight: "700", color: "#4338ca" },
  monthlyBody: { marginTop: 4, fontSize: 13, color: "#312e81", lineHeight: 18 },
});
