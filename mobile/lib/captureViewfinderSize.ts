import { Dimensions } from "react-native";

/** Width : height = 3 : 4 (portrait viewfinder). */
const VIEWFINDER_ASPECT_W = 3;
const VIEWFINDER_ASPECT_H = 4;

function fitViewfinder3x4(maxWidth: number, maxHeight: number) {
  if (maxWidth <= 0 || maxHeight <= 0) {
    return { width: 0, height: 0 };
  }
  let width = maxWidth;
  let height = (width * VIEWFINDER_ASPECT_H) / VIEWFINDER_ASPECT_W;
  if (height > maxHeight) {
    height = maxHeight;
    width = (height * VIEWFINDER_ASPECT_W) / VIEWFINDER_ASPECT_H;
  }
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** Header + step title — tips/controls scroll below the viewfinder. */
const VIEWFINDER_CHROME_BELOW = 120;
const VIEWFINDER_CHROME_ABOVE = 132;

/** Stable on-screen viewfinder size — must match `OnboardingCaptureStepUI`. */
export function getCaptureViewfinderSize(
  insetTop: number,
  insetBottom: number,
  screen = Dimensions.get("window")
) {
  const horizontalPadding = 40;
  const maxW = screen.width - horizontalPadding;
  const maxH =
    screen.height -
    insetTop -
    insetBottom -
    VIEWFINDER_CHROME_ABOVE -
    VIEWFINDER_CHROME_BELOW;
  return fitViewfinder3x4(maxW, Math.max(260, maxH));
}
