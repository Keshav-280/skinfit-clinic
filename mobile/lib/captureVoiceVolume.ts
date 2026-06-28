export {
  CAPTURE_VOICE_VOLUME_DEFAULT,
  CAPTURE_VOICE_VOLUME_MAX,
  CAPTURE_VOICE_VOLUME_MIN,
  clampCaptureVoiceVolume,
} from "../../src/lib/captureVoiceHint";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  CAPTURE_VOICE_VOLUME_DEFAULT,
  clampCaptureVoiceVolume,
} from "../../src/lib/captureVoiceHint";

const VOICE_VOLUME_STORAGE_KEY = "skinfit.captureVoiceVolume";

export async function loadStoredCaptureVoiceVolume(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(VOICE_VOLUME_STORAGE_KEY);
    if (raw == null) return CAPTURE_VOICE_VOLUME_DEFAULT;
    return clampCaptureVoiceVolume(Number.parseFloat(raw));
  } catch {
    return CAPTURE_VOICE_VOLUME_DEFAULT;
  }
}

export async function storeCaptureVoiceVolume(value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      VOICE_VOLUME_STORAGE_KEY,
      String(clampCaptureVoiceVolume(value))
    );
  } catch {
    /* ignore */
  }
}
