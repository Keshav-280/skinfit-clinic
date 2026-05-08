import { Link, Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/Colors";

export default function LoginScreen() {
  const accent = Colors.light.tint;
  const { signIn, token, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!ready) {
    return (
      <View style={styles.flex}>
        <ActivityIndicator size="large" style={{ marginTop: 48 }} />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(drawer)" />;
  }

  async function onSubmit() {
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Sign in", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <View style={styles.inner}>
        <View style={styles.card}>
          <Text style={styles.brand}>SkinFit Clinic</Text>
          <Text style={styles.subtitle}>Patient app</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable style={[styles.button, { backgroundColor: accent }]} onPress={onSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>Sign in</Text>
            )}
          </Pressable>
          <View style={styles.signupRow}>
            <Text style={styles.signupHint}>New here?</Text>
            <Link href="/signup" asChild>
              <Pressable hitSlop={8}>
                <Text style={[styles.signupLink, { color: accent }]}>Create account</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8f5ef" },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
    textAlign: "center",
    color: "#18181b",
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  signupRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  signupHint: {
    fontSize: 14,
    opacity: 0.75,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
