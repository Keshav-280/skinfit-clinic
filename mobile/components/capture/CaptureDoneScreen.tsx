import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WhyWeNeedScanPhotosCard } from "@/components/capture/WhyWeNeedScanPhotosCard";
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
    ? "Your report will be delivered soon — we'll notify you when it's ready."
    : "Your report will show up in Treatment History soon.";

  const hint = isOnboarding
    ? "Answer a few quick questions now, or head straight to the app."
    : "You can leave this screen — no need to wait here.";

  const primaryLabel = isOnboarding ? "Answer a few questions" : "View scan history";

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <WhyWeNeedScanPhotosCard
          footer={
            <>
              <View style={styles.iconCircle}>
                <Ionicons name="notifications-outline" size={26} color="#fff" />
              </View>
              <Text style={styles.title}>You&apos;re all set</Text>
              <Text style={styles.body}>{body}</Text>
              <Text style={styles.hint}>{hint}</Text>
              <Pressable
                style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                onPress={props.onPrimary}
              >
                <Text style={styles.btnText}>{primaryLabel}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btnOutline, pressed && styles.btnOutlinePressed]}
                onPress={props.onDashboard}
              >
                <Text style={styles.btnOutlineText}>Go to dashboard</Text>
              </Pressable>
            </>
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#5C6478",
    textAlign: "center",
    maxWidth: 300,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#7A8499",
    textAlign: "center",
    maxWidth: 280,
  },
  btn: {
    marginTop: 16,
    width: "100%",
    maxWidth: 320,
    backgroundColor: NAVY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnPressed: {
    backgroundColor: NAVY_DARK,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  btnOutline: {
    marginTop: 10,
    width: "100%",
    maxWidth: 320,
    borderWidth: 2,
    borderColor: NAVY,
    backgroundColor: "#fff",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  btnOutlinePressed: {
    opacity: 0.9,
  },
  btnOutlineText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
  },
});
