import type { FacePreviewInferenceResult } from "@/src/lib/faceCaptureTypes";

export async function fetchFacePreviewInference(
  jpeg: Blob,
  opts?: { authToken?: string | null; signal?: AbortSignal }
): Promise<FacePreviewInferenceResult | null> {
  const form = new FormData();
  form.append("file", jpeg, "preview.jpg");

  const headers: HeadersInit = {};
  if (opts?.authToken) {
    headers.Authorization = `Bearer ${opts.authToken}`;
  }

  const res = await fetch("/api/capture/preview", {
    method: "POST",
    body: form,
    headers,
    credentials: opts?.authToken ? "omit" : "include",
    signal: opts?.signal,
  });

  if (res.status === 503 || res.status === 401) return null;
  if (!res.ok) return null;

  const json = (await res.json()) as {
    success?: boolean;
    data?: FacePreviewInferenceResult;
  };
  return json.success && json.data ? json.data : null;
}

/** Encode ImageData to JPEG blob for preview API. */
export async function imageDataToJpegBlob(
  imageData: ImageData,
  quality = 0.72
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
}
