import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { patientScanImagePath } from "@/src/lib/patientScanImagePath";
import {
  resolveCaptureImageSrc,
  type FaceCaptureRef,
} from "@/src/lib/resolveScanImageUrl";

/** Gallery entries for report UI — prefers stored file URLs, falls back to scan image API. */
export function buildFaceCaptureGallery(
  scanId: number,
  captures: FaceCaptureRef[] | null | undefined
): Array<{ label: string; imageUrl: string }> | undefined {
  if (!captures?.length) return undefined;
  return captures.map((entry, i) => {
    const direct = resolveCaptureImageSrc(entry);
    return {
      label: FACE_SCAN_CAPTURE_STEPS[i]?.title ?? entry.label,
      imageUrl: direct ?? patientScanImagePath(scanId, { index: i }),
    };
  });
}
