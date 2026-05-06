import { formatDistanceToNow } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import type { DimensionValue, ImageSourcePropType } from "react-native";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ReportDonut } from "@/components/ReportDonut";
import { TrackerReportSectionsNative } from "@/components/TrackerReportSectionsNative";
import type { PatientTrackerReport } from "@/lib/patientTrackerReport.types";
import { patientScanImageDisplayUrl } from "@/lib/patientScanImagePath";
import { resolveAuthenticatedScanImageSource } from "@/lib/resolveScanImage";

const BEIGE = "#F5F1E9";
const TEAL_BAND = "#E0EEEB";
const PEACH = "#F29C91";
const BTN = "#6D8C8E";

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
  { key: "wrinkle_severity", label: "Wrinkles (severity 1–5)" },
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
  /** Resolved primary image (auth headers applied). */
  imageSource: ImageSourcePropType;
  annotatedOverlayUri?: string | null;
  regions: ReportRegion[];
  metrics: ReportMetricsNative;
  aiSummary: string | null;
  scanDate: Date;
  pdfLoading: boolean;
  onDownloadPdf: () => void;
  tracker: PatientTrackerReport | null;
};

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function markerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return "#dc2626";
  if (x.includes("wrinkle")) return "#7c3aed";
  if (x.includes("pigment")) return "#d97706";
  if (x.includes("texture")) return "#0d9488";
  return "#6b7280";
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
  imageSource,
  annotatedOverlayUri = null,
  regions,
  metrics,
  aiSummary,
  scanDate,
  pdfLoading,
  onDownloadPdf,
  tracker,
}: Props) {
  const router = useRouter();
  const displayTitle = displayScanTitle(scanTitle);
  const overlayUri = annotatedOverlayUri?.trim() || "";
  const showAnnotatedSection =
    overlayUri.length > 0 || (regions.length > 0 && imageUrl?.trim().length > 0);
  const showDotMarkers = overlayUri.length === 0 && regions.length > 0;
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

  const row2 = resolvedPhotos.slice(0, 2);
  const row3 = resolvedPhotos.slice(2, 5);

  const annotatedFaceSource: ImageSourcePropType =
    overlayUri.length > 0 ? { uri: overlayUri } : imageSource;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.toolbar}>
        <Pressable
          style={[styles.pdfBtn, pdfLoading && styles.pdfBtnDis]}
          onPress={onDownloadPdf}
          disabled={pdfLoading}
        >
          <Text style={styles.pdfBtnText}>{pdfLoading ? "…" : "Download PDF"}</Text>
        </Pressable>
      </View>

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
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.captureKicker}>
                {resolvedPhotos.length === 1 ? "Your scan photo" : "Face captures"}
              </Text>
              {resolvedPhotos.length === 1 ? (
                <View style={styles.singleCaptureWrap}>
                  <View style={styles.captureFrameLarge}>
                    <Image
                      source={resolveAuthenticatedScanImageSource(
                        patientScanImageDisplayUrl(resolvedPhotos[0]!.imageUrl),
                        authToken
                      )}
                      style={styles.captureImg}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.captureCaption}>{resolvedPhotos[0]!.label}</Text>
                </View>
              ) : null}
              {resolvedPhotos.length > 1 && row2.length > 0 ? (
                <View style={styles.captureRow2}>
                  {row2.map((item, idx) => (
                    <View key={`r2-${idx}-${item.label}`} style={styles.captureCell}>
                      <View style={styles.captureFrameSmall}>
                        <Image
                          source={resolveAuthenticatedScanImageSource(
                            patientScanImageDisplayUrl(item.imageUrl),
                            authToken
                          )}
                          style={styles.captureImg}
                          resizeMode="cover"
                        />
                      </View>
                      <Text style={styles.captureCaptionSmall} numberOfLines={2}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {resolvedPhotos.length > 1 && row3.length > 0 ? (
                <View style={styles.captureRow3}>
                  {row3.map((item, idx) => (
                    <View key={`r3-${idx}-${item.label}`} style={styles.captureCell3}>
                      <View style={styles.captureFrameSmall}>
                        <Image
                          source={resolveAuthenticatedScanImageSource(
                            patientScanImageDisplayUrl(item.imageUrl),
                            authToken
                          )}
                          style={styles.captureImg}
                          resizeMode="cover"
                        />
                      </View>
                      <Text style={styles.captureCaptionSmall} numberOfLines={2}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.mutedCenter}>No face capture images for this scan.</Text>
          )}

          {showAnnotatedSection ? (
            <View style={styles.annotatedBlock}>
              <Text style={styles.captureKicker}>Annotated findings</Text>
              <View style={styles.annotatedFrame}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.35)", "transparent", "rgba(0,0,0,0.2)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <Image source={annotatedFaceSource} style={styles.faceImg} resizeMode="cover" />
                {showDotMarkers
                  ? regions.map((region, i) => (
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
                    ))
                  : null}
              </View>
              <View style={styles.legendRow}>
                {["Acne", "Wrinkle", "Pigmentation", "Texture"].map((label) => (
                  <View key={label} style={styles.legendChip}>
                    <View style={[styles.legendDot, { backgroundColor: markerColor(label) }]} />
                    <Text style={styles.legendText}>{label}</Text>
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
                    fill: "#5B8FD8",
                    track: "rgba(91, 143, 216, 0.18)",
                  },
                  {
                    label: "Hydration",
                    value: metrics.hydration,
                    fill: PEACH,
                    track: "rgba(242, 156, 145, 0.22)",
                  },
                  {
                    label: "Wrinkles",
                    value: metrics.wrinkles,
                    fill: "#9EC5E8",
                    track: "rgba(158, 197, 232, 0.3)",
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
                    color={PEACH}
                    trackColor="#F0E4E1"
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {tracker ? (
          <View style={[styles.beigeFooter, { backgroundColor: BEIGE }]}>
            <View style={styles.footerRule} />
            <Text style={styles.resourceFooterTitle}>Resource centre</Text>
            <Text style={styles.resourceFooterHint}>
              Personalized links from your kAI tracker (same as on the website).
            </Text>
          </View>
        ) : (
          <LinearGradient colors={[TEAL_BAND, "#d8ebe6"]} style={styles.tealSection}>
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

        <View style={[styles.beigeFooter, { backgroundColor: BEIGE }]}>
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
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  scrollContent: { paddingBottom: 40 },
  toolbar: { alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 4 },
  pdfBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pdfBtnDis: { opacity: 0.55 },
  pdfBtnText: { fontSize: 12, fontWeight: "700", color: "#27272a" },
  pageTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#18181b",
    marginTop: 4,
  },
  pageSubtitle: {
    textAlign: "center",
    fontSize: 14,
    color: "#52525b",
    marginTop: 6,
    paddingHorizontal: 24,
  },
  reportCard: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: BEIGE,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
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
    color: "#71717a",
    marginBottom: 12,
  },
  singleCaptureWrap: { alignItems: "center" },
  captureFrameLarge: {
    width: 200,
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e4e4e7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  captureRow2: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    flexWrap: "wrap",
    marginTop: 8,
  },
  captureRow3: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 12,
  },
  captureCell: { width: 120, alignItems: "center" },
  captureCell3: { width: 100, alignItems: "center" },
  captureFrameSmall: {
    width: "100%",
    aspectRatio: 3 / 4,
    maxWidth: 96,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e4e4e7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  captureImg: { width: "100%", height: "100%" },
  captureCaption: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
    color: "#52525b",
    textAlign: "center",
  },
  captureCaptionSmall: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: "600",
    color: "#52525b",
    textAlign: "center",
    lineHeight: 12,
  },
  mutedCenter: {
    textAlign: "center",
    fontSize: 14,
    color: "#71717a",
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
    backgroundColor: "#e4e4e7",
    borderWidth: 1,
    borderColor: "#d4d4d8",
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
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: "600", color: "#52525b" },
  reportHeadKicker: {
    marginTop: 28,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#71717a",
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
    fontWeight: "500",
    color: "#52525b",
  },
  bodyText: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 24,
    color: "#52525b",
  },
  faceImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
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
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#fff",
  },
  metricLabel: { fontSize: 13, fontWeight: "600", color: "#3f3f46" },
  metricRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  metricPct: {
    width: 40,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: "#27272a",
  },
  clinicalSection: { marginTop: 24 },
  clinicalKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#71717a",
    textTransform: "uppercase",
  },
  clinicalHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#52525b",
  },
  clinicalGrid: { marginTop: 12, gap: 10 },
  clinicalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 12,
  },
  clinicalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  clinicalLabel: { fontSize: 11, fontWeight: "700", color: "#27272a", flex: 1 },
  clinicalNum: { fontSize: 12, fontWeight: "700", color: "#18181b" },
  clinicalNa: { marginTop: 6, fontSize: 10, color: "#71717a" },
  clinicalTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(228,228,231,0.95)",
    overflow: "hidden",
  },
  clinicalFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#3f3f46",
  },
  scoreFloat: {
    marginTop: 28,
    marginHorizontal: -8,
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  scoreKicker: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#71717a",
  },
  scoreBig: {
    marginTop: 6,
    fontSize: 56,
    fontWeight: "500",
    color: PEACH,
    lineHeight: 58,
  },
  scoreSub: { marginTop: 8, fontSize: 12, fontWeight: "500", color: "#71717a" },
  scoreDonutWrap: {
    marginTop: 12,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  tealSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    marginTop: 4,
  },
  tealDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  tealBar: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#27272a",
    marginBottom: 12,
  },
  tealH: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#18181b",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  tealP: {
    fontSize: 14,
    lineHeight: 24,
    color: "#3f3f46",
    marginBottom: 14,
  },
  beigeFooter: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  footerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginBottom: 20,
  },
  resourceFooterTitle: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.8,
    color: "#18181b",
    textTransform: "uppercase",
  },
  resourceFooterHint: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    color: "#71717a",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  knowSkin: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.2,
    color: "#52525b",
    textTransform: "uppercase",
  },
  bookBtn: {
    alignSelf: "center",
    backgroundColor: BTN,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: BTN,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bookBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
