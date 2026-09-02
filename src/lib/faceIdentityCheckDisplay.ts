import type { FaceIdentityImageCheck } from "@/src/lib/scanFaceIdentityGate";

/** User-facing line per photo - no similarity percentages or debug details. */
export function formatFaceIdentityCheckLine(check: FaceIdentityImageCheck): string {
  if (!check.faceDetected) {
    return `${check.title}: Face not clear - retake this photo`;
  }
  if (check.matched) return `${check.title}: OK`;
  return `${check.title}: Does not match - retake`;
}

export function formatFaceIdentityCheckSummary(
  checks: FaceIdentityImageCheck[]
): string {
  return checks.map(formatFaceIdentityCheckLine).join("\n");
}
