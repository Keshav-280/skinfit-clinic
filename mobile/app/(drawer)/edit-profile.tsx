import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { apiUrl } from "@/lib/apiBase";
import {
  NAVY,
  BG_GRADIENT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  TEXT_LIGHT,
  BORDER_LIGHT,
  card,
} from "@/components/profile/theme";

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

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
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
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { user } = await apiJson<{ user: ProfileUser }>("/api/user/profile", token, { method: "GET" });
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
          user: { id: data.user.id, name: data.user.name, email: data.user.email },
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

  if (loading) {
    return (
      <LinearGradient colors={BG_GRADIENT} style={s.loadingCenter}>
        <ActivityIndicator size="large" color={NAVY} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={BG_GRADIENT} style={{ flex: 1 }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.backBtn} onPress={() => router.push("/(drawer)/profile" as any)}>
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {savedBanner ? (
          <View style={s.savedBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#064e3b" />
            <Text style={s.savedBannerText}>Profile saved successfully</Text>
          </View>
        ) : null}
        {error ? (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#991b1b" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Your Details */}
        <View style={card.base}>
          <View style={s.sectionHeaderRow}>
            <View style={[s.sectionIcon, { backgroundColor: "#ede9fe" }]}>
              <Ionicons name="person-outline" size={20} color={NAVY} />
            </View>
            <View>
              <Text style={s.sectionTitle}>Your Details</Text>
              <Text style={s.sectionSub}>Appears on treatment history and reports</Text>
            </View>
          </View>
          <L label="Full name" value={name} onChangeText={setName} />
          <L label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <L label="Country code" value={phoneCountryCode} onChangeText={setPhoneCountryCode} />
          <L label="National number *" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ""))} keyboardType="phone-pad" />
          <Text style={s.fieldHint}>Country code defaults to +91. Enter at least 10 digits.</Text>
          <L label="Age (years)" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="e.g. 28" />
          <Text style={s.lab}>Gender</Text>
          <View style={s.genderRow}>
            {(["female", "male", "other", "prefer_not_say"] as const).map((val) => {
              const label = val === "prefer_not_say" ? "Prefer not to say" : val.charAt(0).toUpperCase() + val.slice(1);
              return (
                <Pressable
                  key={val}
                  style={[s.genderChip, gender === val && s.genderChipActive]}
                  onPress={() => { setGender(val); if (val !== "female") setCycleTrackingEnabled(false); }}
                >
                  <Text style={[s.genderChipText, gender === val && s.genderChipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <L label="Skin type" value={skinType} onChangeText={setSkinType} placeholder="e.g. Dry, Combination, Oily" />
          <L label="Primary goal" value={primaryGoal} onChangeText={setPrimaryGoal} placeholder="e.g. Acne reduction, Hydration" />
          {gender === "female" ? (
            <View style={s.switchRow}>
              <Text style={s.lab}>Track menstrual cycle day in journal</Text>
              <Switch
                value={cycleTrackingEnabled}
                onValueChange={setCycleTrackingEnabled}
                trackColor={{ false: "#d4d4d8", true: "rgba(43,58,103,0.3)" }}
                thumbColor={cycleTrackingEnabled ? NAVY : "#f4f4f5"}
              />
            </View>
          ) : null}
        </View>

        {/* Visit Reminders */}
        <View style={card.base}>
          <View style={s.sectionHeaderRow}>
            <View style={[s.sectionIcon, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="notifications-outline" size={20} color="#92400e" />
            </View>
            <View>
              <Text style={s.sectionTitle}>Visit Reminders</Text>
              <Text style={s.sectionSub}>Get notified before each confirmed appointment</Text>
            </View>
          </View>
          <L label="Remind me how many hours before?" value={reminderHours} onChangeText={setReminderHours} keyboardType="number-pad" />
        </View>

        {/* Daily Routine Reminders */}
        <View style={card.base}>
          <View style={s.sectionHeaderRow}>
            <View style={[s.sectionIcon, { backgroundColor: "#dbeafe" }]}>
              <Ionicons name="alarm-outline" size={20} color="#1d4ed8" />
            </View>
            <View>
              <Text style={s.sectionTitle}>Daily Routine Reminders</Text>
              <Text style={s.sectionSub}>AM / PM checklist nudges via Clinic Support</Text>
            </View>
          </View>
          <View style={s.switchRow}>
            <Text style={s.lab}>Enable AM / PM routine reminders</Text>
            <Switch
              value={routineRemindersEnabled}
              onValueChange={setRoutineRemindersEnabled}
              trackColor={{ false: "#d4d4d8", true: "rgba(43,58,103,0.3)" }}
              thumbColor={routineRemindersEnabled ? NAVY : "#f4f4f5"}
            />
          </View>
          <L label="Timezone (IANA)" value={timezone} onChangeText={setTimezone} placeholder="e.g. Asia/Kolkata" />
          <Pressable
            style={s.tzBtn}
            onPress={() => { try { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* ignore */ } }}
          >
            <Text style={s.tzBtnText}>Use this device&apos;s timezone</Text>
          </Pressable>
          <L label="Morning reminder" value={routineAmHm} onChangeText={setRoutineAmHm} autoCapitalize="none" placeholder="HH:mm (24h)" editable={routineRemindersEnabled} />
          <L label="Evening reminder" value={routinePmHm} onChangeText={setRoutinePmHm} autoCapitalize="none" placeholder="HH:mm (24h)" editable={routineRemindersEnabled} />
        </View>

        {/* Change Password */}
        <View style={card.base}>
          <View style={s.sectionHeaderRow}>
            <View style={[s.sectionIcon, { backgroundColor: "#fee2e2" }]}>
              <Ionicons name="lock-closed-outline" size={20} color="#991b1b" />
            </View>
            <View>
              <Text style={s.sectionTitle}>Change Password</Text>
              <Text style={s.sectionSub}>Leave blank to keep current password</Text>
            </View>
          </View>
          <L label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secure />
          <L label="New password" value={newPassword} onChangeText={setNewPassword} secure />
          <L label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secure />
        </View>

        {/* Save */}
        <Pressable style={[s.saveBtn, saving && s.saveBtnDis]} onPress={onSave} disabled={saving}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={s.saveBtnText}>{saving ? "Saving…" : "Save Profile"}</Text>
        </Pressable>

        {WEB_PORTAL_URL ? (
          <Pressable style={s.webPortalBtn} onPress={() => void Linking.openURL(WEB_PORTAL_URL)}>
            <Ionicons name="globe-outline" size={18} color={NAVY} />
            <Text style={s.webPortalBtnText}>Open web portal</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={s.outBtn}
          onPress={() => {
            Alert.alert("Sign out", "You will need to sign in again.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: async () => { await signOut(); router.replace("/login"); } },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={s.outBtnText}>Sign out</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

function L({
  label, value, onChangeText, secure, autoCapitalize = "sentences", keyboardType, placeholder, editable = true,
}: {
  label: string; value: string; onChangeText: (s: string) => void; secure?: boolean;
  autoCapitalize?: "none" | "sentences"; keyboardType?: "default" | "number-pad" | "phone-pad" | "email-address";
  placeholder?: string; editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.lab}>{label}</Text>
      <TextInput
        style={[s.input, !editable && s.inputDisabled]}
        value={value} onChangeText={onChangeText} secureTextEntry={secure}
        autoCapitalize={autoCapitalize} keyboardType={keyboardType ?? "default"}
        placeholder={placeholder} placeholderTextColor={TEXT_LIGHT} editable={editable}
      />
    </View>
  );
}

const s = StyleSheet.create({
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: TEXT_PRIMARY },

  savedBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14 },
  savedBannerText: { color: "#064e3b", fontSize: 14, fontWeight: "600" },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14 },
  errorText: { color: "#991b1b", fontSize: 14, flex: 1 },

  sectionHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#e8f5e9", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: TEXT_PRIMARY },
  sectionSub: { marginTop: 2, fontSize: 13, color: TEXT_MUTED, lineHeight: 18 },

  lab: { fontSize: 13, color: TEXT_MUTED, marginBottom: 4, fontWeight: "500" },
  fieldHint: { fontSize: 12, color: TEXT_LIGHT, marginTop: -6, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: BORDER_LIGHT, borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: "#fff", color: TEXT_PRIMARY },
  inputDisabled: { opacity: 0.55, backgroundColor: "#f4f4f5" },

  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  genderChip: { borderWidth: 1, borderColor: BORDER_LIGHT, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff" },
  genderChipActive: { borderColor: NAVY, backgroundColor: "rgba(43,58,103,0.08)" },
  genderChipText: { color: TEXT_MUTED, fontSize: 13, fontWeight: "600" },
  genderChipTextActive: { color: NAVY },

  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 },
  tzBtn: { marginBottom: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, backgroundColor: "#f8fafc", alignSelf: "flex-start" },
  tzBtnText: { fontSize: 14, fontWeight: "600", color: NAVY },

  saveBtn: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: NAVY, paddingVertical: 15, borderRadius: 999 },
  saveBtnDis: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  webPortalBtn: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER_LIGHT },
  webPortalBtnText: { color: NAVY, fontWeight: "700", fontSize: 15 },
  outBtn: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: "#fecaca", backgroundColor: "#fff" },
  outBtnText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
});
