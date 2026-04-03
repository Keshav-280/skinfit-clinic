import { StyleSheet, Text, View } from "react-native";

export default function WellnessScreen() {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.body}>
          Holistic health tracking is currently in development — same as the web portal.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#fdf9f0",
    justifyContent: "center",
    padding: 24,
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
  title: { fontSize: 26, fontWeight: "700", color: "#0f766e", textAlign: "center" },
  body: { marginTop: 12, fontSize: 15, color: "#52525b", textAlign: "center", lineHeight: 22 },
});
