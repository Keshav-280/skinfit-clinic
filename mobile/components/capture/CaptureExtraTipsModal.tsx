import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CAPTURE_EXTRA_TIPS } from "@/lib/captureExtraTips";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const MUTED = "#5C6B82";
const ACCENT = "#E07088";
const ICON_BG = "rgba(224, 112, 136, 0.14)";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function CaptureExtraTipsModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>EXTRA TIPS</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close extra tips"
          >
            <Ionicons name="close" size={22} color={NAVY} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {CAPTURE_EXTRA_TIPS.map((tip) => (
            <View key={tip.title} style={styles.tipRow}>
              <View style={styles.iconWrap}>
                <Ionicons name={tip.icon} size={22} color={ACCENT} />
              </View>
              <View style={styles.tipCopy}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDesc}>{tip.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(246, 245, 242, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(30, 27, 49, 0.1)",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 28,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ICON_BG,
  },
  tipCopy: {
    flex: 1,
    paddingTop: 2,
    gap: 4,
  },
  tipTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
    lineHeight: 22,
  },
  tipDesc: {
    fontSize: 15,
    lineHeight: 21,
    color: MUTED,
    fontWeight: "500",
  },
});
