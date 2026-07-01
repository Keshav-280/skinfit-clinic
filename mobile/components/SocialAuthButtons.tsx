import { Alert, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/Themed";
import {
  getGoogleSignInConfigStatus,
  googleSignInConfigHint,
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

type Props = {
  onGoogle: () => void;
  loading?: boolean;
  disabled?: boolean;
  divider?: "none" | "before" | "after";
  dividerLabel?: string;
  dividerUppercase?: boolean;
};

export function SocialAuthButtons({
  onGoogle,
  loading,
  disabled,
  divider = "after",
  dividerLabel = "or",
  dividerUppercase = true,
}: Props) {
  const googleStatus = getGoogleSignInConfigStatus();
  const googleReady =
    googleStatus === "ready" ||
    googleStatus === "needs_native_build" ||
    googleStatus === "needs_web_client_id";
  const googleHint = googleSignInConfigHint();

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

  return (
    <View style={styles.wrap}>
      {divider === "before" ? dividerNode : null}

      <Pressable
        style={({ pressed }) => [
          styles.googleBar,
          (!googleReady || blocked) && styles.googleBarDisabled,
          pressed && googleReady && !blocked && styles.googleBarPressed,
        ]}
        onPress={onGooglePress}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: !googleReady || blocked }}
      >
        <GoogleMulticolorIcon size={22} />
        <Text style={styles.googleBarLabel}>Continue with Google</Text>
      </Pressable>

      {googleHint ? <Text style={styles.hint}>{googleHint}</Text> : null}

      {divider === "after" ? dividerNode : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  googleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: "100%",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    backgroundColor: "#fff",
  },
  googleBarLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E232C",
  },
  googleBarPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  googleBarDisabled: {
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
