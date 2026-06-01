import { LinearGradient } from "expo-linear-gradient";
import { Link, Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl, networkFetchErrorMessage } from "@/lib/api";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";

export default function SignupScreen() {
  const { signUp, signInWithOAuth, token, ready } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [sendOtpLoading, setSendOtpLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(
      () => setResendSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  if (!ready) {
    return (
      <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
        <ActivityIndicator size="large" color={NAVY} style={{ marginTop: 48 }} />
      </LinearGradient>
    );
  }

  if (token) {
    return <Redirect href="/" />;
  }

  async function sendSignupOtp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert("Sign up", "Enter your email before requesting a code.");
      return;
    }
    setSendOtpLoading(true);
    setOtpHint(null);
    try {
      const res = await fetch(apiUrl("/api/auth/signup/send-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        retryAfterSeconds?: number;
        cooldownSeconds?: number;
      };
      if (!res.ok) {
        Alert.alert(
          "Verification code",
          typeof data.message === "string"
            ? data.message
            : "Could not send verification code."
        );
        if (typeof data.retryAfterSeconds === "number") {
          setResendSeconds(data.retryAfterSeconds);
        }
        return;
      }
      setOtp("");
      setOtpHint(
        typeof data.message === "string"
          ? data.message
          : "Code sent. Check your inbox."
      );
      setResendSeconds(
        typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 60
      );
    } catch {
      Alert.alert("Verification code", networkFetchErrorMessage());
    } finally {
      setSendOtpLoading(false);
    }
  }

  async function onSubmit() {
    setLoading(true);
    try {
      await signUp({ name, email, phone, password, phoneCountryCode: "+91", otp });
      router.replace("/onboarding");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Sign up", msg);
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.brand}>Create account</Text>
            <Text style={styles.subtitle}>Complete onboarding in the app</Text>

            <SocialAuthButtons
              loading={loading}
              onGoogle={async () => {
                setLoading(true);
                try {
                  await signInWithOAuth("google");
                  router.replace("/onboarding");
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
                  router.replace("/onboarding");
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Something went wrong.";
                  Alert.alert("Apple sign in", msg);
                } finally {
                  setLoading(false);
                }
              }}
            />

            <View style={styles.inputWrap}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.emailRow}>
                <TextInput
                  style={[styles.input, styles.emailInput]}
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setOtp("");
                    setOtpHint(null);
                  }}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.sendCodeBtn,
                    (sendOtpLoading || resendSeconds > 0 || loading) &&
                      styles.sendCodeBtnDisabled,
                    pressed && styles.sendCodeBtnPressed,
                  ]}
                  onPress={sendSignupOtp}
                  disabled={sendOtpLoading || resendSeconds > 0 || loading}
                >
                  {sendOtpLoading ? (
                    <ActivityIndicator color={NAVY} size="small" />
                  ) : (
                    <Text style={styles.sendCodeLabel}>
                      {resendSeconds > 0 ? `${resendSeconds}s` : "Send code"}
                    </Text>
                  )}
                </Pressable>
              </View>
              {otpHint ? <Text style={styles.otpHint}>{otpHint}</Text> : null}
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(value) =>
                  setOtp(value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min 8 characters"
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
                <Text style={styles.buttonLabel}>Sign up</Text>
              )}
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={styles.loginHint}>Already have an account?</Text>
              <Link href="/login" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.loginLink}>Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
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
  emailRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  emailInput: {
    flex: 1,
    minWidth: 0,
  },
  sendCodeBtn: {
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
    minWidth: 92,
  },
  sendCodeBtnPressed: {
    opacity: 0.85,
  },
  sendCodeBtnDisabled: {
    opacity: 0.6,
  },
  sendCodeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  otpHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#047857",
    marginLeft: 2,
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
  loginRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  loginHint: {
    fontSize: 14,
    color: "#6B7280",
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
  },
});
