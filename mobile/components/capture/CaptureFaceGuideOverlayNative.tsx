import Svg, { Ellipse, G, Path } from "react-native-svg";

import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import { MOBILE_FRONT_GUIDE_ELLIPSE } from "../../../src/lib/faceGuideCrop";

type GuidePose = "front" | "left" | "right";

function poseForStep(stepId: FaceScanCaptureId): GuidePose {
  if (stepId === "left") return "left";
  if (stepId === "right") return "right";
  return "front";
}

/** One thin dash style for front and side capture steps. */
const GUIDE_STROKE = {
  fill: "none",
  stroke: "#FFFFFF",
  strokeWidth: 1,
  strokeDasharray: "4 6",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  opacity: 0.82,
};

const LEFT_PROFILE_FACE =
  "M 62 34 C 54 24 40 26 34 38 C 30 48 31 58 36 66 C 41 74 50 76 56 70 C 61 64 64 52 62 34 Z";

const PROFILE_FACE_SCALE = 2.05;
const PROFILE_SHIFT_X = 8;
const PROFILE_SHIFT_Y = 2;

/** Profile face path lives inside a scale transform — compensate so stroke matches front. */
const PROFILE_FACE_STROKE = {
  ...GUIDE_STROKE,
  strokeWidth: GUIDE_STROKE.strokeWidth / PROFILE_FACE_SCALE,
};

function FrontGuide() {
  return (
    <>
      <Ellipse
        cx={MOBILE_FRONT_GUIDE_ELLIPSE.cx}
        cy={MOBILE_FRONT_GUIDE_ELLIPSE.cy}
        rx={MOBILE_FRONT_GUIDE_ELLIPSE.rx}
        ry={MOBILE_FRONT_GUIDE_ELLIPSE.ry}
        {...GUIDE_STROKE}
      />
      <Path d="M 24 92 Q 14 103 10 100 M 76 92 Q 86 103 90 100" {...GUIDE_STROKE} />
    </>
  );
}

function LeftProfileGuide() {
  return (
    <G transform={`translate(${PROFILE_SHIFT_X},${PROFILE_SHIFT_Y})`}>
      <G transform={`translate(50,50) scale(${PROFILE_FACE_SCALE}) translate(-50,-50)`}>
        <Path d={LEFT_PROFILE_FACE} {...PROFILE_FACE_STROKE} />
      </G>
      <Path d="M 22 88 Q 10 104 8 101" {...GUIDE_STROKE} />
    </G>
  );
}

function RightProfileGuide() {
  return (
    <G transform={`translate(${-PROFILE_SHIFT_X},${PROFILE_SHIFT_Y})`}>
      <G transform={`translate(50,50) scale(${-PROFILE_FACE_SCALE},${PROFILE_FACE_SCALE}) translate(-50,-50)`}>
        <Path d={LEFT_PROFILE_FACE} {...PROFILE_FACE_STROKE} />
      </G>
      <Path d="M 78 88 Q 90 104 92 101" {...GUIDE_STROKE} />
    </G>
  );
}

type Props = {
  stepId: FaceScanCaptureId;
};

/** Dashed face / profile guide inside the capture viewfinder (matches web overlay). */
export function CaptureFaceGuideOverlayNative({ stepId }: Props) {
  const pose = poseForStep(stepId);

  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {pose === "front" ? <FrontGuide /> : null}
      {pose === "left" ? <LeftProfileGuide /> : null}
      {pose === "right" ? <RightProfileGuide /> : null}
    </Svg>
  );
}
