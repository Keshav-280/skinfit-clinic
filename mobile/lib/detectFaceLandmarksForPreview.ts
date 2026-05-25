import { Platform } from "react-native";

import {
  detectFaceLandmarksOnImage,
  isNativeFaceLandmarkAvailable,
  type NativeFaceLandmarkBundle,
} from "@/lib/nativeFaceLandmarkDetection";
import { detectFaceLandmarksOnWebImage } from "@/lib/mediapipeWebLandmarker";

export async function detectFaceLandmarksForPreview(
  imageUri: string
): Promise<NativeFaceLandmarkBundle | null> {
  if (Platform.OS === "web") {
    return detectFaceLandmarksOnWebImage(imageUri);
  }
  if (isNativeFaceLandmarkAvailable()) {
    return detectFaceLandmarksOnImage(imageUri);
  }
  return null;
}
