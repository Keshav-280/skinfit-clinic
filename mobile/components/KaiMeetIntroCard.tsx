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
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import {
  KAI_INTRO_LINES,
  KAI_LINE_PAUSE_MS,
  KAI_TYPING_MS_PER_CHAR,
} from "../../src/lib/kaiIntroScript";
import {
  KAI_MEET_CARD,
  meetCardBackgroundDots,
  meetCardHaloDots,
} from "../../src/lib/kaiMeetIntroCardVisual";

const WIDE_BREAKPOINT = 768;

const BG_DOTS = meetCardBackgroundDots();
const HALO_DOTS = meetCardHaloDots();

function BackgroundDots() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFillObject}
    >
      {BG_DOTS.map((dot) => (
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

function HaloDots({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {HALO_DOTS.map((dot) => (
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

function CardGradient() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
      <Defs>
        <RadialGradient id="kaiMeetGlow" cx="72%" cy="48%" rx="55%" ry="65%">
          <Stop offset="0%" stopColor={KAI_MEET_CARD.gradient.glow} stopOpacity="1" />
          <Stop offset="55%" stopColor={KAI_MEET_CARD.gradient.mid} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={KAI_MEET_CARD.gradient.deep} />
      <Rect width="100%" height="100%" fill="url(#kaiMeetGlow)" />
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
  const cardMinHeight = isWide ? KAI_MEET_CARD.minHeightWide : KAI_MEET_CARD.minHeightPhone;
  const avatarHeight = isWide
    ? Math.min(cardMinHeight * 0.92, 400)
    : Math.min(width * 0.58, 280);
  const avatarWidth = avatarHeight * (132 / 291);
  const haloSize = Math.min(avatarHeight * 1.08, isWide ? 380 : 300);

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

  return (
    <View style={[styles.card, { minHeight: cardMinHeight }]}>
      <LinearGradient
        colors={[
          KAI_MEET_CARD.gradient.mid,
          KAI_MEET_CARD.gradient.edge,
          KAI_MEET_CARD.gradient.deep,
        ]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.gradientOverlay} pointerEvents="none">
        <CardGradient />
      </View>
      <BackgroundDots />

      <View style={[styles.inner, isWide && styles.innerWide, { minHeight: cardMinHeight }]}>
        <View style={[styles.copyCol, isWide && styles.copyColWide]}>
          <Text style={styles.meet}>Meet</Text>
          <Text style={[styles.kaiTitle, isWide && styles.kaiTitleWide]}>kAI</Text>
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
          <View style={styles.avatarStage}>
            <Animated.View
              style={[
                styles.avatarFloat,
                { transform: [{ translateY: floatY }] },
              ]}
            >
              <View
                style={[
                  styles.avatarFrame,
                  { width: avatarWidth, height: avatarHeight },
                ]}
              >
                <View
                  style={[
                    styles.haloWrap,
                    {
                      width: haloSize,
                      height: haloSize,
                      bottom: avatarHeight * 0.42 - haloSize / 2,
                      marginLeft: -haloSize / 2,
                    },
                  ]}
                >
                  <HaloDots size={haloSize} />
                </View>
                <Image
                  source={require("../assets/images/kai-avatar.png")}
                  style={{ width: avatarWidth, height: avatarHeight }}
                  resizeMode="contain"
                  accessibilityLabel="kAI, your SkinFit AI skin companion"
                />
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: KAI_MEET_CARD.radius,
    overflow: "hidden",
    shadowColor: "#2C3E6B",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: 16,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  inner: {
    flexDirection: "column",
    position: "relative",
    zIndex: 1,
  },
  innerWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  copyCol: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 16,
    justifyContent: "center",
  },
  copyColWide: {
    maxWidth: "52%",
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 36,
  },
  meet: {
    fontSize: 14,
    fontWeight: "700",
    color: KAI_MEET_CARD.text.meet,
    letterSpacing: -0.2,
  },
  kaiTitle: {
    marginTop: 4,
    fontSize: 56,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  kaiTitleWide: {
    fontSize: 72,
    lineHeight: 72,
  },
  kicker: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3.2,
    color: "rgba(255,255,255,0.98)",
  },
  typedWrap: {
    marginTop: 24,
    minHeight: 88,
  },
  typedText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    color: KAI_MEET_CARD.text.typed,
  },
  cursor: {
    color: KAI_MEET_CARD.text.cursor,
  },
  avatarCol: {
    minHeight: 260,
    paddingHorizontal: 12,
  },
  avatarColWide: {
    width: "48%",
    minHeight: 0,
    paddingHorizontal: 4,
  },
  avatarStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 260,
    paddingBottom: 4,
  },
  avatarFloat: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  avatarFrame: {
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  haloWrap: {
    position: "absolute",
    left: "50%",
    opacity: 0.95,
    zIndex: 0,
  },
});
