import { Ionicons } from "@expo/vector-icons";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/Themed";
import {
  getGoogleSignInConfigStatus,
  googleSignInConfigHint,
  isAppleSignInAvailable,
} from "@/lib/oauthSignIn";

function GoogleMulticolorIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

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
            <GoogleMulticolorIcon size={22} />
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
