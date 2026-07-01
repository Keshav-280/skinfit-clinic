import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { apiFetch } from "@/lib/api";

type UploadPhotoOptions = {
  /** Fires only after the user picked/captured a photo — not while the picker is open. */
  onUploadStart?: () => void;
};

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

/** Square center-crop + resize — avoids Android/iOS in-picker crop overlay (`allowsEditing`). */
async function squareProfilePhotoUri(sourceUri: string): Promise<string> {
  const oriented = await manipulateAsync(sourceUri, []);
  const { width, height } = oriented;
  const cropSize = Math.min(width, height);
  const originX = Math.floor((width - cropSize) / 2);
  const originY = Math.floor((height - cropSize) / 2);
  const saved = await manipulateAsync(
    oriented.uri,
    [
      { crop: { originX, originY, width: cropSize, height: cropSize } },
      { resize: { width: 300, height: 300 } },
    ],
    { format: SaveFormat.JPEG, compress: 0.7 }
  );
  return saved.uri;
}

async function compressAndUpload(
  sourceUri: string,
  token: string
): Promise<{ uri: string } | { error: string }> {
  const savedUri = await squareProfilePhotoUri(sourceUri);

  const base64 = await FileSystem.readAsStringAsync(savedUri, {
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
  token: string,
  opts?: UploadPhotoOptions
): Promise<{ uri: string } | { error: string }> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return { error: "Permission to access photos was denied." };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { error: "cancelled" };
  }

  opts?.onUploadStart?.();
  return compressAndUpload(result.assets[0].uri, token);
}

export async function captureAndUploadPhoto(
  token: string,
  opts?: UploadPhotoOptions
): Promise<{ uri: string } | { error: string }> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    return { error: "Permission to use camera was denied." };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.85,
    cameraType: ImagePicker.CameraType.front,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { error: "cancelled" };
  }

  opts?.onUploadStart?.();
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
