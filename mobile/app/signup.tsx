import { Ionicons } from "@expo/vector-icons";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/Themed";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl, networkFetchErrorMessage } from "@/lib/api";

const DARK = "#1E232C";
const DARK_PRESSED = "#111820";
const LINK = "#35C2C1";
const INPUT_BG = "#F7F8F9";
const BORDER = "#E8ECF4";
const PLACEHOLDER = "#8391A1";

export default function SignupScreen() {
  const { signUp, signInWithOAuth, token, ready } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      <View style={[styles.flex, styles.screen]}>
        <ActivityIndicator size="large" color={DARK} style={{ marginTop: 48 }} />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/" />;
  }

  function onBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/login");
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
    if (password !== confirmPassword) {
      Alert.alert("Sign up", "Passwords do not match.");
      return;
    }
    if (!otp.trim()) {
      Alert.alert("Sign up", "Enter the verification code sent to your email.");
      return;
    }
    setLoading(true);
    try {
      await signUp({ name, email, phone, password, phoneCountryCode: "+91", otp });
      router.replace("/onboarding/kai-intro");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Sign up", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.flex, styles.screen]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={DARK} />
          </Pressable>

          <Text style={styles.title}>
            Hello! Register to{"\n"}get started
          </Text>

          <View style={styles.field}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={PLACEHOLDER}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={PLACEHOLDER}
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
          </View>

          <View style={styles.field}>
            <View style={styles.otpRow}>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="Verification code"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(value) =>
                  setOtp(value.replace(/\D/g, "").slice(0, 6))
                }
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
                  <ActivityIndicator color={DARK} size="small" />
                ) : (
                  <Text style={styles.sendCodeLabel}>
                    {resendSeconds > 0 ? `${resendSeconds}s` : "Send code"}
                  </Text>
                )}
              </Pressable>
            </View>
            {otpHint ? <Text style={styles.otpHint}>{otpHint}</Text> : null}
          </View>

          <View style={styles.field}>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={PLACEHOLDER}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Confirm password"
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowConfirmPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                }
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={PLACEHOLDER}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor={PLACEHOLDER}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
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
              <Text style={styles.buttonLabel}>Register</Text>
            )}
          </Pressable>

          <SocialAuthButtons
            loading={loading}
            divider="before"
            dividerLabel="Or Register with"
            dividerUppercase={false}
            onGoogle={async () => {
              setLoading(true);
              try {
                await signInWithOAuth("google");
                router.replace("/onboarding/kai-intro");
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Something went wrong.";
                Alert.alert("Google sign in", msg);
              } finally {
                setLoading(false);
              }
            }}
          />

          <View style={styles.loginRow}>
            <Text style={styles.loginHint}>Already have an account? </Text>
            <Link href="/login" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.loginLink}>Login Now</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  backBtnPressed: {
    opacity: 0.75,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: DARK,
    lineHeight: 38,
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  field: {
    marginBottom: 14,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: INPUT_BG,
    color: DARK,
    borderWidth: 1,
    borderColor: BORDER,
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  otpInput: {
    flex: 1,
    minWidth: 0,
  },
  sendCodeBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 96,
  },
  sendCodeBtnPressed: {
    opacity: 0.85,
  },
  sendCodeBtnDisabled: {
    opacity: 0.55,
  },
  sendCodeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: DARK,
  },
  otpHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
  },
  passwordRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    height: "100%",
    justifyContent: "center",
  },
  button: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: DARK,
  },
  buttonPressed: {
    backgroundColor: DARK_PRESSED,
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  loginRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginHint: {
    fontSize: 14,
    color: "#6B7280",
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: LINK,
  },
});
