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
function imagePathCandidates(uri: string): string[] {
  const trimmed = uri.trim();
  const out = new Set<string>();
  out.add(trimmed);
  if (trimmed.startsWith("file://")) {
    out.add(trimmed.slice("file://".length));
  } else {
    out.add(`file://${trimmed}`);
  }
  return [...out];
}

/** Run MediaPipe Face Landmarker on a still (dev client with react-native-mediapipe). */
export async function detectFaceLandmarksOnImage(
  imageUri: string
): Promise<NativeFaceLandmarkBundle | null> {
  const mod = getNativeModule();
  if (!mod) return null;

  const paths = imagePathCandidates(imageUri);
  const opts = {
    numFaces: 1,
    minFaceDetectionConfidence: 0.25,
    minFacePresenceConfidence: 0.25,
    minTrackingConfidence: 0.25,
    model: FACE_LANDMARKER_MODEL,
  };

  let lastError: unknown = null;
  // CPU first — GPU delegate often fails on physical devices / simulators.
  for (const delegate of [DELEGATE_CPU, DELEGATE_GPU]) {
    for (const path of paths) {
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
        const normalized = normalizeLandmarkBundle(raw);
        const pts = extractFaceLandmarkPoints(normalized);
        if (pts?.length) return normalized;
      } catch (e) {
        lastError = e;
      }
    }
  }
  if (__DEV__ && lastError) {
    console.warn("[scan] native FaceLandmark detectOnImage failed:", lastError);
  }
  return null;
}

function isLandmarkPoint(v: unknown): v is { x: number; y: number; z?: number } {
  return (
    typeof v === "object" &&
    v != null &&
    typeof (v as { x?: unknown }).x === "number" &&
    typeof (v as { y?: unknown }).y === "number"
  );
}

/** Pick the first face's landmark list from native bridge payloads (iOS/Android differ slightly). */
export function extractFaceLandmarkPoints(
  raw: NativeFaceLandmarkBundle | null | undefined
): Array<{ x: number; y: number; z?: number }> | null {
  const results = raw?.results;
  if (!Array.isArray(results)) return null;

  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const faceLandmarks = (result as { faceLandmarks?: unknown }).faceLandmarks;
    if (!Array.isArray(faceLandmarks) || faceLandmarks.length === 0) continue;

    const first = faceLandmarks[0];
    if (Array.isArray(first) && first.length > 0 && isLandmarkPoint(first[0])) {
      return first as Array<{ x: number; y: number; z?: number }>;
    }
    if (isLandmarkPoint(first)) {
      return faceLandmarks as Array<{ x: number; y: number; z?: number }>;
    }
    for (const face of faceLandmarks) {
      if (Array.isArray(face) && face.length > 0 && isLandmarkPoint(face[0])) {
        return face as Array<{ x: number; y: number; z?: number }>;
      }
    }
  }
  return null;
}

function normalizeBlendshapeCategories(raw: unknown): FaceBlendshapeCategory[] {
  if (!Array.isArray(raw)) return [];
  const out: FaceBlendshapeCategory[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as {
      categoryName?: string;
      displayName?: string;
      label?: string;
      score?: number;
    };
    if (typeof row.score !== "number") continue;
    out.push({
      categoryName: row.categoryName ?? row.label,
      displayName: row.displayName,
      score: row.score,
    });
  }
  return out;
}

/** Native bridge shape can differ slightly from our TS types. */
function normalizeLandmarkBundle(raw: unknown): NativeFaceLandmarkBundle {
  const bundle = (raw ?? {}) as NativeFaceLandmarkBundle & {
    results?: unknown[];
  };
  const face0 = bundle.results?.[0] as
    | {
        faceLandmarks?: unknown;
        faceBlendshapes?: unknown;
      }
    | undefined;

  const points = extractFaceLandmarkPoints(bundle as NativeFaceLandmarkBundle);
  const landmarks = points ? [points] : [];

  let blendshapesRaw: unknown = face0?.faceBlendshapes;
  if (!Array.isArray(blendshapesRaw)) blendshapesRaw = [];
  const blend0 = (blendshapesRaw as unknown[])[0] as { categories?: unknown } | undefined;
  const categories = normalizeBlendshapeCategories(blend0?.categories ?? blendshapesRaw);

  return {
    results: [
      {
        faceLandmarks: landmarks,
        faceBlendshapes: [{ categories }],
      },
    ],
    inputImageWidth: Number(bundle.inputImageWidth) || 0,
    inputImageHeight: Number(bundle.inputImageHeight) || 0,
  };
}
