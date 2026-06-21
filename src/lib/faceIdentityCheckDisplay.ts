import type { FaceIdentityImageCheck } from "@/src/lib/scanFaceIdentityGate";

export function formatFaceIdentityCheckLine(check: FaceIdentityImageCheck): string {
  if (!check.faceDetected) return `${check.title}: No face detected`;
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
