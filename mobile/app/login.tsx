import { LinearGradient } from "expo-linear-gradient";
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
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBase } from "@/lib/apiBase";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";

export default function LoginScreen() {
  const { signIn, signInWithOAuth, token, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!ready) {
    return (
      <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
        <ActivityIndicator size="large" color={NAVY} style={{ marginTop: 48 }} />
      </LinearGradient>
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
    <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.inner}>
          <View style={styles.card}>
            <Text style={styles.brand}>SkinFit Clinic</Text>
            <Text style={styles.subtitle}>Patient app</Text>

            <SocialAuthButtons
              loading={loading}
              onGoogle={async () => {
                setLoading(true);
                try {
                  await signInWithOAuth("google");
                  router.replace("/");
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Something went wrong.";
                  Alert.alert("Google sign in", msg);
                } finally {
                  setLoading(false);
                }
              }}
              onApple={async () => {
                setLoading(true);
                try {
                  await signInWithOAuth("apple");
                  router.replace("/");
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Something went wrong.";
                  Alert.alert("Apple sign in", msg);
                } finally {
                  setLoading(false);
                }
              }}
            />

            <View style={styles.inputWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={onSubmit}
              disabled={loading}
            >
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
                  <Text style={styles.signupLink}>Create account</Text>
                </Pressable>
              </Link>
            </View>
            <Text style={styles.apiFootnote} selectable>
              Server: {getApiBase()}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  brand: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 4,
    textAlign: "center",
    color: "#1A1A2E",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 28,
    textAlign: "center",
    fontWeight: "500",
  },
  inputWrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: "#F3F4F6",
    color: "#1A1A2E",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: NAVY,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  buttonPressed: {
    backgroundColor: NAVY_DARK,
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  signupRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  signupHint: {
    fontSize: 14,
    color: "#6B7280",
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
  },
  apiFootnote: {
    marginTop: 12,
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
