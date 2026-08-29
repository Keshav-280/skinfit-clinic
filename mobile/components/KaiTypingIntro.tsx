import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import {
  KAI_INTRO_LINES,
  KAI_LINE_PAUSE_MS,
  KAI_TYPING_MS_PER_CHAR,
} from "../../src/lib/kaiIntroScript";

const NAVY = "#1E1B31";
const SCREEN_W = Dimensions.get("window").width;
const AVATAR_W = Math.min(SCREEN_W * 0.36, 132);
const AVATAR_H = AVATAR_W * (291 / 132);
const SIDEBAR_AVATAR_H = Math.min(Dimensions.get("window").height * 0.44, 268);
const SIDEBAR_AVATAR_W = SIDEBAR_AVATAR_H * (132 / 291);

type Props = {
  /** When false, only avatar + speech (hero carries the title). */
  showHeader?: boolean;
  /** Tighter layout beside the hero banner on wide screens. */
  variant?: "default" | "sidebar";
  style?: ViewStyle;
};

export function KaiTypingIntro({
  showHeader = true,
  variant = "default",
  style,
}: Props) {
  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const floatY = useRef(new Animated.Value(0)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  const line = KAI_INTRO_LINES[lineIndex] ?? KAI_INTRO_LINES[0];
  const isSidebar = variant === "sidebar";

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -5,
          duration: 2250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatY]);

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0.15,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [cursorOpacity]);

  useEffect(() => {
    setTyped("");
  }, [lineIndex]);

  useEffect(() => {
    if (typed.length >= line.length) {
      const pause = setTimeout(() => {
        setLineIndex((i) => (i + 1) % KAI_INTRO_LINES.length);
      }, KAI_LINE_PAUSE_MS);
      return () => clearTimeout(pause);
    }
    const timer = setTimeout(() => {
      setTyped(line.slice(0, typed.length + 1));
    }, KAI_TYPING_MS_PER_CHAR);
    return () => clearTimeout(timer);
  }, [typed, line]);

  const bubbleContent = (
    <View style={isSidebar ? styles.sidebarBubbleRow : styles.bubbleRow}>
      <View style={styles.bubbleTail} />
      <View style={[styles.bubble, isSidebar && styles.sidebarBubble]}>
        <Text style={[styles.bubbleText, isSidebar && styles.sidebarBubbleText]}>
          {typed}
          <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>
            |
          </Animated.Text>
        </Text>
      </View>
    </View>
  );

  if (isSidebar) {
    return (
      <View style={[styles.sidebarRoot, style]}>
        {showHeader ? (
          <>
            <Text style={styles.sidebarKicker}>YOUR SKIN COMPANION</Text>
            <Text style={styles.sidebarTitle}>
              Meet <Text style={styles.sidebarTitleAccent}>kAI</Text>
            </Text>
          </>
        ) : null}

        <View style={styles.sidebarStage}>
          <Animated.View
            style={[styles.sidebarAvatarWrap, { transform: [{ translateY: floatY }] }]}
          >
            <Image
              source={require("../assets/images/kai-avatar.png")}
              style={styles.sidebarAvatar}
              resizeMode="contain"
              accessibilityLabel="kAI, your SkinFit AI skin companion"
            />
          </Animated.View>
          <View
            style={[
              styles.sidebarBubbleAbs,
              { left: SIDEBAR_AVATAR_W * 0.72 },
            ]}
          >
            {bubbleContent}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {showHeader ? (
        <>
          <Text style={styles.kicker}>YOUR SKIN COMPANION</Text>
          <Text style={styles.title}>
            Meet <Text style={styles.titleAccent}>kAI</Text>
          </Text>
        </>
      ) : null}

      <View style={styles.stageRow}>
        <Animated.View style={[styles.avatarStage, { transform: [{ translateY: floatY }] }]}>
          <Image
            source={require("../assets/images/kai-avatar.png")}
            style={styles.avatar}
            resizeMode="contain"
            accessibilityLabel="kAI, your SkinFit AI skin companion"
          />
        </Animated.View>
        {bubbleContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(30, 27, 49,0.35)",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    marginBottom: 16,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  glowTop: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(91,141,239,0.18)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -50,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(125,211,252,0.1)",
  },
  kicker: {
    textAlign: "center",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "#94b8e8",
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  titleAccent: {
    color: "#9ec5ff",
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  avatarStage: {
    flexShrink: 0,
  },
  avatar: {
    width: AVATAR_W,
    height: AVATAR_H,
  },
  bubbleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  sidebarBubbleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
  },
  bubbleTail: {
    width: 0,
    height: 0,
    marginRight: -1,
    marginTop: 12,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 9,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "rgba(255,255,255,0.7)",
  },
  bubble: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    backgroundColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  sidebarBubble: {
    borderTopLeftRadius: 6,
  },
  bubbleText: {
    minHeight: 72,
    fontSize: 14,
    lineHeight: 20,
    color: "#374151",
    fontWeight: "500",
  },
  sidebarBubbleText: {
    minHeight: 48,
    fontSize: 13,
    lineHeight: 19,
  },
  cursor: {
    color: NAVY,
    fontWeight: "400",
  },
  sidebarRoot: {
    width: "100%",
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  sidebarKicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "rgba(30, 27, 49,0.6)",
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2A44",
    marginTop: 4,
    letterSpacing: -0.4,
  },
  sidebarTitleAccent: {
    color: NAVY,
  },
  sidebarStage: {
    position: "relative",
    minHeight: SIDEBAR_AVATAR_H,
    width: "100%",
    marginTop: 4,
  },
  sidebarAvatarWrap: {
    position: "relative",
    zIndex: 20,
    alignSelf: "flex-start",
  },
  sidebarAvatar: {
    width: SIDEBAR_AVATAR_W,
    height: SIDEBAR_AVATAR_H,
  },
  sidebarBubbleAbs: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 10,
  },
});
