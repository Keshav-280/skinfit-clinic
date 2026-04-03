import { formatDistanceToNow } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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

const BEIGE = "#F5F1E9";
const TEAL_BAND = "#E0EEEB";
const PEACH = "#F29C91";
const BTN = "#6D8C8E";

const LOREM_PROFILE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

const CAUSES_P1 =
  "Environmental factors such as UV exposure, seasonal dryness, and urban pollution can accentuate texture irregularities and uneven tone. A consistent barrier-focused routine helps mitigate these stressors.";
const CAUSES_P2 =
  "Hormonal shifts, stress, and sleep patterns may also influence oil balance and sensitivity. Tracking flare-ups alongside lifestyle changes gives clearer insight into your skin's triggers.";

const OVERVIEW_P2 =
  "Maintaining gentle cleansing, daily photoprotection, and targeted hydration supports long-term barrier health and helps preserve the improvements shown in your latest scan.";

const TREATMENT_IMAGES = [
  "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=280&h=400&fit=crop&q=85",
  "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=280&h=400&fit=crop&q=85",
  "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=280&h=400&fit=crop&q=85",
  "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=280&h=400&fit=crop&q=85",
];

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
};

type Props = {
  userName: string;
  userAge: number;
  userSkinType: string;
  scanTitle: string | null;
  imageUrl: string;
  regions: ReportRegion[];
  metrics: ReportMetricsNative;
  aiSummary: string | null;
  scanDate: Date;
  pdfLoading: boolean;
  onDownloadPdf: () => void;
};

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
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
  imageUrl,
  regions,
  metrics,
  aiSummary,
  scanDate,
  pdfLoading,
  onDownloadPdf,
}: Props) {
  const router = useRouter();
  const displayTitle = displayScanTitle(scanTitle);
  const overall = clamp(metrics.overall_score);
  const lastScanLabel = formatDistanceToNow(scanDate, { addSuffix: true });
  const overview =
    aiSummary?.trim() ||
    "Your skin shows a balanced profile with room to optimize hydration and maintain clarity. Continue tracking changes after each scan to spot trends early.";

  const serif = Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  });

  const metricRows = [
    { label: "Acne", value: metrics.acne, fill: "#5B8FD8", track: "rgba(91, 143, 216, 0.18)" },
    { label: "Hydration", value: metrics.hydration, fill: PEACH, track: "rgba(242, 156, 145, 0.22)" },
    { label: "Wrinkles", value: metrics.wrinkles, fill: "#9EC5E8", track: "rgba(158, 197, 232, 0.3)" },
  ];

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
          <Text style={styles.kicker}>AI SCAN REPORT</Text>
          <Text style={[styles.hello, { fontFamily: serif }]}>Hello {userName}</Text>
          <Text style={styles.ageLine}>
            Age: {userAge}yrs · Skin type: {userSkinType}
          </Text>
          <Text style={styles.bodyText}>{LOREM_PROFILE}</Text>

          <View style={styles.faceWrap}>
            <View style={styles.faceFrame}>
              <LinearGradient
                colors={["rgba(255,255,255,0.35)", "transparent", "rgba(0,0,0,0.25)"]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Image source={{ uri: imageUrl }} style={styles.faceImg} resizeMode="cover" />
              {regions.map((region, i) => (
                <View
                  key={i}
                  style={[
                    styles.marker,
                    {
                      left: `${region.coordinates.x}%`,
                      top: `${region.coordinates.y}%`,
                    },
                  ]}
                  accessibilityLabel={region.issue}
                />
              ))}
            </View>
          </View>

          <View style={styles.metricsCol}>
            {metricRows.map((row) => (
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
        </View>

        <LinearGradient
          colors={[TEAL_BAND, "#d8ebe6"]}
          style={styles.tealSection}
        >
          <View style={styles.tealDivider} />
          <View style={styles.tealCol}>
            <View style={styles.tealBar} />
            <Text style={styles.tealH}>OVERVIEW</Text>
            <Text style={styles.tealP}>{overview}</Text>
            <Text style={styles.tealP}>{OVERVIEW_P2}</Text>
          </View>
          <View style={styles.tealCol}>
            <View style={styles.tealBar} />
            <Text style={styles.tealH}>CAUSES / CHALLENGES</Text>
            <Text style={styles.tealP}>{CAUSES_P1}</Text>
            <Text style={styles.tealP}>{CAUSES_P2}</Text>
          </View>
        </LinearGradient>

        <View style={[styles.beigeFooter, { backgroundColor: BEIGE }]}>
          <View style={styles.footerRule} />
          <Text style={styles.videosTitle}>TREATMENT VIDEOS</Text>
          <View style={styles.thumbGrid}>
            {TREATMENT_IMAGES.map((src, i) => (
              <View key={src} style={styles.thumbCell}>
                <Image source={{ uri: src }} style={styles.thumbImg} resizeMode="cover" />
              </View>
            ))}
          </View>
          <Text style={styles.knowSkin}>TO KNOW YOUR SKIN BETTER</Text>
          <Pressable
            style={styles.bookBtn}
            onPress={() => router.push("/(drawer)/schedules")}
          >
            <Text style={styles.bookBtnText}>Book now</Text>
          </Pressable>
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
  inner: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 120 },
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
  videosTitle: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.8,
    color: "#18181b",
  },
  thumbGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
    justifyContent: "center",
  },
  thumbCell: {
    width: "47%",
    maxWidth: 160,
    aspectRatio: 3 / 5,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#e4e4e7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  thumbImg: { width: "100%", height: "100%" },
  knowSkin: {
    textAlign: "center",
    marginTop: 28,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.2,
    color: "#52525b",
  },
  bookBtn: {
    alignSelf: "center",
    marginTop: 16,
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
