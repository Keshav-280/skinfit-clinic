import { formatDistanceToNow } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import type { DimensionValue } from "react-native";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ReportContainImage } from "@/components/ReportContainImage";
import { ReportDonut } from "@/components/ReportDonut";
import { ScanMaskAnnotationsNative } from "@/components/ScanMaskAnnotationsNative";
import { DOT_MARKER_LEGEND } from "@/lib/scanMaskLabels";
import { TrackerReportSectionsNative } from "@/components/TrackerReportSectionsNative";
import type { ScanSpatialOutputs } from "@/lib/spatialOutputs";
import type { PatientTrackerReport } from "@/lib/patientTrackerReport.types";
import { patientScanImageDisplayUrl } from "@/lib/patientScanImagePath";
import { fetchAuthenticatedScanImageUri } from "@/lib/fetchAuthenticatedScanImage";
import {
  ACNE_MASK_PANEL_LABEL,
  WRINKLE_MASK_PANEL_LABEL,
} from "@/lib/scanMaskLabels";
import { publicFileDisplayUrl } from "../../src/lib/publicFileUrl";
import { SCAN_REPORT_THEME as T } from "@/lib/scanReportTheme";

const GLASS = "rgba(255,255,255,0.92)";
const GLASS_BORDER = T.cardBorder;

const OVERVIEW_P2 =
  "Maintaining gentle cleansing, daily photoprotection, and targeted hydration supports long-term barrier health and helps preserve the improvements shown in your latest scan.";

const CAUSES_P1 =
  "Environmental factors such as UV exposure, seasonal dryness, and urban pollution can accentuate texture irregularities and uneven tone. A consistent barrier-focused routine helps mitigate these stressors.";

const CAUSES_P2 =
  "Hormonal shifts, stress, and sleep patterns may also influence oil balance and sensitivity. Tracking flare-ups alongside lifestyle changes gives clearer insight into your skin’s triggers.";

export type ReportRegion = {
  issue: string;
  coordinates: { x: number; y: number };
};

export type ReportMetricsNative = {
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

const CLINICAL_ROWS: {
  key: keyof NonNullable<ReportMetricsNative["clinical_scores"]>;
  label: string;
}[] = [
  { key: "active_acne", label: "Active acne" },
  { key: "skin_quality", label: "Skin quality" },
  { key: "wrinkle_severity", label: "Wrinkles (combined 1–5)" },
  { key: "wrinkle_cls_severity", label: "Wrinkles — cls head" },
  { key: "wrinkle_seg_severity", label: "Wrinkles — seg head" },
  { key: "sagging_volume", label: "Sagging & volume" },
  { key: "under_eye", label: "Under-eye" },
  { key: "hair_health", label: "Hair health" },
  { key: "pigmentation_model", label: "Pigmentation (model)" },
];

type Props = {
  userName: string;
  userAge: number;
  userSkinType: string;
  scanTitle: string | null;
  /** Canonical path from API (e.g. `/api/patient/scans/:id/image`). */
  imageUrl: string;
  authToken: string | null;
  faceCaptureGallery?: Array<{ label: string; imageUrl: string }>;
  annotatedOverlayUri?: string | null;
  wrinkleMaskUri?: string | null;
  acneMaskUri?: string | null;
  spatialOutputs?: ScanSpatialOutputs;
  regions: ReportRegion[];
  metrics: ReportMetricsNative;
  aiSummary: string | null;
  scanDate: Date;
  tracker: PatientTrackerReport | null;
};

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function markerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return T.navyDark;
  if (x.includes("wrinkle")) return T.navyMid;
  if (x.includes("pigment")) return T.navyLight;
  if (x.includes("texture")) return T.accent;
  return T.navy;
}

function displayScanTitle(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  const stripped = t
    .replace(/^ai\s*skin\s*scan\s*[–-]\s*/i, "")
    .replace(/^ai\s*skin\s*analysis\s*$/i, "");
  return stripped || null;
}

function clinicalBarWidth(score: number): DimensionValue {
  const pct = Math.min(100, Math.max(0, ((score - 1) / 4) * 100));
  return `${Math.round(pct)}%`;
}

