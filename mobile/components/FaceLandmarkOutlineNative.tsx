import { View } from "react-native";
import Svg, { Polygon } from "react-native-svg";

import {
  faceOvalPolylinePoints,
  type NormalizedPoint,
} from "@/lib/faceMeshOutline";

type Props = {
  landmarks: NormalizedPoint[] | null;
  layoutWidth: number;
  layoutHeight: number;
  cropZoom?: number;
  mirrored?: boolean;
};

export function FaceLandmarkOutlineNative({
  landmarks,
  layoutWidth,
  layoutHeight,
  cropZoom = 1,
  mirrored = true,
}: Props) {
  const pts = landmarks
    ? faceOvalPolylinePoints(landmarks, layoutWidth, layoutHeight, {
        mirrorX: mirrored,
        cropZoom,
      })
    : null;
  if (!pts?.length || layoutWidth < 8 || layoutHeight < 8) {
    return <View pointerEvents="none" style={{ position: "absolute", inset: 0 }} />;
  }

  const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, width: layoutWidth, height: layoutHeight }}
    >
      <Svg width={layoutWidth} height={layoutHeight}>
        <Polygon
          points={pointsStr}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2.5}
          strokeDasharray="6 5"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
