import Link from "next/link";

/**
 * Shown when the model's read of one skin area looked unreliable (far below the rest and
 * either a sudden drop or an extreme first-scan gap). The number on screen is then an
 * estimate; a retake of the front photo confirms or replaces it.
 */
export function ScoreReviewNotice({
  labels,
  className = "",
}: {
  labels: string[];
  className?: string;
}) {
  if (labels.length === 0) return null;
  const list =
    labels.length === 1
      ? labels[0]!
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 rounded-xl bg-[#F0EAE2] px-3.5 py-3 ${className}`}
    >
      <p className="text-[12.5px] leading-snug text-[#1E1B31]">
        We couldn&apos;t read <span className="font-semibold">{list}</span> clearly on this scan,
        so it&apos;s shown as an estimate. Retake your front photo in even light to confirm it.
      </p>
      <Link
        href="/dashboard/scan"
        className="shrink-0 rounded-full bg-[#1E1B31] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#5B66A1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B31]/30"
      >
        Retake
      </Link>
    </div>
  );
}
