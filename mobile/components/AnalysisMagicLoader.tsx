import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const NAVY = "#2C3E6B";
const TEAL = "#0d9488";

type Props = {
  title: string;
  subtitle?: string;
  /** Rotating status lines shown under the title (e.g. “Scan reports”). */
  steps?: string[];
  style?: StyleProp<ViewStyle>;
};

export function AnalysisMagicLoader({ title, subtitle, steps = [], style }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();
    return () => {
      shimmerLoop.stop();
    };
  }, [shimmer]);

  useEffect(() => {
    if (steps.length < 2) return;
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, 2200);
    return () => clearInterval(id);
  }, [steps]);

  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 280],
  });

  const activeStep = steps[stepIndex] ?? steps[0];

  return (
    <View style={[styles.root, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {activeStep ? (
        <View style={styles.stepRow}>
          <View style={styles.stepDot} />
          <Text style={styles.stepText}>{activeStep}</Text>
        </View>
      ) : null}

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerX }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#52525b",
    textAlign: "center",
    maxWidth: 300,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TEAL,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEAL,
  },
  track: {
    width: "100%",
    maxWidth: 280,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(44,62,107,0.12)",
    overflow: "hidden",
    marginTop: 12,
  },
  shimmer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 100,
    borderRadius: 2,
    backgroundColor: TEAL,
    opacity: 0.65,
  },
});
