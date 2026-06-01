import { Ionicons } from "@expo/vector-icons";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/Themed";
import {
  getGoogleSignInConfigStatus,
  googleSignInConfigHint,
  isAppleSignInAvailable,
} from "@/lib/oauthSignIn";

const ICON_SIZE = 48;

type Props = {
  onGoogle: () => void;
  onApple: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function SocialAuthButtons({
  onGoogle,
  onApple,
  loading,
  disabled,
}: Props) {
  const googleStatus = getGoogleSignInConfigStatus();
  const showGoogle = true;
  const googleReady =
    googleStatus === "ready" ||
    googleStatus === "needs_native_build" ||
    googleStatus === "needs_web_client_id";
  const showApple = isAppleSignInAvailable();
  const googleHint = googleSignInConfigHint();

  if (!showGoogle && !showApple) {
    return null;
  }

  const blocked = Boolean(loading || disabled);

  function onGooglePress() {
    if (googleReady && !blocked) {
      onGoogle();
      return;
    }
    if (googleHint) {
      Alert.alert("Google sign-in", googleHint);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.iconRow}>
        {showGoogle ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              styles.iconBtnGoogle,
              (!googleReady || blocked) && styles.iconBtnDisabled,
              pressed && googleReady && !blocked && styles.iconBtnPressed,
            ]}
            onPress={onGooglePress}
            disabled={blocked}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: !googleReady || blocked }}
          >
            <Ionicons name="logo-google" size={22} color="#4285F4" />
          </Pressable>
        ) : null}

        {showApple ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              styles.iconBtnApple,
              blocked && styles.iconBtnDisabled,
              pressed && !blocked && styles.iconBtnPressed,
            ]}
            onPress={onApple}
            disabled={blocked}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
          >
            <Ionicons name="logo-apple" size={24} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {googleHint ? (
        <Text style={styles.hint}>{googleHint}</Text>
      ) : Platform.OS === "android" && showGoogle && !showApple ? (
        <Text style={styles.hint}>
          Add EXPO_PUBLIC_APPLE_SERVICES_ID for Apple sign-in on Android.
        </Text>
      ) : null}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    gap: 10,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  iconBtn: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  iconBtnGoogle: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
  },
  iconBtnApple: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  iconBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  iconBtnDisabled: {
    opacity: 0.45,
  },
  hint: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 15,
    paddingHorizontal: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
