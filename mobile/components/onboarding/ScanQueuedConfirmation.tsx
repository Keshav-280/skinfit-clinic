import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";

const NAVY = "#2C3E6B";

type Props = {
  variant?: "dashboard" | "onboarding";
  onContinue: () => void;
  onSecondary: () => void;
};

export function ScanQueuedConfirmation({
  variant = "dashboard",
  onContinue,
  onSecondary,
}: Props) {
  const isOnboarding = variant === "onboarding";

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="notifications-outline" size={32} color={NAVY} />
      </View>
      <Text style={styles.title}>You&apos;re all set</Text>
      <Text style={styles.body}>
        {isOnboarding
          ? "Your baseline photos are saved. Your kAI report will be ready soon — we'll notify you when it's done."
          : "Your photos are saved. Your full report will be delivered soon — we'll notify you when it's ready."}
      </Text>
      <View style={styles.sparkleRow}>
        <Ionicons name="sparkles" size={14} color={NAVY} />
        <Text style={styles.hint}>You can leave this screen — no need to wait here.</Text>
      </View>
      <Pressable style={styles.btn} onPress={onContinue}>
        <Text style={styles.btnText}>{isOnboarding ? "Continue" : "View scan history"}</Text>
      </Pressable>
      <Pressable style={styles.btnOutline} onPress={onSecondary}>
        <Text style={styles.btnOutlineText}>Go to dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.5)",
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(44,62,107,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: "#4B5563",
    textAlign: "center",
  },
  sparkleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  btn: {
    marginTop: 8,
    width: "100%",
    backgroundColor: NAVY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  btnOutline: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(44,62,107,0.2)",
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnOutlineText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
  },
});

function OnboardingQueuedScreen({
  onContinue,
  onDashboard,
}: {
  onContinue: () => void;
  onDashboard: () => void;
}) {
  return (
    <OnboardingLayoutShell title="kAI baseline photos">
      <ScanQueuedConfirmation
        variant="onboarding"
        onContinue={onContinue}
        onSecondary={onDashboard}
      />
    </OnboardingLayoutShell>
  );
}

export { OnboardingQueuedScreen };
