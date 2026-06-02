import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";

export default function OnboardingWelcome() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/login" as Href);
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  return (
    <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>SKINFIT WELLNESS</Text>
        <Text style={styles.title}>Welcome to your{"\n"}skin journey</Text>
        
        <View style={styles.videoPlaceholder}>
          <View style={styles.playCircle}>
            <Text style={styles.playIcon}>{"▶"}</Text>
          </View>
          <Text style={styles.videoNote}>
            Doctor welcome video — add your MP4 to assets and replace this placeholder.
          </Text>
        </View>

        <View style={styles.actionContainer}>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={() => router.push("/onboarding/kai-intro" as Href)}
          >
            <Text style={styles.btnText}>Begin my skin assessment</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={18} color="#52525b" style={{ marginRight: 6 }} />
            <Text style={styles.signOutBtnText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  kicker: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: NAVY,
    textAlign: "center",
  },
  title: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A2E",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  videoPlaceholder: {
    marginTop: 28,
    minHeight: 200,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  playIcon: { color: "#fff", fontSize: 20, marginLeft: 3 },
  videoNote: { fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 19 },
  actionContainer: {
    marginTop: 28,
    gap: 12,
  },
  btn: {
    backgroundColor: NAVY,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  btnPressed: {
    backgroundColor: NAVY_DARK,
    transform: [{ scale: 0.98 }],
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  
  // Sign out button
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    paddingVertical: 15,
    borderRadius: 16,
  },
  signOutBtnPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    transform: [{ scale: 0.98 }],
  },
  signOutBtnText: {
    color: "#52525b",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
