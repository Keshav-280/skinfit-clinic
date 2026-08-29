import { Ionicons } from "@expo/vector-icons";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { SCAN_REPORT_CLINIC_PROMO as copy } from "../../src/lib/scanReportClinicPromo";
import { SCAN_REPORT_THEME as T } from "@/lib/scanReportTheme";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function ScanReportClinicPromoOverlayNative({ visible, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root} accessibilityViewIsModal accessibilityRole="alert">
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          accessibilityLabel="Dismiss clinic information"
        />

        <View style={styles.card}>
          <Pressable
            onPress={onDismiss}
            style={styles.closeBtn}
            hitSlop={10}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={18} color="#71717a" />
          </Pressable>

          <Text style={styles.kicker}>{copy.kicker}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.intro}>{copy.intro}</Text>

          <View style={styles.item}>
            <View style={styles.icon}>
              <Ionicons name="scan-outline" size={16} color={T.navy} />
            </View>
            <Text style={styles.body}>{copy.facialScan}</Text>
          </View>

          <View style={styles.item}>
            <View style={styles.icon}>
              <Ionicons name="sparkles-outline" size={16} color={T.navy} />
            </View>
            <Text style={styles.body}>{copy.hairScan}</Text>
          </View>

          <Pressable style={styles.cta} onPress={onDismiss}>
            <Text style={styles.ctaText}>View my report</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26, 35, 66, 0.48)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: "#1a2342",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.28,
        shadowRadius: 28,
      },
      android: { elevation: 8 },
    }),
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "rgba(30, 27, 49, 0.7)",
    textTransform: "uppercase",
    paddingRight: 36,
  },
  title: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: T.navyDark,
    lineHeight: 24,
    paddingRight: 28,
  },
  intro: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "#52525b",
  },
  item: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  icon: {
    marginTop: 2,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: T.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#3f3f46",
  },
  cta: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: T.navy,
    paddingVertical: 13,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
