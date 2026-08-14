import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { patientScanImagePath } from "@/src/lib/patientScanImagePath";
import {
  resolveCaptureImageSrc,
  type FaceCaptureRef,
} from "@/src/lib/resolveScanImageUrl";

/** Gallery entries for report UI — prefers scan image API by index (stable auth). */
export function buildFaceCaptureGallery(
  scanId: number,
  captures: FaceCaptureRef[] | null | undefined
): Array<{ label: string; imageUrl: string; poseId?: string }> | undefined {
  if (!captures?.length) return undefined;
  return captures.map((entry, i) => {
    const byLabel = FACE_SCAN_CAPTURE_STEPS.find((s) => s.id === entry.label);
    const byIndex = FACE_SCAN_CAPTURE_STEPS[i];
    const poseId = byLabel?.id ?? byIndex?.id;
    const title = byLabel?.title ?? byIndex?.title ?? entry.label;
    // Authenticated by-index URL is reliable across devices; fall back to stored URL.
    const apiUrl = patientScanImagePath(scanId, { index: i, preview: true });
    const direct = resolveCaptureImageSrc(entry, true);
    return {
      label: title,
      poseId,
      imageUrl: apiUrl || direct || patientScanImagePath(scanId, { index: i }),
    };
  });
}
