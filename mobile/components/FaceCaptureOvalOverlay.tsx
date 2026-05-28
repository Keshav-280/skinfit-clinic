import { View } from "react-native";

/** No dimmed cutout — full camera preview only; guidance uses the whole frame. */
export function FaceCaptureOvalOverlay() {
  return <View pointerEvents="none" />;
}
