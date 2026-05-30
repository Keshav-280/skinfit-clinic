import { decode, encode } from "jpeg-js";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system/legacy";

export type CameraAdjustments = {
  zoom: number;
  brightness: number;
  exposure: number;
  torch: boolean;
};

export const DEFAULT_CAMERA_ADJUSTMENTS: CameraAdjustments = {
  zoom: 0,
  brightness: 0,
  exposure: 0,
  torch: false,
};

export const CAMERA_ZOOM_MIN = 0;
/** Cap manual zoom — keeps preview closer to captured still on iOS. */
export const CAMERA_ZOOM_MAX = 0.48;
export const CAMERA_ZOOM_STEP = 0.04;

export const BRIGHTNESS_MIN = -70;
export const BRIGHTNESS_MAX = 70;
export const BRIGHTNESS_STEP = 7;

export const EXPOSURE_MIN = -70;
export const EXPOSURE_MAX = 70;
export const EXPOSURE_STEP = 7;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function clamp255(n: number) {
  return clamp(Math.round(n), 0, 255);
}

/** Combined preview overlay opacity (0–0.35). */
export function previewOverlayOpacity(brightness: number, exposure: number): {
  light: number;
  dark: number;
} {
  const combined = brightness + exposure * 0.65;
  if (combined > 0) {
    return { light: clamp(combined / 220, 0, 0.35), dark: 0 };
  }
  return { light: 0, dark: clamp(-combined / 220, 0, 0.35) };
}

/** Apply brightness + exposure gain to captured JPEG pixels. */
export async function applyCaptureAdjustments(
  uri: string,
  brightness: number,
  exposure: number
): Promise<string> {
  if (brightness === 0 && exposure === 0) return uri;

  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buf = Buffer.from(b64, "base64");
  const decoded = decode(buf, { useTArray: true, formatAsRGBA: true });
  const gain = 1 + (brightness + exposure * 0.75) / 100;
  const { data, width, height } = decoded;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp255(data[i] * gain);
    data[i + 1] = clamp255(data[i + 1] * gain);
    data[i + 2] = clamp255(data[i + 2] * gain);
  }

  const out = encode({ data, width, height }, 88);
  const outUri = `${FileSystem.cacheDirectory}capture-adj-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(
    outUri,
    Buffer.from(out.data).toString("base64"),
    { encoding: FileSystem.EncodingType.Base64 }
  );
  return outUri;
}
