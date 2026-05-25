import { apiUrl } from "@/lib/apiBase";
import type { FacePreviewInferenceResult } from "../../src/lib/faceCaptureTypes";

export async function fetchFacePreviewInference(
  token: string | null,
  jpegUri: string,
  signal?: AbortSignal
): Promise<FacePreviewInferenceResult | null> {
  if (!token) return null;

  const form = new FormData();
  form.append("file", {
    uri: jpegUri,
    name: "preview.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  const res = await fetch(apiUrl("/api/capture/preview"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  });

  if (res.status === 503 || !res.ok) return null;

  const json = (await res.json()) as {
    success?: boolean;
    data?: FacePreviewInferenceResult;
  };
  return json.success && json.data ? json.data : null;
}
