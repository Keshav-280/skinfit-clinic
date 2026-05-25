import { Platform } from "react-native";

import { FACE_LANDMARKER_MODEL_URL } from "@/lib/faceLandmarkerModel";
import type { NativeFaceLandmarkBundle } from "@/lib/nativeFaceLandmarkDetection";

type BlendshapeCategory = { categoryName: string; score: number };
type LandmarkerResult = {
  faceLandmarks?: Array<Array<{ x: number; y: number }>>;
  faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }>;
};
type FaceLandmarkerLike = {
  detect: (source: HTMLCanvasElement | HTMLImageElement) => LandmarkerResult;
  close?: () => void;
};

let landmarkerPromise: Promise<FaceLandmarkerLike | null> | null = null;

async function getWebLandmarker(): Promise<FaceLandmarkerLike | null> {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const wasmRoot = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
        const fileset = await vision.FilesetResolver.forVisionTasks(wasmRoot);
        return await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      } catch (e) {
        if (__DEV__) console.warn("[scan] web FaceLandmarker load failed:", e);
        return null;
      }
    })();
  }
  return landmarkerPromise;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load preview image"));
    img.src = uri;
  });
}

/** MediaPipe on Expo web (same model as browser scan flow). */
export async function detectFaceLandmarksOnWebImage(
  imageUri: string
): Promise<NativeFaceLandmarkBundle | null> {
  const landmarker = await getWebLandmarker();
  if (!landmarker) return null;
  try {
    const img = await loadImage(imageUri);
    const result = landmarker.detect(img);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    return {
      results: [
        {
          faceLandmarks: result.faceLandmarks ?? [],
          faceBlendshapes: (result.faceBlendshapes ?? []).map((b) => ({
            categories: b.categories.map((c) => ({
              categoryName: c.categoryName,
              score: c.score,
            })),
          })),
        },
      ],
      inputImageWidth: w,
      inputImageHeight: h,
    };
  } catch (e) {
    if (__DEV__) console.warn("[scan] web FaceLandmarker detect failed:", e);
    return null;
  }
}
