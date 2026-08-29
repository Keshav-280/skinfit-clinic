import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

const NAVY = "#1E1B31";

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
      <Text style={styles.title}>We&apos;ll notify you when it&apos;s ready.</Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressedBtn]}
          onPress={onContinue}
        >
          <Text style={styles.btnText}>{isOnboarding ? "Continue" : "View scan history"}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressedBtn]}
          onPress={onSecondary}
        >
          <Text style={styles.btnOutlineText}>Go to dashboard</Text>
        </Pressable>
      </View>
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
    gap: 16,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(30, 27, 49,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 280,
  },
  actions: {
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  btnPrimary: {
    width: "100%",
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  btnSecondary: {
    width: "100%",
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: NAVY,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutlineText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
  },
  pressedBtn: { opacity: 0.88 },
});
