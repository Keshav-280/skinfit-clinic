import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Ellipse } from "react-native-svg";

const { width: W, height: H } = Dimensions.get("window");

export function FaceCaptureOvalOverlay() {
  const cx = W / 2;
  const cy = H * 0.40;
  const rx = W * 0.36;
  const ry = rx * 1.35;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke="#E53E3E"
          strokeWidth={2.5}
          strokeDasharray="12 8"
          fill="none"
        />
      </Svg>
    </View>
  );
}
