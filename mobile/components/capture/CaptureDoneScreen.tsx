import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const NAVY_DARK = SKINFIT_THEME.navyDark;
const BG = "#E8EFE6";

type OnboardingProps = {
  mode: "onboarding";
  reportPending?: boolean;
  onPrimary: () => void;
  onDashboard: () => void;
};

type ScanProps = {
  mode: "scan";
  reportPending?: boolean;
  onPrimary: () => void;
  onDashboard: () => void;
};

type Props = OnboardingProps | ScanProps;

export function CaptureDoneScreen(props: Props) {
  const insets = useSafeAreaInsets();
  const reportPending = props.reportPending ?? false;
  const isOnboarding = props.mode === "onboarding";

  const body = reportPending
    ? "We've got your five photos. We'll let you know when your report is ready — you don't have to wait here."
    : "We've got your five photos. Your report will show up in Treatment History soon.";

  const hint = isOnboarding
    ? "Answer a few quick questions now, or head straight to the app."
    : "You can keep using the app while we finish up.";

  const primaryLabel = isOnboarding
    ? "Answer a few questions"
    : "View scan history";

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.center}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={32} color="#fff" />
          </View>

          <Text style={styles.title}>Photos saved</Text>
          <Text style={styles.body}>{body}</Text>
          <Text style={styles.hint}>{hint}</Text>

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={props.onPrimary}
          >
            <Text style={styles.btnText}>{primaryLabel}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btnOutline,
              pressed && styles.btnOutlinePressed,
            ]}
            onPress={props.onDashboard}
          >
            <Text style={styles.btnOutlineText}>Go to dashboard</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 28,
    alignItems: "center",
    shadowColor: "#2C3E6B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#5C6478",
    textAlign: "center",
  },
  hint: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: "#7A8499",
    textAlign: "center",
  },
  btn: {
    marginTop: 22,
    width: "100%",
    backgroundColor: NAVY,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  btnPressed: {
    backgroundColor: NAVY_DARK,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  btnOutline: {
    marginTop: 12,
    width: "100%",
    borderWidth: 2,
    borderColor: NAVY,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnOutlinePressed: {
    opacity: 0.9,
  },
  btnOutlineText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
  },
});
