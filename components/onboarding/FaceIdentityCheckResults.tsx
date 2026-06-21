import type { FaceIdentityImageCheck } from "@/src/lib/scanFaceIdentityGate";
import { formatFaceIdentityCheckLine } from "@/src/lib/faceIdentityCheckDisplay";

export function FaceIdentityCheckResults({
  checks,
  className = "",
}: {
  checks: FaceIdentityImageCheck[];
  className?: string;
}) {
  if (checks.length === 0) return null;

  return (
    <ul
      className={`space-y-1.5 rounded-xl border border-rose-100 bg-white/80 px-4 py-3 text-left text-sm text-rose-950 ${className}`}
      aria-label="Face verification by photo"
    >
      {checks.map((check) => {
        const matched = check.matched;
        const detected = check.faceDetected;
        return (
          <li key={check.label} className="flex items-start gap-2">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                matched
                  ? "bg-emerald-100 text-emerald-800"
                  : detected
                    ? "bg-rose-100 text-rose-800"
                    : "bg-zinc-100 text-zinc-600"
              }`}
              aria-hidden
            >
              {matched ? "✓" : detected ? "✗" : "—"}
            </span>
            <span>
              {formatFaceIdentityCheckLine(check)}
              {typeof check.similarity === "number" && check.faceDetected ? (
                <span className="ml-1 text-xs text-rose-900/70">
                  ({Math.round(check.similarity * 100)}%
                  {typeof check.threshold === "number"
                    ? ` · need ${Math.round(check.threshold * 100)}%`
                    : ""}
                  )
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
