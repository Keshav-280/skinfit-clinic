import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { buildScanReportPdfPayload } from "@/lib/buildScanReportPdfPayload";
import { resolveAuthenticatedScanImageSource } from "@/lib/resolveScanImage";
import { shareScanReportPdf } from "@/lib/scanReportPdf";
import type { PatientTrackerReport } from "../../../../src/lib/patientTrackerReport.types";

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
      sagging_volume?: number;
      under_eye?: number;
      hair_health?: number;
      pigmentation_model?: number | null;
    };
  };
  aiSummary: string | null;
  scanDateIso: string;
  annotatedImageUrl?: string;
};

/** Always open the list — `router.back()` is wrong when this screen was opened from Scan (or elsewhere). */
const TREATMENT_HISTORY_HREF = "/(drawer)/history" as Href;

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [row, setRow] = useState<ScanDetail | null>(null);
  const [tracker, setTracker] = useState<PatientTrackerReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    const json = await apiJson<ScanDetail>(
      `/api/patient/scans/${encodeURIComponent(id)}`,
      token,
      { method: "GET" }
    );
    setRow(json);
    try {
      const tr = await apiJson<PatientTrackerReport>(
        `/api/patient/tracker?scanId=${encodeURIComponent(id)}`,
        token,
        { method: "GET" }
      );
      setTracker(tr);
    } catch {
      setTracker(null);
    }
  }, [token, id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (alive) {
          setError(e instanceof ApiError ? e.message : "Could not load scan.");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const onDownloadPdf = useCallback(async () => {
    if (!row) return;
    setPdfLoading(true);
    try {
      const payload = await buildScanReportPdfPayload(
        {
          userName: row.userName,
          userAge: row.userAge,
          userSkinType: row.userSkinType,
          scanTitle: row.scanTitle,
          imageUrl: row.imageUrl,
          faceCaptureGallery: row.faceCaptureGallery,
          regions: row.regions,
          metrics: row.metrics,
          aiSummary: row.aiSummary,
          scanDateIso: row.scanDateIso,
          annotatedImageUrl: row.annotatedImageUrl,
        },
        token
      );
      await shareScanReportPdf(payload);
    } catch (e) {
      Alert.alert(
        "PDF",
        e instanceof Error ? e.message : "Could not create or share the PDF."
      );
    } finally {
      setPdfLoading(false);
    }
  }, [row, token]);

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

  if (!row) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.topBar, { paddingTop: Math.max(8, insets.top) }]}>
        <Pressable
          style={styles.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          hitSlop={12}
          accessibilityLabel="Open menu"
        >
          <Ionicons name="menu" size={26} color="#18181b" />
        </Pressable>
        <Pressable
          style={styles.backRow}
          onPress={() => router.replace(TREATMENT_HISTORY_HREF)}
          hitSlop={12}
          accessibilityLabel="Back to treatment history"
        >
          <Text style={styles.backChev}>‹</Text>
          <Text style={styles.backLabel}>Back to treatment history</Text>
        </Pressable>
      </View>
      <SkinScanReportBodyNative
        userName={row.userName}
        userAge={row.userAge}
        userSkinType={row.userSkinType}
        scanTitle={row.scanTitle}
        imageSource={resolveAuthenticatedScanImageSource(row.imageUrl, token)}
        annotatedOverlayUri={row.annotatedImageUrl}
        regions={row.regions}
        metrics={row.metrics}
        aiSummary={row.aiSummary}
        scanDate={new Date(row.scanDateIso)}
        pdfLoading={pdfLoading}
        onDownloadPdf={() => void onDownloadPdf()}
        tracker={tracker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fdf9f0" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fdf9f0",
    padding: 24,
  },
  err: { color: "#b91c1c", textAlign: "center", marginBottom: 16 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  backBtnText: { color: "#0d9488", fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 4,
  },
  menuBtn: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  backChev: { fontSize: 28, color: "#27272a", marginTop: -2 },
  backLabel: { fontSize: 15, fontWeight: "600", color: "#27272a" },
});
