import * as FileSystem from "expo-file-system/legacy";

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("caf")) return "caf";
  if (m.includes("webm")) return "webm";
  return "m4a";
}

/** Data URIs must be written to cache — expo-av is unreliable with inline base64 on iOS. */
export async function resolvePlayableAudioUri(
  uri: string,
  cachePrefix: string
): Promise<string> {
  const trimmed = uri.trim();
  if (
    !trimmed.startsWith("data:") &&
    (trimmed.startsWith("file:") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://"))
  ) {
    return trimmed;
  }
  if (!trimmed.startsWith("data:")) return trimmed;

  const commaIndex = trimmed.indexOf(",");
  if (commaIndex < 0) throw new Error("Invalid audio data URI");
  const meta = trimmed.slice(5, commaIndex).toLowerCase();
  const mime = meta.split(";")[0] ?? "audio/m4a";
  const base64 = trimmed.slice(commaIndex + 1);
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error("Device cache is unavailable.");
  const path = `${cacheDir}${cachePrefix}_${Date.now()}.${extFromMime(mime)}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}
