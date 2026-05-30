import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Platform } from "react-native";

/** Tiny silent WAV — primes iOS AVAudioSession so Speech + expo-av play in silent mode. */
const SILENT_WAV_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA==";

let primingSound: Audio.Sound | null = null;
let primingRefCount = 0;

async function setPlaybackMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    // MixWithOthers: camera + TTS can share the session (DuckOthers was muting speech).
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

/**
 * iOS silent switch: expo-speech ignores playsInSilentModeIOS unless the session is
 * primed with a real playback (expo-av). Call before Speech.speak or voice-note play.
 */
export async function primeAudioSessionForPlayback(): Promise<void> {
  await setPlaybackMode();
  if (Platform.OS !== "ios") return;

  if (primingSound) {
    try {
      const status = await primingSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await primingSound.playAsync();
      }
    } catch {
      /* replaced below */
    }
    return;
  }

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: SILENT_WAV_URI },
      { shouldPlay: true, isLooping: true, volume: 0.001, isMuted: false }
    );
    primingSound = sound;
  } catch (e) {
    if (__DEV__) console.warn("[audio] silent prime failed:", e);
  }
}

/** Keep session alive during scan voice guide (camera resets session often). */
export async function startAudioPrimingLoop(): Promise<void> {
  primingRefCount += 1;
  await primeAudioSessionForPlayback();
}

export async function stopAudioPrimingLoop(): Promise<void> {
  primingRefCount = Math.max(0, primingRefCount - 1);
  if (primingRefCount > 0 || !primingSound) return;
  try {
    await primingSound.stopAsync();
    await primingSound.unloadAsync();
  } catch {
    /* ignore */
  }
  primingSound = null;
}

/** Speaker playback — voice notes, scan voice guide (expo-speech). */
export async function configurePlaybackAudioMode(): Promise<void> {
  await primeAudioSessionForPlayback();
}

/** Mic capture — chat voice notes. Call configurePlaybackAudioMode when done. */
export async function configureRecordingAudioMode(): Promise<void> {
  await stopAudioPrimingLoop();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}
