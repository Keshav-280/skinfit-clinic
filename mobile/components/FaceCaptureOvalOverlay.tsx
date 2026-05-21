import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, Mask, Rect } from "react-native-svg";

import { OVAL_FRAME } from "@/lib/scanCaptureGuidance";

const VB_W = 3;
const VB_H = 4;
const cx = VB_W * OVAL_FRAME.cx;
const cy = VB_H * OVAL_FRAME.cy;
const rx = VB_W * OVAL_FRAME.rx;
const ry = VB_H * OVAL_FRAME.ry;

/** Same oval geometry as web — full face (forehead to chin). */
export function FaceCaptureOvalOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <Mask id="ovalMask">
            <Rect width={VB_W} height={VB_H} fill="white" />
            <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
          </Mask>
        </Defs>
        <Rect
          width={VB_W}
          height={VB_H}
          fill="rgba(0,0,0,0.5)"
          mask="url(#ovalMask)"
        />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={0.03}
          fill="none"
        />
      </Svg>
    </View>
  );
}
