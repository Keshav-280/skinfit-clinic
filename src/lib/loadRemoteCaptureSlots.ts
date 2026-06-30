import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";

export type RemoteCaptureImageRef = {
  label: string;
  imageUrl: string;
  previewUrl?: string;
};

export type LoadedCaptureSlot = {
  file: File;
  preview: string;
  label: (typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"];
};

/** Fetch handoff photos from storage URLs into ordered capture slots. */
export async function loadRemoteCaptureSlots(
  refs: RemoteCaptureImageRef[],
  fetchImpl: typeof fetch = fetch
): Promise<LoadedCaptureSlot[]> {
  const slots: LoadedCaptureSlot[] = [];

  for (const step of FACE_SCAN_CAPTURE_STEPS) {
    const ref =
      refs.find((r) => r.label === step.id) ??
      refs[FACE_SCAN_CAPTURE_STEPS.indexOf(step)];
    if (!ref) {
      throw new Error(`Missing photo for ${step.title}.`);
    }

    const url =
      publicFileDisplayUrl(ref.previewUrl ?? ref.imageUrl) ?? ref.imageUrl;
    const res = await fetchImpl(url, { credentials: "include" });
    if (!res.ok) {
      throw new Error(`Could not load ${step.title} (${res.status}).`);
    }

    const blob = await res.blob();
    const file = new File([blob], `face-${step.id}.jpg`, {
      type: blob.type || "image/jpeg",
    });
    slots.push({
      file,
      preview: URL.createObjectURL(blob),
      label: step.id,
    });
  }

  return slots;
}
