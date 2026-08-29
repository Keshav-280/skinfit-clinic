import { LinearGradient } from "expo-linear-gradient";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const NAVY = "#1E1B31";
const NAVY_DARK = "#242A5F";

export default function WellnessScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[NAVY, NAVY_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Track your wellness journey</Text>
            <Text style={styles.subtitle}>
              Skin care and wellness begins from within. Let&apos;s track your
              weekly goals.
            </Text>
          </View>
          <Image
            source={require("@/assets/images/dr-ruby-cutout.png")}
            style={styles.doctor}
            resizeMode="contain"
          />
        </LinearGradient>

        <View style={styles.sheet}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Coming soon</Text>
            <Text style={styles.cardBody}>
              Holistic health tracking is currently in development — same as the
              web portal.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: NAVY,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: "#FAF8F5",
  },
  header: {
    height: 240,
    paddingHorizontal: 24,
    paddingTop: 28,
    overflow: "hidden",
    position: "relative",
  },
  headerTextWrap: {
    maxWidth: "60%",
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 10,
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 20,
  },
  doctor: {
    position: "absolute",
    right: 0,
    bottom: 0,
    height: 220,
    width: 192,
  },
  sheet: {
    flex: 1,
    backgroundColor: "#FAF8F5",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 28,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
  },
  cardBody: {
    marginTop: 12,
    fontSize: 15,
    color: "#52525b",
    textAlign: "center",
    lineHeight: 22,
  },
});
