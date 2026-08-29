import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CAPTURE_PHOTO_GUIDE_AVOID,
  CAPTURE_PHOTO_GUIDE_CARDS,
  CAPTURE_PHOTO_GUIDE_GOOD,
  CAPTURE_PHOTO_GUIDE_SUMMARY_AVOID,
  CAPTURE_PHOTO_GUIDE_SUMMARY_GOOD,
} from "@/lib/capturePhotoGuide";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const NAVY_DARK = SKINFIT_THEME.navyDark;
const MUTED = "#4A5568";
const GOOD = "#4CAF50";
const BAD = "#EF4444";

type Props = {
  visible: boolean;
  onClose: () => void;
};

function StatusBadge({ good }: { good: boolean }) {
  return (
    <View style={[styles.badge, good ? styles.badgeGood : styles.badgeBad]}>
      <Ionicons
        name={good ? "checkmark" : "close"}
        size={14}
        color="#FFFFFF"
      />
    </View>
  );
}

function SummaryPanel({
  kind,
  points,
  imageUri,
}: {
  kind: "good" | "avoid";
  points: readonly string[];
  imageUri: string;
}) {
  const good = kind === "good";
  return (
    <View style={[styles.summaryPanel, good ? styles.summaryGood : styles.summaryAvoid]}>
      <View style={styles.summaryImageWrap}>
        <Image source={{ uri: imageUri }} style={styles.summaryImage} resizeMode="cover" />
        <View style={styles.summaryImageBadge}>
          <StatusBadge good={good} />
        </View>
      </View>
      <View style={styles.summaryCopy}>
        <Text style={[styles.summaryHeading, good ? styles.summaryHeadingGood : styles.summaryHeadingBad]}>
          {good ? "GOOD" : "AVOID"}
        </Text>
        {points.map((point) => (
          <View key={point} style={styles.summaryRow}>
            <Ionicons
              name={good ? "checkmark-circle" : "close-circle"}
              size={16}
              color={good ? GOOD : BAD}
            />
            <Text style={styles.summaryPoint}>{point}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CapturePhotoGuideModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>PHOTO GUIDE</Text>
            <Text style={styles.subtitle}>Follow these simple tips for accurate results</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close photo guide"
          >
            <Ionicons name="close" size={22} color={NAVY} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardRow}
          >
            {CAPTURE_PHOTO_GUIDE_CARDS.map((card) => (
              <View key={card.title} style={styles.card}>
                <View style={styles.cardImageWrap}>
                  <Image source={{ uri: card.image }} style={styles.cardImage} resizeMode="cover" />
                  <View style={styles.cardBadge}>
                    <StatusBadge good={card.good} />
                  </View>
                </View>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardDesc}>{card.description}</Text>
              </View>
            ))}
          </ScrollView>

          <SummaryPanel
            kind="good"
            points={CAPTURE_PHOTO_GUIDE_GOOD}
            imageUri={CAPTURE_PHOTO_GUIDE_SUMMARY_GOOD}
          />
          <SummaryPanel
            kind="avoid"
            points={CAPTURE_PHOTO_GUIDE_AVOID}
            imageUri={CAPTURE_PHOTO_GUIDE_SUMMARY_AVOID}
          />

          <Pressable
            style={({ pressed }) => [styles.gotItBtn, pressed && styles.gotItBtnPressed]}
            onPress={onClose}
          >
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F7F2",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(30, 27, 49,0.12)",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  cardRow: {
    gap: 12,
    paddingRight: 4,
  },
  card: {
    width: 132,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.65)",
    overflow: "hidden",
  },
  cardImageWrap: {
    aspectRatio: 4 / 5,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeGood: { backgroundColor: GOOD },
  badgeBad: { backgroundColor: BAD },
  cardTitle: {
    marginTop: 10,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  cardDesc: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingBottom: 12,
    fontSize: 11,
    lineHeight: 15,
    color: "#64748B",
  },
  summaryPanel: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  summaryGood: { borderColor: "rgba(76,175,80,0.25)" },
  summaryAvoid: { borderColor: "rgba(239,68,68,0.2)" },
  summaryCopy: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  summaryHeading: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  summaryHeadingGood: { color: GOOD },
  summaryHeadingBad: { color: BAD },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryPoint: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#1F2A44",
  },
  summaryImageWrap: {
    alignSelf: "center",
    width: "72%",
    maxWidth: 280,
    aspectRatio: 3 / 4,
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  summaryImage: {
    ...StyleSheet.absoluteFillObject,
  },
  summaryImageBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
  },
  gotItBtn: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NAVY_DARK,
    paddingVertical: 16,
    borderRadius: 16,
  },
  gotItBtnPressed: { opacity: 0.92 },
  gotItText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
