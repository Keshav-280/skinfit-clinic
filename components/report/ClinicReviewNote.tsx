import { ShieldCheck } from "lucide-react";
import { readStaffReview } from "@/src/lib/staffReview/model";

/** Top of a staff-scored report: who it came from, and the clinic's note if there is one. */
export function ClinicReviewNote({ scores }: { scores: unknown }) {
  const review = readStaffReview(scores);
  if (!review) return null;
  return (
    <section className="mx-auto mb-4 w-full max-w-3xl rounded-2xl border border-[#1E1B31]/15 bg-white px-5 py-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#1E1B31]">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Reviewed by the SkinFit clinic team
      </p>
      {review.note ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#1E1B31]">{review.note}</p>
      ) : null}
    </section>
  );
}
