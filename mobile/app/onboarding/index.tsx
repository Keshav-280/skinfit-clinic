import { useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const TEAL = "#0d9488";

export default function OnboardingWelcome() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>SkinFit Wellness</Text>
      <Text style={styles.title}>Welcome to your skin journey</Text>
      <Text style={styles.body}>
        Your doctor has prepared a short welcome — next you will meet kAI, our analysis assistant, and
        complete a guided skin assessment (about 10 minutes).
      </Text>
      <View style={styles.videoPlaceholder}>
        <Text style={styles.videoNote}>
          Doctor welcome video — add your MP4 to assets and replace this placeholder.
        </Text>
      </View>
      <Pressable
        style={styles.btn}
        onPress={() => router.push("/onboarding/kai-intro" as Href)}
      >
        <Text style={styles.btnText}>Begin my skin assessment</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: TEAL,
    textAlign: "center",
  },
  title: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: "800",
    color: "#18181b",
    textAlign: "center",
  },
  body: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: "#52525b",
    textAlign: "center",
  },
  videoPlaceholder: {
    marginTop: 24,
    minHeight: 180,
    borderRadius: 16,
    backgroundColor: "#e4e4e7",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  videoNote: { fontSize: 13, color: "#71717a", textAlign: "center" },
  btn: {
    marginTop: 28,
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
