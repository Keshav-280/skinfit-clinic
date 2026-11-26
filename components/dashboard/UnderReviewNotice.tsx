import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

/** Shown after a scan is submitted: the report follows once the team has reviewed it. */
export function UnderReviewNotice({
  onDone,
  closeTabOnly = false,
}: {
  onDone?: () => void;
  /** Phone that is only used to take photos: nothing to open here. */
  closeTabOnly?: boolean;
}) {
  return (
    <section
      className="mx-auto w-full max-w-md rounded-[22px] border border-[#1E1B31]/12 bg-white px-6 py-8 text-center shadow-[0_8px_30px_rgba(30,27,49,0.06)]"
      aria-live="polite"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1E1B31] text-white" aria-hidden>
        <ClipboardCheck className="h-6 w-6" />
      </span>
      <h2 className="font-headline mt-5 text-2xl font-bold tracking-tight text-[#1E1B31]">
        Your scan is with our skin team
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#6B7280]">
        We review every scan before sharing results. Your report will be ready within 24 hours, and
        we will message you in the app when it is.
      </p>
      {closeTabOnly ? (
        <p className="mt-4 text-xs text-[#6B7280]">You can close this tab.</p>
      ) : (
        <Link
          href="/dashboard"
          onClick={onDone}
          className="mx-auto mt-6 flex min-h-[44px] w-full max-w-[240px] items-center justify-center rounded-xl bg-[#1E1B31] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#242A5F]"
        >
          Go to dashboard
        </Link>
      )}
    </section>
  );
}
