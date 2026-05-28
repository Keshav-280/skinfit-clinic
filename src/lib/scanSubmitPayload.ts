import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import {
  assertSafeStoragePath,
  getStorage,
} from "@/src/lib/infra";
import type { ScanCaptureImageRef } from "@/src/lib/infra";

export async function buildScanImagesFromForm(
  multiRaw: File[]
): Promise<{
  imagePaths: Record<string, string>;
  faceCaptureImages: ScanCaptureImageRef[];
}> {
  const storage = getStorage();
  const imagePaths: Record<string, string> = {};
  const faceCaptureImages: ScanCaptureImageRef[] = [];

  for (let i = 0; i < multiRaw.length; i++) {
    const file = multiRaw[i];
    const step = FACE_SCAN_CAPTURE_STEPS[i];
    const buf = Buffer.from(await file.arrayBuffer());
    const { path, url } = await storage.upload(
      "scans",
      file.name || `${step.id}.jpg`,
      buf,
      file.type || "image/jpeg"
    );
    imagePaths[step.id] = path;
    faceCaptureImages.push({ label: step.id, imageUrl: url });
  }

  return { imagePaths, faceCaptureImages };
}

export function buildScanImagesFromPaths(
  pathsByStep: Record<string, string>
): {
  imagePaths: Record<string, string>;
  faceCaptureImages: ScanCaptureImageRef[];
} {
  const storage = getStorage();
  const imagePaths: Record<string, string> = {};
  const faceCaptureImages: ScanCaptureImageRef[] = [];

  for (const step of FACE_SCAN_CAPTURE_STEPS) {
    const path = pathsByStep[step.id];
    if (!path) {
      throw new Error(`Missing image path for step ${step.id}`);
    }
    assertSafeStoragePath(path);
    imagePaths[step.id] = path;
    faceCaptureImages.push({
      label: step.id,
      imageUrl: storage.getUrl(path),
    });
  }

  return { imagePaths, faceCaptureImages };
}

export function parseImagePathsField(raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("imagePaths must be a JSON object keyed by capture step id");
  }
  const out: Record<string, string> = {};
  for (const step of FACE_SCAN_CAPTURE_STEPS) {
    const v = (parsed as Record<string, unknown>)[step.id];
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`imagePaths.${step.id} required`);
    }
    out[step.id] = v.trim();
  }
  return out;
}
