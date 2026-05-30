import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import {
  fetchAndCachePhoto,
  getCachedPhoto,
  pickAndUploadPhoto,
  captureAndUploadPhoto,
} from "@/lib/profilePhoto";
import { getCached, setCached, getCacheAge } from "@/lib/apiCache";

import {
  NAVY,
  BG_GRADIENT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  card,
} from "@/components/profile/theme";
import ProfileHeaderCard from "@/components/profile/ProfileHeaderCard";
import LastTreatmentCard from "@/components/profile/LastTreatmentCard";
import WeeklyReportCard from "@/components/profile/WeeklyReportCard";
import MonthlyReportCard from "@/components/profile/MonthlyReportCard";

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
  keyObservations?: {
    mode: "baseline_only" | "first_week" | "last_7_days";
    modeLabel: string;
    windowStartYmd: string | null;
    windowEndYmd: string | null;
    logDaysUsed: string[];
    scanDaysUsed: string[];
    baselineScanDateYmd: string | null;
    items: Array<{
      text: string;
      source: "baseline_scan" | "daily_logs" | "scan_trend" | "weekly_report";
      dateLabel: string;
    }>;
    narrativeText: string | null;
  };
  priorityKnowDo: { know: string[]; do: string[] };
  insightsSource?: "llm_rag";
  insightsUnavailable?: boolean;
  observationsUnavailable?: boolean;
  actionsUnavailable?: boolean;
  scanCount?: number;
  insightsGeneratedAt?: string | null;
  kaiInsightsEnabled?: boolean;
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

type HomePayload = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  lifestyleAlignmentScore: number;
  kaiInsightsEnabled?: boolean;
};

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
.kai{font-size:32px;font-weight:800;color:${NAVY};margin:12px 0}
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


