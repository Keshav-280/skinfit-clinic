import Link from "next/link";
import { Lock } from "lucide-react";

const NAVY = "#2C3E6B";

export function QuestionnaireLockedCard({
  title = "Complete your questionnaire",
  description = "Answer a few questions so kAI can personalise Today’s focus, Skin DNA, and insights.",
  className = "",
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border border-dashed border-[rgba(44,62,107,0.22)] bg-white/70 px-4 py-4 text-center shadow-sm ${className}`}
    >
      <div
        className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(44, 62, 107, 0.1)", color: NAVY }}
      >
        <Lock className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-bold text-[#18181b]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#64748b]">{description}</p>
      <Link
        href="/onboarding/questionnaire?entry=resume"
        className="mt-3 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        style={{ backgroundColor: NAVY }}
      >
        Continue questionnaire
      </Link>
    </div>
  );
}
