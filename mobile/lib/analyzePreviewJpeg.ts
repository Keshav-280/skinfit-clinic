import { decode } from "jpeg-js";
import { Buffer } from "buffer";
import * as ImageManipulator from "expo-image-manipulator";

import {
  analyzeFaceFraming,
  analyzeLightingFromRgba,
  buildCaptureGuidance,
  estimateFaceBoxFromSkin,
  smoothFaceBox,
  type CaptureGuidanceSnapshot,
  type NormalizedFaceBox,
  type StableFramingState,
} from "@/lib/scanCaptureGuidance";

const PREVIEW_WIDTH = 160;

/** Resize a camera still to a tiny JPEG and run lighting + face heuristics. */
export type PreviewGuidanceState = {
  smoothedBox: NormalizedFaceBox | null;
  framing: StableFramingState | null;
};

export async function analyzePreviewImageUri(
  uri: string,
  currentZoom: number,
  state?: PreviewGuidanceState
): Promise<{ guidance: CaptureGuidanceSnapshot | null; state: PreviewGuidanceState }> {
  const small = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: PREVIEW_WIDTH } }],
    {
      compress: 0.45,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  const emptyState: PreviewGuidanceState = {
    smoothedBox: state?.smoothedBox ?? null,
    framing: state?.framing ?? null,
  };
  if (!small.base64) return { guidance: null, state: emptyState };

  const buf = Buffer.from(small.base64, "base64");
  const decoded = decode(buf, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = decoded;
  if (!width || !height) return { guidance: null, state: emptyState };

  const lighting = analyzeLightingFromRgba(data, width, height);
  const rawBox = estimateFaceBoxFromSkin(data, width, height);
  const smoothedBox = smoothFaceBox(emptyState.smoothedBox, rawBox);
  const framing = analyzeFaceFraming(smoothedBox, emptyState.framing);
  const nextState: PreviewGuidanceState = {
    smoothedBox,
    framing: { quality: framing.quality, faceFill: framing.faceFill },
  };

  return {
    guidance: buildCaptureGuidance(lighting, framing, currentZoom),
    state: nextState,
  };
}