export default function ProfileScreen() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skinExtra, setSkinExtra] = useState<SkinProfilePayload | null>(null);
  const [monthlyInsight, setMonthlyInsight] = useState<MonthlyInsightPayload | null>(null);
  const [homeData, setHomeData] = useState<HomePayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const STALE_MS = 10 * 60 * 1000; // 10 minutes
  const CK_PROFILE = "profile";
  const CK_SKIN = "skin-profile";
  const CK_MONTHLY = "monthly-insight";
  const CK_HOME = "home";
  const hydrated = useRef(false);
  const prevToken = useRef(token);

  useEffect(() => {
    if (prevToken.current !== token) {
      prevToken.current = token;
      hydrated.current = false;
      setName("");
      setEmail("");
      setAge("");
      setGender("");
      setPhotoUri(null);
      setSkinExtra(null);
      setMonthlyInsight(null);
      setHomeData(null);
      setLoading(true);
    }
  }, [token]);

  const applyProfile = useCallback((user: ProfileUser) => {
    setName(user.name);
    setEmail(user.email);
    setAge(user.age != null ? String(user.age) : "");
    setGender(user.gender ?? "");
  }, []);

  const fetchFresh = useCallback(async () => {
    if (!token) return;
    const [profileRes, skin, monthly, home] = await Promise.all([
      apiJson<{ user: ProfileUser }>("/api/user/profile", token, { method: "GET" }),
      apiJson<SkinProfilePayload>("/api/patient/skin-profile", token, { method: "GET" }).catch(() => null),
      apiJson<MonthlyInsightPayload>("/api/patient/monthly-insight", token, { method: "GET" }).catch(() => null),
      apiJson<HomePayload>("/api/patient/home", token, { method: "GET" }).catch(() => null),
    ]);
    applyProfile(profileRes.user);
    setSkinExtra(skin);
    setMonthlyInsight(monthly);
    setHomeData(home);

    await Promise.all([
      setCached(CK_PROFILE, profileRes.user),
      skin ? setCached(CK_SKIN, skin) : Promise.resolve(),
      monthly ? setCached(CK_MONTHLY, monthly) : Promise.resolve(),
      home ? setCached(CK_HOME, home) : Promise.resolve(),
    ]);
  }, [token, applyProfile]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let cancelled = false;

      (async () => {
        // 1. Restore cached data instantly (only on first mount or if state is empty)
        if (!hydrated.current) {
          const [cp, cs, cm, ch, cachedPhoto] = await Promise.all([
            getCached<ProfileUser>(CK_PROFILE),
            getCached<SkinProfilePayload>(CK_SKIN),
            getCached<MonthlyInsightPayload>(CK_MONTHLY),
            getCached<HomePayload>(CK_HOME),
            getCachedPhoto(),
          ]);
          if (cancelled) return;
          if (cp) { applyProfile(cp); setLoading(false); }
          if (cs) setSkinExtra(cs);
          if (cm) setMonthlyInsight(cm);
          if (ch) setHomeData(ch);
          if (cachedPhoto) setPhotoUri(cachedPhoto);
          hydrated.current = true;
        }

        // 2. Check staleness — skip network if fresh
        const age = await getCacheAge(CK_PROFILE);
        if (age < STALE_MS && hydrated.current && name) {
          setLoading(false);
          return;
        }

        // 3. Fetch fresh in background (no spinner if we already have cached data)
        const showSpinner = !name;
        if (showSpinner) setLoading(true);
        else setRefreshing(true);

        try {
          await fetchFresh();
          if (!cancelled) setError(null);
        } catch (e) {
          if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load profile.");
        } finally {
          if (!cancelled) { setLoading(false); setRefreshing(false); }
        }

        fetchAndCachePhoto(token).then((uri) => { if (!cancelled) setPhotoUri(uri); });
      })();

      return () => { cancelled = true; };
    }, [token, fetchFresh, applyProfile, name])
  );

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

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchFresh(); }
    catch {}
    finally { setRefreshing(false); }
    if (token) fetchAndCachePhoto(token).then((uri) => setPhotoUri(uri));
  }, [fetchFresh, token]);

  function handlePhotoPress() {
    if (!token || uploadingPhoto) return;
    const upload = async (fn: typeof pickAndUploadPhoto) => {
      setUploadingPhoto(true);
      try {
        const result = await fn(token);
        if ("uri" in result) setPhotoUri(result.uri + "?" + Date.now());
        else if (result.error !== "cancelled") Alert.alert("Photo", result.error);
      } finally {
        setUploadingPhoto(false);
      }
    };
    Alert.alert("Profile Photo", "Choose an option", [
      { text: "Take Photo", onPress: () => upload(captureAndUploadPhoto) },
      { text: "Choose from Library", onPress: () => upload(pickAndUploadPhoto) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const hasRealScoreData = homeData != null && homeData.kaiSkinScore > 0;

  const kaiScore = hasRealScoreData
    ? Math.min(100, Math.max(0, Math.round(homeData.kaiSkinScore)))
    : 0;

  const weeklyDelta = hasRealScoreData ? Math.round(homeData.weeklyDeltaScore) : 0;

  const consistency = !hasRealScoreData
    ? "No data"
    : Math.abs(weeklyDelta) <= 3 ? "Good" : Math.abs(weeklyDelta) <= 8 ? "Fair" : "Needs work";

  const keyObs = skinExtra?.keyObservations;
  const weeklyDateRange =
    keyObs?.modeLabel ??
    (() => {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      return `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
    })();

  const observations =
    keyObs?.items?.map((item) => ({
      text: item.text,
      dateLabel: item.dateLabel,
      source: item.source,
    })) ?? [];

  const dataUsedSummary = keyObs
    ? [
        keyObs.logDaysUsed.length > 0
          ? `Daily logs: ${keyObs.logDaysUsed.length} day${keyObs.logDaysUsed.length === 1 ? "" : "s"}`
          : null,
        keyObs.scanDaysUsed.length > 0
          ? `Scans in window: ${keyObs.scanDaysUsed.length}`
          : null,
        keyObs.baselineScanDateYmd
          ? `Baseline: ${new Date(`${keyObs.baselineScanDateYmd}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const priorityActions = skinExtra?.priorityKnowDo?.do?.slice(0, 3) ?? [];

  const kaiInsightsEnabled =
    skinExtra?.kaiInsightsEnabled !== false && homeData?.kaiInsightsEnabled !== false;
  const insightsUnavailable =
    !kaiInsightsEnabled || skinExtra?.insightsUnavailable === true;
  // Per-section flags (server now decouples them); fall back to the combined flag
  // for older backends that don't send the per-section fields.
  const observationsUnavailable =
    !kaiInsightsEnabled ||
    (skinExtra?.observationsUnavailable ?? insightsUnavailable);
  const actionsUnavailable =
    !kaiInsightsEnabled ||
    (skinExtra?.actionsUnavailable ?? insightsUnavailable);

  // Trend numbers (Weekly Change + Consistency) need ≥2 scans to mean anything.
  // With 0–1 scans the delta is always 0 / "No data", which looks broken — hide it.
  const scanCount = skinExtra?.scanCount ?? (hasRealScoreData ? 1 : 0);
  const showTrend = hasRealScoreData && scanCount >= 2;

  const hasWeeklyContent =
    kaiInsightsEnabled &&
    (hasRealScoreData ||
      observations.length > 0 ||
      priorityActions.length > 0 ||
      insightsUnavailable);

  if (loading) {
    return (
      <LinearGradient colors={BG_GRADIENT} style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={NAVY} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={BG_GRADIENT} style={{ flex: 1 }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={NAVY} />
        }
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#991b1b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 1. Profile Header */}
        <ProfileHeaderCard
          name={name}
          age={age}
          gender={gender}
          email={email}
          photoUri={photoUri}
          uploading={uploadingPhoto}
          onEdit={() => router.push("/(drawer)/edit-profile" as any)}
          onPhotoPress={handlePhotoPress}
        />

      

        {/* 3. Last treatment */}
        {skinExtra && skinExtra.visits.length > 0 ? (
          <LastTreatmentCard
            visits={skinExtra.visits}
            onViewAll={() => router.push("/(drawer)/history/visits" as any)}
          />
        ) : null}

        {/* 4. Weekly Report — only when real scan data exists */}
        {hasWeeklyContent ? (
          <WeeklyReportCard
            kaiScore={kaiScore}
            weeklyDelta={weeklyDelta}
            consistency={consistency}
            dateRange={weeklyDateRange}
            showTrend={showTrend}
            observations={observations}
            dataUsedSummary={dataUsedSummary}
            priorityActions={priorityActions}
            observationsUnavailable={observationsUnavailable}
            actionsUnavailable={actionsUnavailable}
          />
        ) : null}

        {/* First-time user nudge when nothing to show */}
        {!hasRealScoreData && !(skinExtra && skinExtra.visits.length > 0) && !monthlyInsight ? (
          <View style={styles.emptyCard}>
            <Ionicons name="leaf-outline" size={36} color={NAVY} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>Welcome to SkinFit</Text>
            <Text style={styles.emptyBody}>
              Take your first AI skin scan to unlock weekly reports and personalised insights.
            </Text>
          </View>
        ) : null}

        {/* 5. Monthly Report */}
        {kaiInsightsEnabled && monthlyInsight ? (
          <MonthlyReportCard
            locked={monthlyInsight.locked}
            nextInsightAt={monthlyInsight.nextInsightAt}
            monthly={monthlyInsight.monthly}
            onExportPdf={exportMonthlyPdf}
          />
        ) : null}



        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  errorText: { color: "#991b1b", fontSize: 14, flex: 1 },

  historyLinkCard: {
    ...card.base,
    marginBottom: 14,
    paddingVertical: 18,
  },
  historyLinkTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  historyLinkSub: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
  },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 28,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 20,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: TEXT_PRIMARY },
  sectionSub: { marginTop: 2, fontSize: 13, color: TEXT_MUTED, lineHeight: 18 },

});
