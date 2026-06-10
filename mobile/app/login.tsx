import { Ionicons } from "@expo/vector-icons";
import { Link, Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { getApiBase } from "@/lib/apiBase";

const PRIMARY = "#5B61E9";
const PRIMARY_DARK = "#4A50D4";
const TEAL = "#2D9B82";

const WEB_PORTAL_URL =
  process.env.EXPO_PUBLIC_WEB_PORTAL_URL?.replace(/\/$/, "") ??
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "";

type SignInMethod = "password" | "otp";

export default function LoginScreen() {
  const { signIn, signInWithEmailOtp, signInWithOAuth, token, ready } = useAuth();
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendOtpLoading, setSendOtpLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  if (!ready) {
    return (
      <View style={[styles.flex, styles.screen]}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 48 }} />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(drawer)" />;
  }

  async function sendLoginOtp() {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Sign in", "Enter your email before requesting a code.");
      return;
    }
    setSendOtpLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/login/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        retryAfterSeconds?: number;
        cooldownSeconds?: number;
      };
      if (!res.ok) {
        if (typeof data.retryAfterSeconds === "number") {
          setResendSeconds(data.retryAfterSeconds);
        }
        throw new Error(data.message || "Could not send sign-in code.");
      }
      setOtpSent(true);
      setOtp("");
      setResendSeconds(
        typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 60
      );
      Alert.alert("Sign in", data.message || "Code sent. Check your inbox.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Sign in", msg);
    } finally {
      setSendOtpLoading(false);
    }
  }

  async function onSubmit() {
    setLoading(true);
    try {
      if (signInMethod === "otp") {
        if (!otpSent) {
          Alert.alert("Sign in", "Send a code to your email first.");
          return;
        }
        await signInWithEmailOtp(email, otp);
      } else {
        await signIn(email, password);
      }
      router.replace("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Sign in", msg);
    } finally {
      setLoading(false);
    }
  }

  function openWebPath(path: string) {
    if (!WEB_PORTAL_URL) {
      Alert.alert("Unavailable", "Web portal URL is not configured.");
      return;
    }
    void Linking.openURL(`${WEB_PORTAL_URL}${path}`);
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
          <Text style={styles.title}>Welcome back 👋</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>Email</Text>
            {signInMethod === "otp" ? (
              <View style={styles.emailOtpRow}>
                <TextInput
                  style={[styles.input, styles.emailOtpInput]}
                  placeholder="Enter email"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setOtpSent(false);
                    setOtp("");
                  }}
                />
                <Pressable
                  style={[
                    styles.sendCodeBtn,
                    (sendOtpLoading || resendSeconds > 0) && styles.sendCodeBtnDisabled,
                  ]}
                  onPress={() => void sendLoginOtp()}
                  disabled={sendOtpLoading || resendSeconds > 0}
                >
                  <Text style={styles.sendCodeBtnText}>
                    {sendOtpLoading
                      ? "…"
                      : resendSeconds > 0
                        ? `${resendSeconds}s`
                        : otpSent
                          ? "Resend"
                          : "Send code"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            )}
          </View>

          {signInMethod === "otp" ? (
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Email sign-in code</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
              />
            </View>
          ) : (
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter password"
                  placeholderTextColor="#9CA3AF"
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
                    color="#9CA3AF"
                  />
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.forgotRow}>
            {signInMethod === "password" ? (
              <>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setSignInMethod("otp");
                    setOtp("");
                    setOtpSent(false);
                    setResendSeconds(0);
                  }}
                >
                  <Text style={styles.forgotLink}>Send a code to your email</Text>
                </Pressable>
                <Link href="/forgot-password" asChild>
                  <Pressable hitSlop={8}>
                    <Text style={styles.forgotLink}>Forgot password?</Text>
                  </Pressable>
                </Link>
              </>
            ) : (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setSignInMethod("password");
                  setOtp("");
                  setOtpSent(false);
                  setResendSeconds(0);
                }}
              >
                <Text style={styles.forgotLink}>Use password instead</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>
                {signInMethod === "otp" ? "Sign in with code" : "Sign In"}
              </Text>
            )}
          </Pressable>

          <Text style={styles.oauthDivider}>OR LOG IN WITH</Text>

          <SocialAuthButtons
            loading={loading}
            divider="none"
            showFacebook
            alwaysShowApple
            onFacebook={() =>
              Alert.alert(
                "Facebook sign-in",
                "Facebook sign-in is not available in the app yet. Use Google, Apple, or email instead."
              )
            }
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

          <View style={styles.staffRow}>
            <Text style={styles.staffText}>
              Clinic staff?{" "}
              <Text style={styles.staffLink} onPress={() => openWebPath("/doctor/login")}>
                Doctor portal
              </Text>
              {" · "}Need help?{" "}
              <Text style={styles.staffLink} onPress={() => openWebPath("/contact")}>
                Contact us
              </Text>
            </Text>
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupHint}>Don&apos;t have an account? </Text>
            <Link href="/signup" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.signupLink}>Sign up</Text>
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
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
    justifyContent: "center",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 36,
    textAlign: "center",
    color: "#111827",
    letterSpacing: -0.5,
  },
  inputWrap: {
    marginBottom: 18,
  },
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
  emailOtpRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  emailOtpInput: {
    flex: 1,
    minWidth: 0,
  },
  sendCodeBtn: {
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  sendCodeBtnDisabled: {
    opacity: 0.6,
  },
  sendCodeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
  forgotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 24,
    marginTop: -4,
  },
  forgotLink: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY,
  },
  button: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
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
  oauthDivider: {
    marginTop: 28,
    marginBottom: 20,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 1.2,
  },
  staffRow: {
    marginTop: 32,
    paddingHorizontal: 4,
  },
  staffText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  staffLink: {
    color: TEAL,
    fontWeight: "600",
  },
  signupRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  signupHint: {
    fontSize: 14,
    color: "#111827",
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
});
