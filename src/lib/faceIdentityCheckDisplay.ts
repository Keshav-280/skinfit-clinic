import type { FaceIdentityImageCheck } from "@/src/lib/scanFaceIdentityGate";

export function formatFaceIdentityCheckLine(check: FaceIdentityImageCheck): string {
  if (!check.faceDetected) {
    const reason = check.error ? ` [${check.error}]` : "";
    const size =
      typeof check.bytes === "number"
        ? ` (${(check.bytes / 1024).toFixed(0)} KB)`
        : "";
    return `${check.title}: No face detected${reason}${size}`;
  }
  const score =
    typeof check.similarity === "number"
      ? ` (${Math.round(check.similarity * 100)}%${
          typeof check.threshold === "number"
            ? ` · need ${Math.round(check.threshold * 100)}%`
            : ""
        })`
      : "";
  if (check.matched) return `${check.title}: Match${score}`;
  return `${check.title}: No match${score}`;
}

export function formatFaceIdentityCheckSummary(
  checks: FaceIdentityImageCheck[]
): string {
  return checks.map(formatFaceIdentityCheckLine).join("\n");
}
