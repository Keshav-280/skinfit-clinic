import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

import {
  KAI_INTRO_LINES,
  KAI_LINE_PAUSE_MS,
  KAI_TYPING_MS_PER_CHAR,
} from "../../src/lib/kaiIntroScript";

const NAVY = "#1E3264";
const TEXT_NAVY = "#1F2A44";

const WIDE_BREAKPOINT = 768;

function SparkleHalo({ size }: { size: number }) {
  const dots = Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    const radius = 46 + (i % 3) * 2;
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    const r = i % 4 === 0 ? 3.5 : i % 2 === 0 ? 2.5 : 1.8;
    const opacity = 0.35 + (i % 5) * 0.12;
    return { x, y, r, opacity, key: i };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={styles.sparkle}>
      {dots.map((dot) => (
        <Circle
          key={dot.key}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          fill="#fff"
          opacity={dot.opacity}
        />
      ))}
    </Svg>
  );
}

export function KaiMeetIntroCard() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const floatY = useRef(new Animated.Value(0)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  const line = KAI_INTRO_LINES[lineIndex] ?? KAI_INTRO_LINES[0];
  const avatarHeight = isWide ? Math.min(width * 0.22, 268) : Math.min(width * 0.52, 220);
  const avatarWidth = avatarHeight * (132 / 291);
  const haloSize = avatarHeight * 1.05;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -6,
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

  return (
    <View style={[styles.card, isWide && styles.cardWide]}>
      <LinearGradient
        colors={["#7B8EC8", "#8B96D8", "#A8B5E0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.inner, isWide && styles.innerWide]}>
        <View style={[styles.copyCol, isWide && styles.copyColWide]}>
          <Text style={styles.meet}>Meet</Text>
          <Text style={styles.kaiTitle}>kAI</Text>
          <Text style={styles.kicker}>YOUR SKIN COMPANION</Text>

          <View style={styles.typedWrap}>
            <Text style={styles.typedText}>
              {typed}
              <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>
                |
              </Animated.Text>
            </Text>
          </View>
        </View>

        <View style={[styles.avatarCol, isWide && styles.avatarColWide]}>
          <SparkleHalo size={haloSize} />
          <Animated.View style={{ transform: [{ translateY: floatY }] }}>
            <Image
              source={require("../assets/images/kai-avatar.png")}
              style={{ width: avatarWidth, height: avatarHeight }}
              resizeMode="contain"
              accessibilityLabel="kAI, your SkinFit AI skin companion"
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2C3E6B",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 16,
  },
  cardWide: {
    minHeight: 280,
  },
  inner: {
    flexDirection: "column",
  },
  innerWide: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 280,
  },
  copyCol: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 12,
    justifyContent: "center",
  },
  copyColWide: {
    maxWidth: "58%",
    paddingTop: 32,
    paddingBottom: 32,
  },
  meet: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: -0.2,
  },
  kaiTitle: {
    marginTop: 2,
    fontSize: 52,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1,
    lineHeight: 52,
  },
  kicker: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.4,
    color: "rgba(255,255,255,0.95)",
  },
  typedWrap: {
    marginTop: 20,
    minHeight: 88,
  },
  typedText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    color: TEXT_NAVY,
  },
  cursor: {
    color: NAVY,
  },
  avatarCol: {
    position: "relative",
    minHeight: 220,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  avatarColWide: {
    width: "42%",
    minHeight: 0,
    paddingHorizontal: 8,
  },
  sparkle: {
    position: "absolute",
    bottom: "8%",
    right: "8%",
    opacity: 0.9,
  },
});
