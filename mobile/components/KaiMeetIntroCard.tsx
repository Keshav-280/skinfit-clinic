import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import {
  KAI_INTRO_LINES,
  KAI_LINE_PAUSE_MS,
  KAI_TYPING_MS_PER_CHAR,
} from "../../src/lib/kaiIntroScript";
import {
  KAI_MEET_CARD,
  meetCardHaloDots,
} from "../../src/lib/kaiMeetIntroCardVisual";

const WIDE_BREAKPOINT = 768;

const HALO_DOTS = meetCardHaloDots();

function HaloDots({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-24 -24 148 148">
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

function CardGradient({
  cx = "72%",
  cy = "48%",
}: {
  cx?: string;
  cy?: string;
}) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
      <Defs>
        <RadialGradient id="kaiMeetGlow" cx={cx} cy={cy} rx="55%" ry="65%">
          <Stop
            offset="0%"
            stopColor={KAI_MEET_CARD.gradient.glow}
            stopOpacity="1"
          />
          <Stop offset="44%" stopColor="#DCEAFF" stopOpacity="0.24" />
          <Stop
            offset="78%"
            stopColor={KAI_MEET_CARD.gradient.mid}
            stopOpacity="0"
          />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#kaiMeetGlow)" />
    </Svg>
  );
}

export function KaiMeetIntroCard() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [floatY] = useState(() => new Animated.Value(0));
  const [cursorOpacity] = useState(() => new Animated.Value(1));

  const line = KAI_INTRO_LINES[lineIndex] ?? KAI_INTRO_LINES[0];

  const cardMinHeight = isWide
    ? KAI_MEET_CARD.minHeightWide
    : KAI_MEET_CARD.minHeightPhone;
  const avatarHeight = isWide
    ? Math.min(cardMinHeight * 0.94, 470)
    : Math.min(width * 0.4, 182);
  const avatarWidth = avatarHeight * (132 / 291);
  const haloSize = Math.min(avatarHeight * 1.34, isWide ? 560 : 248);
  const frameWidth = Math.max(avatarWidth, haloSize);
  const frameHeight = Math.max(avatarHeight + 20, haloSize + 12);
  const haloTop = (frameHeight - haloSize) / 2;
  const avatarLeft = (frameWidth - avatarWidth) / 2;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -3,
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
      ]),
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
      ]),
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
        <CardGradient cx={isWide ? "74%" : "50%"} cy={isWide ? "50%" : "60%"} />
      </View>

      <View
        style={[
          styles.inner,
          isWide && styles.innerWide,
          { minHeight: cardMinHeight },
        ]}
      >
        <View style={[styles.copyCol, isWide && styles.copyColWide]}>
          <Text style={styles.meet}>Meet</Text>
          <Text style={[styles.kaiTitle, isWide && styles.kaiTitleWide]}>
            kAI
          </Text>
          <Text style={styles.kicker}>YOUR SKIN COMPANION</Text>

          <View style={styles.descWrap}>
            <Text style={styles.descText}>
              {typed}
              <Animated.Text
                style={[styles.cursor, { opacity: cursorOpacity }]}
              >
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
                {
                  transform: [
                    { translateY: floatY },
                    { translateX: isWide ? -24 : 0 },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.avatarFrame,
                  { width: frameWidth, height: frameHeight },
                ]}
              >
                <View
                  style={[
                    styles.haloGlow,
                    {
                      width: haloSize * 0.9,
                      height: haloSize * 0.9,
                      borderRadius: (haloSize * 0.9) / 2,
                      top: haloTop + (haloSize - haloSize * 0.9) / 2,
                      left: (frameWidth - haloSize * 0.9) / 2,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.haloWrap,
                    {
                      width: haloSize,
                      height: haloSize,
                      top: haloTop,
                      left: (frameWidth - haloSize) / 2,
                    },
                  ]}
                >
                  <HaloDots size={haloSize} />
                </View>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  source={require("../assets/images/kai-avatar.png")}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: avatarLeft,
                    width: avatarWidth,
                    height: avatarHeight,
                    zIndex: 1,
                  }}
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
    shadowColor: "#1E1B31",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.44,
    shadowRadius: 28,
    elevation: 10,
    marginBottom: 16,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
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
    paddingTop: 24,
    paddingBottom: 12,
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
  descWrap: {
    marginTop: 16,
    minHeight: 72,
  },
  descText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: KAI_MEET_CARD.text.desc,
  },
  cursor: {
    color: KAI_MEET_CARD.text.desc,
  },
  avatarCol: {
    minHeight: 200,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  avatarColWide: {
    width: "48%",
    minHeight: 0,
    paddingHorizontal: 4,
  },
  avatarStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
    paddingBottom: 10,
  },
  avatarFloat: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  avatarFrame: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  haloWrap: {
    position: "absolute",
    opacity: 0.98,
    zIndex: 0,
  },
  haloGlow: {
    position: "absolute",
    backgroundColor: "rgba(220,234,255,0.2)",
    zIndex: 0,
  },
});
