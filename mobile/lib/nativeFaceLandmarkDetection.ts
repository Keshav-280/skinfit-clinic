import { NativeModules, Platform } from "react-native";

import { FACE_LANDMARKER_MODEL_FILE } from "@/lib/faceLandmarkerModel";

export const FACE_LANDMARKER_MODEL = FACE_LANDMARKER_MODEL_FILE;

export type FaceBlendshapeCategory = {
  categoryName?: string;
  displayName?: string;
  score: number;
};

export type NativeFaceLandmarkBundle = {
  results: Array<{
    faceLandmarks: Array<Array<{ x: number; y: number; z?: number }>>;
    faceBlendshapes: Array<{ categories: FaceBlendshapeCategory[] }>;
  }>;
  inputImageWidth: number;
  inputImageHeight: number;
};

type FaceLandmarkNativeModule = {
  detectOnImage: (
    imagePath: string,
    numFaces: number,
    minFaceDetectionConfidence: number,
    minFacePresenceConfidence: number,
    minTrackingConfidence: number,
    model: string,
    delegate: number
  ) => Promise<NativeFaceLandmarkBundle>;
};

const DELEGATE_GPU = 1;
const DELEGATE_CPU = 0;

function getNativeModule(): FaceLandmarkNativeModule | undefined {
  const mod = NativeModules.FaceLandmarkDetection as FaceLandmarkNativeModule | undefined;
  return typeof mod?.detectOnImage === "function" ? mod : undefined;
}

export function isNativeFaceLandmarkAvailable(): boolean {
  if (Platform.OS === "web") return false;
  return getNativeModule() != null;
}

/** Paths from expo-camera / ImageManipulator differ by platform. */
function normalizeImagePath(uri: string): string {
  if (Platform.OS === "android" && uri.startsWith("file://")) {
    return uri.slice("file://".length);
  }
  return uri;
}

/** Run MediaPipe Face Landmarker on a still (dev client with react-native-mediapipe). */
export async function detectFaceLandmarksOnImage(
  imageUri: string
): Promise<NativeFaceLandmarkBundle | null> {
  const mod = getNativeModule();
  if (!mod) return null;

  const path = normalizeImagePath(imageUri);
  const opts = {
    numFaces: 1,
    minFaceDetectionConfidence: 0.25,
    minFacePresenceConfidence: 0.25,
    minTrackingConfidence: 0.25,
    model: FACE_LANDMARKER_MODEL,
  };

  for (const delegate of [DELEGATE_GPU, DELEGATE_CPU]) {
    try {
      const raw = await mod.detectOnImage(
        path,
        opts.numFaces,
        opts.minFaceDetectionConfidence,
        opts.minFacePresenceConfidence,
        opts.minTrackingConfidence,
        opts.model,
        delegate
      );
      return normalizeLandmarkBundle(raw);
    } catch (e) {
      if (__DEV__ && delegate === DELEGATE_CPU) {
        console.warn("[scan] native FaceLandmark detectOnImage failed:", e);
      }
    }
  }
  return null;
}

/** Native bridge shape can differ slightly from our TS types. */
function normalizeLandmarkBundle(raw: NativeFaceLandmarkBundle): NativeFaceLandmarkBundle {
  const face0 = raw?.results?.[0];
  if (!face0) return raw;

  const landmarks = face0.faceLandmarks ?? [];
  let blendshapes = face0.faceBlendshapes ?? [];

  if (blendshapes.length === 0 && Array.isArray((face0 as { faceBlendshapes?: unknown }).faceBlendshapes)) {
    blendshapes = face0.faceBlendshapes;
  }

  const categories =
    blendshapes[0]?.categories ??
    (blendshapes[0] as { categories?: FaceBlendshapeCategory[] } | undefined)?.categories ??
    [];

  return {
    results: [
      {
        faceLandmarks: landmarks,
        faceBlendshapes: [{ categories }],
      },
    ],
    inputImageWidth: raw.inputImageWidth,
    inputImageHeight: raw.inputImageHeight,
  };
}
