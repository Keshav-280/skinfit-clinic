import Link from "next/link";
import { format, parseISO } from "date-fns";
import { SquareCheck } from "lucide-react";

export type LastTreatmentVisit = {
  id: string;
  visitDate: string;
  doctorName: string;
};

function formatVisitDate(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "d MMM yyyy");
  } catch {
    return ymd;
  }
}

function doctorLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "your clinician";
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export function LastTreatmentCard({ visit }: { visit: LastTreatmentVisit }) {
  return (
    <article
      className="flex items-center gap-3 rounded-2xl px-4 py-4 sm:gap-4 sm:px-5"
      style={{ backgroundColor: "#e0e5df" }}
    >
      <SquareCheck
        className="h-6 w-6 shrink-0 text-[#2C3E6B] sm:h-7 sm:w-7"
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-zinc-600">Last treatment</p>
        <p className="text-base font-bold leading-snug text-[#1A1A2E] sm:text-[17px]">
          {formatVisitDate(visit.visitDate)}
        </p>
        <p className="text-[13px] leading-snug text-zinc-600">
          with {doctorLabel(visit.doctorName)}
        </p>
      </div>
      <Link
        href="/dashboard/history/visits"
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] px-[18px] py-2 text-[13px] font-semibold text-white transition hover:bg-[#3d5080]"
      >
        View
      </Link>
    </article>
  );
}
