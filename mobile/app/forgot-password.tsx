import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
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
import { apiUrl, networkFetchErrorMessage } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiErrorMessage";

const PRIMARY = "#5B61E9";
const PRIMARY_DARK = "#4A50D4";
const PLACEHOLDER = "#9CA3AF";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [sentHint, setSentHint] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(
      () => setResendSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  function onBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/login");
  }

  async function sendCode() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert("Reset password", "Enter your email first.");
      return;
    }
    setSendLoading(true);
    setSentHint(null);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        retryAfterSeconds?: number;
        cooldownSeconds?: number;
      };
      if (!res.ok) {
        Alert.alert(
          "Reset password",
          apiErrorMessage(data, res.status, "Could not send reset code.")
        );
        if (typeof data.retryAfterSeconds === "number") {
          setResendSeconds(data.retryAfterSeconds);
        }
        return;
      }
      setOtp("");
      setSentHint(
        typeof data.message === "string"
          ? data.message
          : "If an account exists, check your inbox for a reset code."
      );
      setResendSeconds(
        typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 60
      );
    } catch {
      Alert.alert("Reset password", networkFetchErrorMessage());
    } finally {
      setSendLoading(false);
    }
  }

  async function onReset() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert("Reset password", "Enter your email.");
      return;
    }
    if (!otp.trim()) {
      Alert.alert("Reset password", "Enter the 6-digit code from your email.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Reset password", "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Reset password", "Passwords do not match.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          otp: otp.trim(),
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        Alert.alert(
          "Reset password",
          apiErrorMessage(data, res.status, "Could not reset password.")
        );
        return;
      }
      Alert.alert(
        "Password updated",
        typeof data.message === "string"
          ? data.message
          : "You can sign in with your new password.",
        [{ text: "Sign in", onPress: () => router.replace("/login") }]
      );
    } catch {
      Alert.alert("Reset password", networkFetchErrorMessage());
    } finally {
      setResetLoading(false);
    }
  }

  const busy = sendLoading || resetLoading;

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
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </Pressable>

          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.subtitle}>
            Enter your email and we&apos;ll send a 6-digit code to reset your password.
          </Text>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email"
              placeholderTextColor={PLACEHOLDER}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setOtp("");
                setSentHint(null);
              }}
              editable={!busy}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              (sendLoading || resendSeconds > 0 || resetLoading) &&
                styles.secondaryBtnDisabled,
              pressed && styles.secondaryBtnPressed,
            ]}
            onPress={sendCode}
            disabled={sendLoading || resendSeconds > 0 || resetLoading}
          >
            {sendLoading ? (
              <ActivityIndicator color={PRIMARY} />
            ) : (
              <Text style={styles.secondaryBtnLabel}>
                {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Send reset code"}
              </Text>
            )}
          </Pressable>

          {sentHint ? <Text style={styles.hint}>{sentHint}</Text> : null}

          <View style={[styles.inputWrap, { marginTop: 20 }]}>
            <Text style={styles.label}>Reset code</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={PLACEHOLDER}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(value) =>
                setOtp(value.replace(/\D/g, "").slice(0, 6))
              }
              editable={!busy}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>New password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="At least 8 characters"
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={PLACEHOLDER}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Repeat new password"
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!busy}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowConfirmPassword((v) => !v)}
                hitSlop={8}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={PLACEHOLDER}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={onReset}
            disabled={busy}
          >
            {resetLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>Reset password</Text>
            )}
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginHint}>Remember your password? </Text>
            <Link href="/login" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.loginLink}>Sign in</Text>
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
  screen: { backgroundColor: "#FFFFFF" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
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
    borderColor: "#E8ECF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  backBtnPressed: { opacity: 0.75 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 28,
  },
  inputWrap: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: "#F3F4F6",
    color: "#111827",
    borderWidth: 0,
  },
  passwordRow: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: "absolute",
    right: 14,
    height: "100%",
    justifyContent: "center",
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  secondaryBtnPressed: { opacity: 0.85 },
  secondaryBtnDisabled: { opacity: 0.55 },
  secondaryBtnLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: PRIMARY,
  },
  hint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
  },
  button: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: PRIMARY,
  },
  buttonPressed: {
    backgroundColor: PRIMARY_DARK,
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  loginRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginHint: { fontSize: 14, color: "#111827" },
  loginLink: { fontSize: 14, fontWeight: "700", color: PRIMARY },
});
