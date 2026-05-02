import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Ellipse, Mask, Rect } from "react-native-svg";

const { width: W, height: H } = Dimensions.get("window");

type Props = {
  /** 0–1 approximate face luminance hint from last frame (optional). */
  luminanceHint?: "dark" | "ok" | "bright" | null;
};

export function FaceCaptureOvalOverlay({ luminanceHint }: Props) {
  const cx = W / 2;
  const cy = H * 0.32;
  const rx = W * 0.36;
  const ry = H * 0.14;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="hole">
            <Rect width={W} height={H} fill="white" />
            <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
          </Mask>
        </Defs>
        <Rect width={W} height={H} fill="rgba(0,0,0,0.55)" mask="url(#hole)" />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={2}
          fill="none"
        />
      </Svg>
      {luminanceHint && luminanceHint !== "ok" ? (
        <View style={styles.hintWrap}>
          <Text style={styles.hintText}>
            {luminanceHint === "dark"
              ? "Try brighter light — face the window."
              : "Too bright — step out of direct sun."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hintWrap: {
    position: "absolute",
    bottom: H * 0.18,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  hintText: {
    color: "#fef08a",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
