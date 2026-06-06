import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  KAI_INTRO_LINES,
  KAI_LINE_PAUSE_MS,
  KAI_TYPING_MS_PER_CHAR,
} from "../../src/lib/kaiIntroScript";

const NAVY = "#2C3E6B";
const SCREEN_W = Dimensions.get("window").width;
const AVATAR_W = Math.min(SCREEN_W * 0.36, 132);
const AVATAR_H = AVATAR_W * (276 / 125);

export function KaiTypingIntro() {
  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const floatY = useRef(new Animated.Value(0)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  const line = KAI_INTRO_LINES[lineIndex] ?? KAI_INTRO_LINES[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -6,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2400,
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

  return (
    <View style={styles.card}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <Text style={styles.kicker}>YOUR SKIN COMPANION</Text>
      <Text style={styles.title}>
        Meet <Text style={styles.titleAccent}>kAI</Text>
      </Text>

      <View style={styles.stageRow}>
        <Animated.View style={[styles.avatarStage, { transform: [{ translateY: floatY }] }]}>
          <Image
            source={require("../assets/images/kai-avatar.png")}
            style={styles.avatar}
            resizeMode="contain"
            accessibilityLabel="kAI, your SkinFit AI skin companion"
          />
        </Animated.View>

        <View style={styles.bubbleRow}>
          <View style={styles.bubbleTail} />
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              {typed}
              <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>
                |
              </Animated.Text>
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.dots}>
        {KAI_INTRO_LINES.map((_, i) => (
          <View key={i} style={[styles.dot, i === lineIndex && styles.dotActive]} />
        ))}
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
    borderColor: "rgba(44,62,107,0.35)",
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
  bubbleTail: {
    width: 0,
    height: 0,
    marginRight: -1,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderRightWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "#f8fafc",
  },
  bubble: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  bubbleText: {
    minHeight: 72,
    fontSize: 14,
    lineHeight: 20,
    color: "#1e293b",
    fontWeight: "500",
  },
  cursor: {
    color: NAVY,
    fontWeight: "400",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    justifyContent: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dotActive: {
    width: 20,
    backgroundColor: "#7eb8ff",
  },
});