export function SkinScanReportBodyNative({
  userName,
  userAge,
  userSkinType,
  scanTitle,
  imageUrl,
  authToken,
  faceCaptureGallery,
  annotatedOverlayUri: _annotatedOverlayUri = null,
  wrinkleMaskUri = null,
  acneMaskUri = null,
  spatialOutputs,
  regions,
  metrics,
  aiSummary,
  scanDate,
  tracker,
}: Props) {
  const router = useRouter();
  const displayTitle = displayScanTitle(scanTitle);
  const wrinkleMask =
    publicFileDisplayUrl(wrinkleMaskUri) ?? wrinkleMaskUri?.trim() ?? "";
  const acneMask =
    publicFileDisplayUrl(acneMaskUri) ?? acneMaskUri?.trim() ?? "";
  const showMaskSection = wrinkleMask.length > 0 || acneMask.length > 0;
  const showDotMarkersOnly =
    wrinkleMask.length === 0 &&
    acneMask.length === 0 &&
    regions.length > 0 &&
    (imageUrl?.trim().length ?? 0) > 0;

  const [markerImageUri, setMarkerImageUri] = useState<string | null>(null);
  const [markerImageLoading, setMarkerImageLoading] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<
    { label: string; imageUrl: string } | null
  >(null);

  useEffect(() => {
    const path = imageUrl?.trim();
    if (!path || !showDotMarkersOnly) {
      setMarkerImageUri(null);
      setMarkerImageLoading(false);
      return;
    }
    let cancelled = false;
    setMarkerImageLoading(true);
    void fetchAuthenticatedScanImageUri(
      patientScanImageDisplayUrl(path),
      authToken
    )
      .then((uri) => {
        if (!cancelled) setMarkerImageUri(uri);
      })
      .catch(() => {
        if (!cancelled) setMarkerImageUri(null);
      })
      .finally(() => {
        if (!cancelled) setMarkerImageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, authToken, showDotMarkersOnly]);
  const overall = clamp(metrics.overall_score);
  const lastScanLabel = formatDistanceToNow(scanDate, { addSuffix: true });
  const heroIntro =
    aiSummary?.trim() ||
    `Your latest scan shows an overall score of ${overall}% on our 0–100 scale (higher is better). Detailed scores and photo markers are below.`;

  const serif = Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  });

  const resolvedPhotos =
    faceCaptureGallery && faceCaptureGallery.length > 0
      ? faceCaptureGallery
      : imageUrl?.trim()
        ? [{ label: "Primary scan", imageUrl }]
        : [];

  return (
    <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>AI scan report</Text>
      {displayTitle ? <Text style={styles.pageSubtitle}>{displayTitle}</Text> : null}

      <View style={styles.reportCard}>
        <LinearGradient
          colors={["rgba(255,255,255,0.5)", "transparent"]}
          style={styles.topFade}
          pointerEvents="none"
        />

        <View style={styles.inner}>
          {resolvedPhotos.length > 0 ? (
            <View style={styles.captureSection}>
              <Text style={styles.captureKicker}>
                {resolvedPhotos.length === 1 ? "Your scan photo" : "Face captures"}
              </Text>
              {resolvedPhotos.length === 1 ? (
                <Pressable
                  style={styles.captureSingleWrap}
                  onPress={() => setFullscreenPhoto(resolvedPhotos[0]!)}
                >
                  <ReportContainImage
                    imageUrl={resolvedPhotos[0]!.imageUrl}
                    authToken={authToken}
                    maxWidth={300}
                  />
                  <Text style={styles.captureCaption} numberOfLines={2}>
                    {resolvedPhotos[0]!.label}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <View style={styles.captureGrid}>
                    {resolvedPhotos.map((item, idx) => (
                      <Pressable
                        key={`cap-${idx}-${item.label}`}
                        style={styles.captureTile}
                        onPress={() => setFullscreenPhoto(item)}
                        accessibilityLabel={`View ${item.label} full screen`}
                      >
                        <View style={styles.captureTileImg}>
                          <ReportContainImage
                            imageUrl={item.imageUrl}
                            authToken={authToken}
                            resizeMode="cover"
                          />
                        </View>
                        <Text style={styles.captureTileCaption} numberOfLines={2}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.captureHint}>Tap any photo to view full screen</Text>
                </>
              )}
            </View>
          ) : (
            <Text style={styles.mutedCenter}>No face capture images for this scan.</Text>
          )}

          {showMaskSection ? (
            <ScanMaskAnnotationsNative
              wrinkleMaskUri={wrinkleMask || undefined}
              acneMaskUri={acneMask || undefined}
              wrinkleFallbackUri={resolvedPhotos[4]?.imageUrl}
              acneFallbackUri={resolvedPhotos[0]?.imageUrl}
              authToken={authToken}
              wrinkleLabel={WRINKLE_MASK_PANEL_LABEL}
              acneLabel={ACNE_MASK_PANEL_LABEL}
            />
          ) : null}

          {showDotMarkersOnly ? (
            <View style={styles.annotatedBlock}>
              <Text style={styles.captureKicker}>{DOT_MARKER_LEGEND.title}</Text>
              <View style={styles.annotatedFrame}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.35)", "transparent", "rgba(0,0,0,0.2)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                {markerImageLoading ? (
                  <View style={[styles.faceImg, styles.markerPlaceholder]}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : markerImageUri ? (
                  <Image
                    source={{ uri: markerImageUri }}
                    style={styles.faceImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.faceImg, styles.markerPlaceholder]} />
                )}
                {regions.map((region, i) => (
                  <View
                    key={i}
                    style={[
                      styles.marker,
                      {
                        left: `${region.coordinates.x}%`,
                        top: `${region.coordinates.y}%`,
                        backgroundColor: markerColor(region.issue),
                      },
                    ]}
                    accessibilityLabel={region.issue}
                  />
                ))}
              </View>
              <View style={styles.legendRow}>
                {DOT_MARKER_LEGEND.items.map((item) => (
                  <View key={item.label} style={styles.legendChip}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Text style={styles.reportHeadKicker}>AI scan report</Text>
          <Text style={[styles.hello, { fontFamily: serif }]}>Hello {userName}</Text>
          <Text style={styles.ageLine}>
            Age: {userAge}yrs · Skin type: {userSkinType}
          </Text>
          <Text style={styles.bodyText}>{heroIntro}</Text>

          {tracker ? (
            <TrackerReportSectionsNative report={tracker} serifFamily={serif ?? "serif"} />
          ) : (
            <>
              <View style={styles.metricsCol}>
                {[
                  {
                    label: "Acne",
                    value: metrics.acne,
                    fill: T.peach,
                    track: T.peachTrack,
                  },
                  {
                    label: "Hydration",
                    value: metrics.hydration,
                    fill: T.navyMid,
                    track: "rgba(61, 80, 128, 0.2)",
                  },
                  {
                    label: "Wrinkles",
                    value: metrics.wrinkles,
                    fill: "#6366F1",
                    track: "rgba(99,102,241,0.15)",
                  },
                ].map((row) => (
                  <View key={row.label} style={styles.metricPill}>
                    <Text style={styles.metricLabel}>{row.label}</Text>
                    <View style={styles.metricRight}>
                      <ReportDonut
                        percent={row.value}
                        size={54}
                        stroke={5}
                        color={row.fill}
                        trackColor={row.track}
                      />
                      <Text style={styles.metricPct}>{clamp(row.value)}%</Text>
                    </View>
                  </View>
                ))}
              </View>

              {metrics.clinical_scores ? (
                <View style={styles.clinicalSection}>
                  <Text style={styles.clinicalKicker}>Model scores (1–5)</Text>
                  <Text style={styles.clinicalHint}>
                    Severity-style outputs from the analysis engine (higher = more concern).
                  </Text>
                  <View style={styles.clinicalGrid}>
                    {CLINICAL_ROWS.map(({ key, label }) => {
                      const v = metrics.clinical_scores![key];
                      if (key === "pigmentation_model") {
                        if (v === undefined) return null;
                        if (v === null) {
                          return (
                            <View key={key} style={styles.clinicalCard}>
                              <Text style={styles.clinicalLabel}>{label}</Text>
                              <Text style={styles.clinicalNa}>No dataset available</Text>
                            </View>
                          );
                        }
                      }
                      if (typeof v !== "number") return null;
                      return (
                        <View key={key} style={styles.clinicalCard}>
                          <View style={styles.clinicalTop}>
                            <Text style={styles.clinicalLabel}>{label}</Text>
                            <Text style={styles.clinicalNum}>{v.toFixed(1)}</Text>
                          </View>
                          <View style={styles.clinicalTrack}>
                            <View
                              style={[styles.clinicalFill, { width: clinicalBarWidth(v) }]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.scoreFloat}>
                <Text style={styles.scoreKicker}>YOUR SKIN HEALTH</Text>
                <Text style={[styles.scoreBig, { fontFamily: serif }]}>{overall}%</Text>
                <Text style={styles.scoreSub}>Last scan: {lastScanLabel}</Text>
                <View style={styles.scoreDonutWrap}>
                  <ReportDonut
                    percent={overall}
                    size={104}
                    stroke={9}
                    color={T.peach}
                    trackColor={T.peachLight}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {tracker ? (
          <View style={styles.beigeFooter}>
            <View style={styles.footerRule} />
            <Text style={styles.resourceFooterTitle}>Resource centre</Text>
            <Text style={styles.resourceFooterHint}>
              Personalized links from your kAI tracker (same as on the website).
            </Text>
          </View>
        ) : (
          <LinearGradient colors={[T.navy, T.navyMid]} style={styles.tealSection}>
            <View style={styles.tealDivider} />
            <View style={styles.tealBar} />
            <Text style={styles.tealH}>Overview</Text>
            <Text style={styles.tealP}>
              {aiSummary?.trim()
                ? "Use the clinical bars and photo markers to see what this scan emphasized. Compare future scans for trends—this is educational, not a medical diagnosis."
                : "Your skin shows a balanced profile with room to optimize hydration and maintain clarity. Continue tracking changes after each scan to spot trends early."}
            </Text>
            <Text style={styles.tealP}>{OVERVIEW_P2}</Text>
            <View style={[styles.tealBar, { marginTop: 20 }]} />
            <Text style={styles.tealH}>Causes / challenges</Text>
            <Text style={styles.tealP}>{CAUSES_P1}</Text>
            <Text style={styles.tealP}>{CAUSES_P2}</Text>
          </LinearGradient>
        )}

        <View style={styles.beigeFooter}>
          <View style={styles.footerRule} />
          <Text style={styles.knowSkin}>To know your skin better</Text>
          {tracker?.cta.showAppointmentPrep ? (
            <Pressable
              style={styles.bookBtn}
              onPress={() => router.push("/(drawer)/schedules" as Href)}
            >
              <Text style={styles.bookBtnText}>Appointment prep</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.bookBtn}
              onPress={() => router.push("/(drawer)/schedules" as Href)}
            >
              <Text style={styles.bookBtnText}>Book now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>

    <Modal
      visible={fullscreenPhoto != null}
      transparent
      animationType="fade"
      onRequestClose={() => setFullscreenPhoto(null)}
    >
      <Pressable style={styles.fsBackdrop} onPress={() => setFullscreenPhoto(null)}>
        {fullscreenPhoto ? (
          <ReportContainImage
            imageUrl={fullscreenPhoto.imageUrl}
            authToken={authToken}
            maxWidth={Math.round(Dimensions.get("window").width)}
            style={styles.fsImage}
          />
        ) : null}
        <Text style={styles.fsCaption}>{fullscreenPhoto?.label ?? ""}</Text>
        <Pressable style={styles.fsClose} onPress={() => setFullscreenPhoto(null)}>
          <Text style={styles.fsCloseText}>Close</Text>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.pageBg },
  scrollContent: { paddingBottom: 40 },
  toolbar: { alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 4 },
  pdfBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  pdfBtnDis: { opacity: 0.55 },
  pdfBtnText: { fontSize: 12, fontWeight: "700", color: T.navy },
  pageTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#18181b",
    marginTop: 4,
  },
  pageSubtitle: {
    textAlign: "center",
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
    paddingHorizontal: 24,
  },
  reportCard: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  topFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 120,
    zIndex: 1,
  },
  inner: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28 },
  captureKicker: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.2,
    color: T.navy,
    marginBottom: 12,
  },
  captureSection: { marginBottom: 8, width: "100%" },
  captureSingleWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 4,
  },
  /** Compact collage: 5 captures wrap into rows of 3 instead of one tall vertical list. */
  captureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  captureTile: {
    width: "31%",
    alignItems: "center",
  },
  captureTileImg: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e4e4e7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  captureTileCaption: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    lineHeight: 13,
  },
  captureHint: {
    marginTop: 12,
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    fontStyle: "italic",
  },
  captureCaption: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    paddingHorizontal: 8,
    lineHeight: 16,
  },
  fsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  fsImage: { width: "100%" },
  fsCaption: {
    marginTop: 16,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  fsClose: {
    position: "absolute",
    top: 52,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  fsCloseText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  mutedCenter: {
    textAlign: "center",
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  annotatedBlock: { marginTop: 20 },
  annotatedFrame: {
    marginTop: 12,
    alignSelf: "center",
    width: 280,
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: T.sageBand,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  legendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GLASS,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: "600", color: "#374151" },
  reportHeadKicker: {
    marginTop: 28,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: T.navy,
    textTransform: "uppercase",
  },
  hello: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "500",
    color: "#18181b",
    lineHeight: 38,
  },
  ageLine: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  bodyText: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 24,
    color: "#374151",
  },
  faceImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  markerPlaceholder: {
    backgroundColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  marker: {
    position: "absolute",
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: 5,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  metricsCol: { marginTop: 24, gap: 10, alignItems: "stretch" },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GLASS,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  metricLabel: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  metricRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  metricPct: {
    width: 40,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: T.navy,
  },
  clinicalSection: { marginTop: 24 },
  clinicalKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: T.navy,
    textTransform: "uppercase",
  },
  clinicalHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
  },
  clinicalGrid: { marginTop: 12, gap: 10 },
  clinicalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS,
    padding: 12,
  },
  clinicalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  clinicalLabel: { fontSize: 11, fontWeight: "700", color: "#1E293B", flex: 1 },
  clinicalNum: { fontSize: 12, fontWeight: "700", color: T.navy },
  clinicalNa: { marginTop: 6, fontSize: 10, color: "#6B7280" },
  clinicalTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(44,62,107,0.12)",
    overflow: "hidden",
  },
  clinicalFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: T.navy,
  },
  scoreFloat: {
    marginTop: 28,
    marginHorizontal: -8,
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: GLASS,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: "center",
  },
  scoreKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: T.navy,
  },
  scoreBig: {
    marginTop: 6,
    fontSize: 56,
    fontWeight: "500",
    color: T.peach,
    lineHeight: 58,
  },
  scoreSub: { marginTop: 8, fontSize: 12, fontWeight: "500", color: "#6B7280" },
  scoreDonutWrap: {
    marginTop: 12,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(44,62,107,0.15)",
  },
  tealSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    marginTop: 4,
  },
  tealDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS_BORDER,
    marginBottom: 20,
  },
  tealBar: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: T.accent,
    marginBottom: 12,
  },
  tealH: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#ffffff",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  tealP: {
    fontSize: 14,
    lineHeight: 24,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 14,
  },
  beigeFooter: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: "transparent",
  },
  footerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(44,62,107,0.12)",
    marginBottom: 20,
  },
  resourceFooterTitle: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.8,
    color: T.navy,
    textTransform: "uppercase",
  },
  resourceFooterHint: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  knowSkin: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.2,
    color: T.navy,
    textTransform: "uppercase",
  },
  bookBtn: {
    alignSelf: "center",
    backgroundColor: T.navy,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 14,
  },
  bookBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
