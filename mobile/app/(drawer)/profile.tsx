import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import FamilyWalletCard from "@/components/profile/FamilyWalletCard";
import PatientProgressTracker from "@/components/profile/PatientProgressTracker";
import type { PatientProgressSnapshot } from "../../../src/lib/patientProgressMilestones";

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

type HomePayload = {
  kaiSkinScore: number;
  progress?: PatientProgressSnapshot;
};

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
  const [homeData, setHomeData] = useState<HomePayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const STALE_MS = 10 * 60 * 1000; // 10 minutes
  const CK_PROFILE = "profile";
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
    const [profileRes, home] = await Promise.all([
      apiJson<{ user: ProfileUser }>("/api/user/profile", token, { method: "GET" }),
      apiJson<HomePayload>("/api/patient/home", token, { method: "GET" }).catch(() => null),
    ]);
    applyProfile(profileRes.user);
    setHomeData(home);

    await Promise.all([
      setCached(CK_PROFILE, profileRes.user),
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
          const [cp, ch, cachedPhoto] = await Promise.all([
            getCached<ProfileUser>(CK_PROFILE),
            getCached<HomePayload>(CK_HOME),
            getCachedPhoto(),
          ]);
          if (cancelled) return;
          if (cp) { applyProfile(cp); setLoading(false); }
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

        {/* 1. Progress checkpoints */}
        {homeData?.progress && !homeData.progress.allComplete ? (
          <PatientProgressTracker {...homeData.progress} />
        ) : null}

        {/* 2. Profile header */}
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

        {/* 3. Family card */}
        <FamilyWalletCard refreshing={refreshing} />

        {!hasRealScoreData ? (
          <View style={styles.emptyCard}>
            <Ionicons name="leaf-outline" size={36} color={NAVY} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>Welcome to SkinFit</Text>
            <Text style={styles.emptyBody}>
              Take your first AI skin scan to unlock weekly reports and personalised insights.
            </Text>
          </View>
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
