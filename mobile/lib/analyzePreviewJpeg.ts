import { decode } from "jpeg-js";
import { Buffer } from "buffer";
import * as ImageManipulator from "expo-image-manipulator";

import {
  analyzeFaceFraming,
  analyzeLightingFromRgba,
  buildCaptureGuidance,
  estimateFaceBoxFromSkin,
  type CaptureGuidanceSnapshot,
} from "@/lib/scanCaptureGuidance";

const PREVIEW_WIDTH = 160;

/** Resize a camera still to a tiny JPEG and run lighting + face heuristics. */
export async function analyzePreviewImageUri(
  uri: string,
  currentZoom: number
): Promise<CaptureGuidanceSnapshot | null> {
  const small = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: PREVIEW_WIDTH } }],
    {
      compress: 0.45,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!small.base64) return null;

  const buf = Buffer.from(small.base64, "base64");
  const decoded = decode(buf, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = decoded;
  if (!width || !height) return null;

  const lighting = analyzeLightingFromRgba(data, width, height);
  const faceBox = estimateFaceBoxFromSkin(data, width, height);
  const framing = analyzeFaceFraming(faceBox, width / height);

  return buildCaptureGuidance(lighting, framing, currentZoom);
}
