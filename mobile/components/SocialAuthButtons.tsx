import { Ionicons } from "@expo/vector-icons";
import { Alert, Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/Themed";
import {
  getGoogleSignInConfigStatus,
  googleSignInConfigHint,
  isAppleSignInAvailable,
} from "@/lib/oauthSignIn";

function AppleIcon({ size = 22, color = "#000" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-2.032 1.58-3.006 1.56-.126-1.085.468-2.28 1.148-3.02.77-.83 2.122-1.46 3.035-1.5.018 1.287-.397 2.464-1 2.88zM20.98 17.3c-.588 1.35-.861 1.937-1.612 3.14-1.045 1.675-2.523 3.76-4.355 3.78-1.625.02-2.04-1.05-4.237-1.05-2.197 0-2.648 1.03-4.27 1.07-1.813.04-3.195-1.85-4.24-3.52-2.305-3.7-2.55-8.04-1.126-10.35 1.004-1.72 2.59-2.73 4.09-2.73 1.887 0 3.075 1.09 4.63 1.09 1.488 0 2.4-1.09 4.12-1.09 1.474 0 2.808.85 3.703 2.33-3.216 1.7-2.693 6.16.852 7.41-.185.51-.388 1.01-.737 1.71z"
      />
    </Svg>
  );
}

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

const ICON_SIZE = 52;
const SQUARE_ICON_SIZE = 56;

type Props = {
  onGoogle: () => void;
  onApple: () => void;
  onFacebook?: () => void;
  loading?: boolean;
  disabled?: boolean;
  showFacebook?: boolean;
  alwaysShowApple?: boolean;
  divider?: "none" | "before" | "after";
  dividerLabel?: string;
  dividerUppercase?: boolean;
  iconShape?: "circle" | "square";
  iconOrder?: "google-first" | "facebook-first";
  facebookStyle?: "filled" | "outlined";
};

export function SocialAuthButtons({
  onGoogle,
  onApple,
  onFacebook,
  loading,
  disabled,
  showFacebook = false,
  alwaysShowApple = false,
  divider = "after",
  dividerLabel = "or",
  dividerUppercase = true,
  iconShape = "circle",
  iconOrder = "google-first",
  facebookStyle = "filled",
}: Props) {
  const googleStatus = getGoogleSignInConfigStatus();
  const showGoogle = true;
  const googleReady =
    googleStatus === "ready" ||
    googleStatus === "needs_native_build" ||
    googleStatus === "needs_web_client_id";
  const appleReady = isAppleSignInAvailable();
  const showApple = alwaysShowApple || appleReady;
  const googleHint = googleSignInConfigHint();

  if (!showGoogle && !showApple && !showFacebook) {
    return null;
  }

  const blocked = Boolean(loading || disabled);
  const iconSize = iconShape === "square" ? SQUARE_ICON_SIZE : ICON_SIZE;
  const iconBtnStyle: ViewStyle = {
    width: iconSize,
    height: iconSize,
    borderRadius: iconShape === "square" ? 12 : iconSize / 2,
  };

  function onGooglePress() {
    if (googleReady && !blocked) {
      onGoogle();
      return;
    }
    if (googleHint) {
      Alert.alert("Google sign-in", googleHint);
    }
  }

  function onFacebookPress() {
    if (blocked) return;
    if (onFacebook) {
      onFacebook();
      return;
    }
    Alert.alert(
      "Facebook sign-in",
      "Facebook sign-in is not available in the app yet."
    );
  }

  const dividerNode =
    divider === "none" ? null : (
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text
          style={[styles.dividerText, !dividerUppercase && styles.dividerTextNormal]}
        >
          {dividerLabel}
        </Text>
        <View style={styles.dividerLine} />
      </View>
    );

  const googleBtn = showGoogle ? (
    <Pressable
      key="google"
      style={({ pressed }) => [
        styles.iconBtn,
        iconBtnStyle,
        styles.iconBtnLight,
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
  ) : null;

  const facebookBtn = showFacebook ? (
    <Pressable
      key="facebook"
      style={({ pressed }) => [
        styles.iconBtn,
        iconBtnStyle,
        facebookStyle === "filled" ? styles.iconBtnFacebook : styles.iconBtnLight,
        blocked && styles.iconBtnDisabled,
        pressed && !blocked && styles.iconBtnPressed,
      ]}
      onPress={onFacebookPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel="Continue with Facebook"
    >
      <Ionicons
        name="logo-facebook"
        size={24}
        color={facebookStyle === "filled" ? "#fff" : "#1877F2"}
      />
    </Pressable>
  ) : null;

  const appleBtn = showApple ? (
    <Pressable
      key="apple"
      style={({ pressed }) => [
        styles.iconBtn,
        iconBtnStyle,
        styles.iconBtnLight,
        (!appleReady || blocked) && styles.iconBtnDisabled,
        pressed && appleReady && !blocked && styles.iconBtnPressed,
      ]}
      onPress={() => {
        if (appleReady && !blocked) {
          onApple();
          return;
        }
        if (!appleReady) {
          Alert.alert(
            "Apple sign-in",
            Platform.OS === "ios"
              ? "Sign in with Apple requires a paid Apple Developer account. Set EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGNIN=1 and rebuild, or use Google or email."
              : "Set EXPO_PUBLIC_APPLE_SERVICES_ID for Apple sign-in on Android."
          );
        }
      }}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
      accessibilityState={{ disabled: !appleReady || blocked }}
    >
      <AppleIcon size={22} />
    </Pressable>
  ) : null;

  const iconButtons =
    iconOrder === "facebook-first"
      ? [facebookBtn, googleBtn, appleBtn]
      : [googleBtn, facebookBtn, appleBtn];

  return (
    <View style={styles.wrap}>
      {divider === "before" ? dividerNode : null}

      <View style={styles.iconRow}>{iconButtons}</View>

      {googleHint ? (
        <Text style={styles.hint}>{googleHint}</Text>
      ) : Platform.OS === "android" && showGoogle && !showApple ? (
        <Text style={styles.hint}>
          Add EXPO_PUBLIC_APPLE_SERVICES_ID for Apple sign-in on Android.
        </Text>
      ) : null}

      {divider === "after" ? dividerNode : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  iconBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  iconBtnLight: {
    backgroundColor: "#fff",
  },
  iconBtnFacebook: {
    backgroundColor: "#1877F2",
    borderColor: "#1877F2",
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
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8ECF4",
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8391A1",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dividerTextNormal: {
    textTransform: "none",
    letterSpacing: 0,
    fontSize: 13,
    fontWeight: "500",
  },
});
