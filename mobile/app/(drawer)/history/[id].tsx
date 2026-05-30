import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { SkinScanReportBodyNative } from "@/components/SkinScanReportBodyNative";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { dismissUnreadReadyScan } from "@/lib/scanJobNotifications";
import type { PatientTrackerReport } from "@/lib/patientTrackerReport.types";
import type { ScanSpatialOutputs } from "@/lib/spatialOutputs";

type ScanDetail = {
  scanId: number;
  userName: string;
  userEmail: string | null;
  userAge: number;
  userSkinType: string;
  scanTitle: string | null;
  imageUrl: string;
  faceCaptureGallery?: Array<{ label: string; imageUrl: string }>;
  regions: { issue: string; coordinates: { x: number; y: number } }[];
  metrics: {
    acne: number;
    hydration: number;
    wrinkles: number;
    overall_score: number;
    pigmentation: number;
    texture: number;
    clinical_scores?: {
      active_acne?: number;
      skin_quality?: number;
      wrinkle_severity?: number;
      wrinkle_cls_severity?: number;
      wrinkle_seg_severity?: number;
      sagging_volume?: number;
      under_eye?: number;
      hair_health?: number;
      pigmentation_model?: number | null;
    };
  };
  aiSummary: string | null;
  scanDateIso: string;
  annotatedImageUrl?: string;
  wrinkleMaskDataUri?: string;
  acneMaskDataUri?: string;
  spatialOutputs?: ScanSpatialOutputs;
  /** Frozen at scan time in `scans.tracker_snapshot` — no LLM on reload. */
  trackerReport?: PatientTrackerReport | null;
};

/** Always open the list — `router.back()` is wrong when this screen was opened from Scan (or elsewhere). */
const TREATMENT_HISTORY_HREF = "/(drawer)/history" as Href;
const DASHBOARD_HREF = "/(drawer)" as Href;

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [row, setRow] = useState<ScanDetail | null>(null);
  const [tracker, setTracker] = useState<PatientTrackerReport | null>(null);
  /** When false, `tracker === null` may still mean "loading" — don't show the legacy donut fallback yet. */
  const [trackerSettled, setTrackerSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanId = Number(id);
    if (Number.isFinite(scanId) && scanId > 0) {
      void dismissUnreadReadyScan(scanId);
    }
  }, [id]);

  useEffect(() => {
    if (!token || !id) {
      setRow(null);
      setTracker(null);
      setTrackerSettled(false);
      return;
    }

    let alive = true;
    setRow(null);
    setTracker(null);
    setTrackerSettled(false);
    setError(null);

    void (async () => {
      try {
        const json = await apiJson<ScanDetail>(
          `/api/patient/scans/${encodeURIComponent(id)}`,
          token,
          { method: "GET" }
        );
        if (!alive) return;
        setRow(json);
        if (json.trackerReport) {
          setTracker(json.trackerReport);
        } else {
          try {
            const tr = await apiJson<PatientTrackerReport>(
              `/api/patient/tracker?scanId=${encodeURIComponent(id)}`,
              token,
              { method: "GET" }
            );
            if (!alive) return;
            setTracker(tr);
          } catch {
            if (alive) setTracker(null);
          }
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof ApiError ? e.message : "Could not load scan.");
          setRow(null);
          setTracker(null);
        }
      } finally {
        if (alive) setTrackerSettled(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, id]);

  const routeScanId = useMemo(() => {
    const n = Number.parseInt(String(id ?? ""), 10);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  /** Avoid one frame (or slow fetch) showing the previous scan when `id` changes. */
  const reportMatchesRoute =
    row !== null && routeScanId !== null && row.scanId === routeScanId;

  const reportReady = reportMatchesRoute && trackerSettled;

  if (error && !row) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{error}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace(TREATMENT_HISTORY_HREF)}>
          <Text style={styles.backBtnText}>Back to treatment history</Text>
        </Pressable>
      </View>
    );
  }

  if (!reportReady) {
    if (routeScanId === null) {
      return (
        <View style={styles.center}>
          <Text style={styles.err}>Invalid scan link.</Text>
          <Pressable style={styles.backBtn} onPress={() => router.replace(TREATMENT_HISTORY_HREF)}>
            <Text style={styles.backBtnText}>Back to treatment history</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading report…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.topBar, { paddingTop: Math.max(8, insets.top) }]}>
        <Pressable
          style={styles.navLink}
          onPress={() => router.replace(TREATMENT_HISTORY_HREF)}
          hitSlop={8}
          accessibilityLabel="Treatment history"
        >
          <Ionicons name="chevron-back" size={20} color={NAVY} />
          <Text style={styles.navLabel}>Treatment history</Text>
        </Pressable>
        <Pressable
          style={styles.navLink}
          onPress={() => router.replace(DASHBOARD_HREF)}
          hitSlop={8}
          accessibilityLabel="Dashboard"
        >
          <Ionicons name="home-outline" size={18} color={NAVY} />
          <Text style={styles.navLabel}>Dashboard</Text>
        </Pressable>
      </View>
      <SkinScanReportBodyNative
        key={String(id)}
        userName={row.userName}
        userAge={row.userAge}
        userSkinType={row.userSkinType}
        scanTitle={row.scanTitle}
        imageUrl={row.imageUrl}
        authToken={token}
        faceCaptureGallery={row.faceCaptureGallery}
        annotatedOverlayUri={row.annotatedImageUrl}
        wrinkleMaskUri={row.wrinkleMaskDataUri}
        acneMaskUri={row.acneMaskDataUri}
        spatialOutputs={row.spatialOutputs}
        regions={row.regions}
        metrics={row.metrics}
        aiSummary={row.aiSummary}
        scanDate={new Date(row.scanDateIso)}
        tracker={tracker}
      />
    </View>
  );
}

const BG = "#E8EFE6";
const NAVY = "#2C3E6B";

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG,
    padding: 24,
    gap: 12,
  },
  loadingText: { fontSize: 15, fontWeight: "600", color: "#6B7280" },
  err: { color: "#b91c1c", textAlign: "center", marginBottom: 16 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  backBtnText: { color: NAVY, fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 20,
    backgroundColor: BG,
  },
  navLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  navLabel: { fontSize: 14, fontWeight: "700", color: NAVY },
});
