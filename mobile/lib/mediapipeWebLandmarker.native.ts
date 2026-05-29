import type { NativeFaceLandmarkBundle } from "@/lib/nativeFaceLandmarkDetection";

/** Android/iOS use react-native-mediapipe — not @mediapipe/tasks-vision (web WASM). */
export async function detectFaceLandmarksOnWebImage(
  _imageUri: string
): Promise<NativeFaceLandmarkBundle | null> {
  return null;
}
