import Link from "next/link";
import { format, parseISO } from "date-fns";
import { SquareCheck, User } from "lucide-react";
import { patientDoctorLabel } from "@/src/lib/doctorDisplayName";

export type LastTreatmentVisit = {
  id: string;
  visitDate: string;
  doctorName: string;
  doctorPhotoUrl?: string | null;
};

function formatVisitDate(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "d MMM yyyy");
  } catch {
    return ymd;
  }
}

function DoctorAvatar({
  photoUrl,
  className = "h-10 w-10",
}: {
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-[#2C3E6B]`}
    >
      <User className="h-1/2 w-1/2 text-white" aria-hidden />
    </div>
  );
}

export function LastTreatmentCard({
  visit,
  compact = false,
}: {
  visit: LastTreatmentVisit;
  compact?: boolean;
}) {
  return (
    <article
      className={`flex items-center gap-3 rounded-2xl ${
        compact ? "px-3 py-3" : "px-4 py-4 sm:gap-4 sm:px-5"
      }`}
      style={{ backgroundColor: "#e0e5df" }}
    >
      {visit.doctorPhotoUrl ? (
        <DoctorAvatar photoUrl={visit.doctorPhotoUrl} className="h-10 w-10" />
      ) : (
        <SquareCheck
          className="h-6 w-6 shrink-0 text-[#2C3E6B] sm:h-7 sm:w-7"
          strokeWidth={2}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-zinc-600">Last treatment</p>
        <p
          className={`font-bold leading-snug text-[#1A1A2E] ${
            compact ? "text-[15px]" : "text-base sm:text-[17px]"
          }`}
        >
          {formatVisitDate(visit.visitDate)}
        </p>
        <p className="text-[13px] leading-snug text-zinc-600">
          with {patientDoctorLabel(visit.doctorName, "your clinician")}
        </p>
      </div>
      <Link
        href="/dashboard/history/visits"
        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#2C3E6B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#243456]"
      >
        View
      </Link>
    </article>
  );
}
