import { formatDistanceToNow } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import type { ImageSourcePropType } from "react-native";
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
import type { PatientTrackerReport } from "../../src/lib/patientTrackerReport.types";

const BEIGE = "#F5F1E9";
const TEAL_BAND = "#E0EEEB";
const PEACH = "#F29C91";
const BTN = "#6D8C8E";

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

type Props = {
  userName: string;
  userAge: number;
  userSkinType: string;
  scanTitle: string | null;
  imageSource: ImageSourcePropType;
  /** Data URI or URL: wrinkle + acne overlay from analyzer. */
  annotatedOverlayUri?: string | null;
  regions: ReportRegion[];
  metrics: ReportMetricsNative;
  aiSummary: string | null;
  scanDate: Date;
  pdfLoading: boolean;
  onDownloadPdf: () => void;
  /** kAI 5-section tracker; when null, legacy hero copy still shows. */
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

export function SkinScanReportBodyNative({
  userName,
  userAge,
  userSkinType,
  scanTitle,
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
  const faceSource: ImageSourcePropType =
    overlayUri.length > 0 ? { uri: overlayUri } : imageSource;
  const showFaceMarkers = overlayUri.length === 0;
  const overall = clamp(metrics.overall_score);
  const lastScanLabel = formatDistanceToNow(scanDate, { addSuffix: true });
  const heroIntro =
    aiSummary?.trim() ||
    `Your latest scan shows an overall score of ${overall}% on our 0–100 scale (higher is better).`;

  const serif = Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  });

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

      <Text style={styles.pageTitle}>kAI tracker report</Text>
      {displayTitle ? <Text style={styles.pageSubtitle}>{displayTitle}</Text> : null}

      <View style={styles.reportCard}>
        <LinearGradient
          colors={["rgba(255,255,255,0.5)", "transparent"]}
          style={styles.topFade}
          pointerEvents="none"
        />

        <View style={styles.inner}>
          <Text style={styles.kicker}>SCAN & TRACKER</Text>
          <Text style={[styles.hello, { fontFamily: serif }]}>Hello {userName}</Text>
          <Text style={styles.ageLine}>
            Age: {userAge}yrs · Skin type: {userSkinType}
          </Text>
          <Text style={styles.bodyText}>{heroIntro}</Text>

          <View style={styles.faceWrap}>
            <View style={styles.faceFrame}>
              <LinearGradient
                colors={["rgba(255,255,255,0.35)", "transparent", "rgba(0,0,0,0.25)"]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image source={faceSource} style={styles.faceImg} resizeMode="cover" />
              {showFaceMarkers
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
          </View>

          {tracker ? (
            <View style={[styles.scoreFloat, { marginTop: 18 }]}>
              <Text style={styles.scoreKicker}>kAI SKIN SCORE (THIS SCAN)</Text>
              <Text style={[styles.scoreBig, { fontFamily: serif }]}>
                {tracker.scores.kaiScore}%
              </Text>
            </View>
          ) : (
            <View style={styles.metricsCol}>
              {[
                { label: "Acne", value: metrics.acne, fill: "#5B8FD8", track: "rgba(91, 143, 216, 0.18)" },
                { label: "Hydration", value: metrics.hydration, fill: PEACH, track: "rgba(242, 156, 145, 0.22)" },
                { label: "Wrinkles", value: metrics.wrinkles, fill: "#9EC5E8", track: "rgba(158, 197, 232, 0.3)" },
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
          )}

          {!tracker ? (
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
          ) : null}
        </View>

        {!tracker ? (
          <LinearGradient colors={[TEAL_BAND, "#d8ebe6"]} style={styles.tealSection}>
            <View style={styles.tealDivider} />
            <View style={styles.tealCol}>
              <View style={styles.tealBar} />
              <Text style={styles.tealH}>NOTE</Text>
              <Text style={styles.tealP}>
                Complete your profile and weekly scans to unlock the full kAI tracker narrative.
              </Text>
            </View>
          </LinearGradient>
        ) : null}

        <View style={[styles.beigeFooter, { backgroundColor: BEIGE }]}>
          <View style={styles.footerRule} />
          <Text style={styles.knowSkin}>CTA</Text>
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
  inner: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32 },
  kicker: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2.2,
    color: "#71717a",
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
  faceWrap: { marginTop: 20, alignItems: "center" },
  faceFrame: {
    width: 220,
    aspectRatio: 3 / 4,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#e4e4e7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
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
  section: { marginTop: 22 },
  ocBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(254, 243, 199, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)",
  },
  ocKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#92400e",
    marginBottom: 8,
  },
  ocFlag: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9f1239",
    marginTop: 6,
    lineHeight: 18,
  },
  ocNote: {
    fontSize: 13,
    color: "#27272a",
    marginTop: 6,
    lineHeight: 18,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#71717a",
    marginBottom: 10,
  },
  hookLine: {
    fontSize: 18,
    lineHeight: 24,
    color: "#18181b",
    fontWeight: "500",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#fff",
  },
  chipK: { fontSize: 9, fontWeight: "600", color: "#71717a", textTransform: "uppercase" },
  chipV: { fontSize: 13, fontWeight: "700", color: "#18181b" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  pillText: { fontSize: 12, fontWeight: "500", color: "#3f3f46" },
  paramGrid: { marginTop: 12, gap: 8 },
  paramCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fff",
  },
  paramTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  paramLabel: { fontSize: 12, fontWeight: "600", color: "#27272a", flex: 1 },
  paramRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  paramValue: { fontSize: 12, fontWeight: "700", color: "#18181b" },
  paramDelta: { fontSize: 11, fontWeight: "700" },
  pendingBadge: {
    backgroundColor: "#fffbeb",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  pendingBadgeText: { fontSize: 8, fontWeight: "700", color: "#92400e" },
  paramTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(228,228,231,0.9)",
    overflow: "hidden",
  },
  paramTrackPending: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#f4f4f5",
  },
  paramFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0d9488",
  },
  causesBox: {
    marginTop: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  causesKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#52525b",
    marginBottom: 8,
  },
  causeBullet: { fontSize: 13, lineHeight: 20, color: "#3f3f46", marginBottom: 6 },
  overviewPara: { marginTop: 8, fontSize: 13, lineHeight: 22, color: "#52525b" },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e4e4e7",
  },
  resourceKind: {
    fontSize: 9,
    fontWeight: "800",
    color: "#52525b",
    width: 64,
  },
  resourceTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: "#0f766e" },
  focusCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fff",
  },
  focusRank: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: BTN,
    alignItems: "center",
    justifyContent: "center",
  },
  focusRankText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  focusTitle: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  focusDetail: { marginTop: 4, fontSize: 12, lineHeight: 18, color: "#52525b" },
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
    marginTop: 8,
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
  },
  tealP: {
    fontSize: 14,
    lineHeight: 24,
    color: "#3f3f46",
    marginBottom: 14,
  },
  tealCol: { marginBottom: 20 },
  beigeFooter: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  footerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginBottom: 20,
  },
  knowSkin: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.2,
    color: "#52525b",
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
