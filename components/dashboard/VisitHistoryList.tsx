import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ChevronRight, SquareCheck } from "lucide-react";
import { visitResponseRatingStyle } from "@/src/lib/patientVisit";

export type VisitHistoryRow = {
  id: string;
  visitDateYmd: string;
  doctorName: string;
  notes: string;
  purpose: string | null;
  treatments: string | null;
  responseRating: string | null;
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

function visitSummary(v: VisitHistoryRow): string {
  return (
    v.treatments?.trim() ||
    v.purpose?.trim() ||
    v.notes?.trim() ||
    "Clinic visit"
  );
}

export function VisitHistoryList({ visits }: { visits: VisitHistoryRow[] }) {
  if (visits.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-600">
        No clinic visits yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {visits.map((visit, idx) => {
        const isFirst = idx === 0;
        const ratingStyle = visit.responseRating
          ? visitResponseRatingStyle(visit.responseRating)
          : null;

        return (
          <li key={visit.id}>
            <Link
              href={`/dashboard/history/visits/${visit.id}`}
              className={`flex items-center gap-3 rounded-2xl p-4 transition hover:opacity-95 ${
                isFirst
                  ? "bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                  : "bg-[#e8ede6]"
              }`}
            >
              <SquareCheck
                className="h-[22px] w-[22px] shrink-0 text-[#2C3E6B]"
                strokeWidth={2}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold text-[#1A1A2E]">
                    {formatVisitDate(visit.visitDateYmd)}
                  </p>
                  {isFirst ? (
                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                      Latest
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-zinc-600">
                  {visitSummary(visit)}
                </p>
                <p className="mt-0.5 text-[13px] text-zinc-500">
                  with {doctorLabel(visit.doctorName)}
                </p>
                {visit.responseRating && ratingStyle ? (
                  <span
                    className="mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold capitalize"
                    style={{
                      backgroundColor: ratingStyle.bg,
                      color: ratingStyle.fg,
                    }}
                  >
                    Response: {visit.responseRating}
                  </span>
                ) : null}
              </div>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-slate-400"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
