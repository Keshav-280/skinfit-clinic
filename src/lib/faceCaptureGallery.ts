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
): Array<{ label: string; imageUrl: string; poseId?: string }> | undefined {
  if (!captures?.length) return undefined;
  return captures.map((entry, i) => {
    const direct = resolveCaptureImageSrc(entry);
    const byLabel = FACE_SCAN_CAPTURE_STEPS.find((s) => s.id === entry.label);
    const byIndex = FACE_SCAN_CAPTURE_STEPS[i];
    return {
      label: byLabel?.title ?? byIndex?.title ?? entry.label,
      poseId: byLabel?.id ?? byIndex?.id,
      imageUrl: direct ?? patientScanImagePath(scanId, { index: i }),
    };
  });
}
