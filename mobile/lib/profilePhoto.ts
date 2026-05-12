import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { apiFetch } from "@/lib/api";

const CACHE_DIR = `${FileSystem.documentDirectory}profile-photos/`;
let _photoUserId: string | null = null;

export function setPhotoUserId(userId: string | null) {
  _photoUserId = userId;
}

function cacheFile(): string {
  return _photoUserId
    ? `${CACHE_DIR}${_photoUserId}.jpg`
    : `${CACHE_DIR}avatar.jpg`;
}

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

export async function getCachedPhoto(): Promise<string | null> {
  try {
    const path = cacheFile();
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return path;
  } catch {}
  return null;
}

export async function cachePhotoFromUri(dataUri: string): Promise<string> {
  await ensureCacheDir();
  const path = cacheFile();
  const base64 = dataUri.split(",")[1];
  if (base64) {
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: "base64",
    });
  }
  return path;
}

export async function clearCachedPhoto() {
  try {
    await FileSystem.deleteAsync(cacheFile(), { idempotent: true });
  } catch {}
}

/** Wipes all cached profile photos (every user). Call on sign-out. */
export async function clearAllCachedPhotos() {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  } catch {}
}

async function compressAndUpload(
  sourceUri: string,
  token: string
): Promise<{ uri: string } | { error: string }> {
  const context = ImageManipulator.manipulate(sourceUri);
  context.resize({ width: 300, height: 300 });
  const imageRef = await context.renderAsync();
  const saved = await imageRef.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.7,
  });

  const base64 = await FileSystem.readAsStringAsync(saved.uri, {
    encoding: "base64",
  });

  const dataUri = `data:image/jpeg;base64,${base64}`;

  if (dataUri.length > 500_000) {
    return { error: "Photo too large even after compression." };
  }

  const res = await apiFetch("/api/user/profile-photo", token, {
    method: "PUT",
    body: JSON.stringify({ dataUri }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: (body as any)?.message ?? "Upload failed." };
  }

  await cachePhotoFromUri(dataUri);
  return { uri: cacheFile() };
}

export async function pickAndUploadPhoto(
  token: string
): Promise<{ uri: string } | { error: string }> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return { error: "Permission to access photos was denied." };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { error: "cancelled" };
  }

  return compressAndUpload(result.assets[0].uri, token);
}

export async function captureAndUploadPhoto(
  token: string
): Promise<{ uri: string } | { error: string }> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    return { error: "Permission to use camera was denied." };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    cameraType: ImagePicker.CameraType.front,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { error: "cancelled" };
  }

  return compressAndUpload(result.assets[0].uri, token);
}

export async function fetchAndCachePhoto(
  token: string
): Promise<string | null> {
  try {
    const cached = await getCachedPhoto();
    if (cached) return cached;

    const res = await apiFetch("/api/user/profile-photo", token, {
      method: "GET",
    });
    if (!res.ok) return null;

    const { profilePhotoUrl } = (await res.json()) as {
      profilePhotoUrl: string | null;
    };
    if (!profilePhotoUrl) return null;

    return await cachePhotoFromUri(profilePhotoUrl);
  } catch {
    return null;
  }
}
