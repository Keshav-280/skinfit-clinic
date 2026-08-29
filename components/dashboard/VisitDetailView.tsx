import { format } from "date-fns";
import { Download, FileText } from "lucide-react";
import { dateOnlyFromYmd } from "@/src/lib/date-only";
import {
  type PatientVisitDetail,
  visitResponseRatingStyle,
} from "@/src/lib/patientVisit";

function formatVisitDate(ymd: string): string {
  try {
    return format(dateOnlyFromYmd(ymd), "d MMM yyyy");
  } catch {
    return ymd;
  }
}

function VisitSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[18px] border border-zinc-100 bg-white/95 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[#1E1B31]">
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800">
        {body}
      </p>
    </section>
  );
}

export function VisitDetailView({ visit }: { visit: PatientVisitDetail }) {
  const ratingStyle = visitResponseRatingStyle(visit.responseRating);
  const ratingLabel = visit.responseRating
    ? visit.responseRating.charAt(0).toUpperCase() +
      visit.responseRating.slice(1)
    : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-zinc-100 bg-white/95 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <p className="text-xl font-bold text-zinc-900">{formatVisitDate(visit.visitDateYmd)}</p>
        <p className="mt-1 text-sm text-zinc-600">with Dr. {visit.doctorName}</p>
        {ratingLabel && ratingStyle ? (
          <span
            className="mt-3 inline-flex rounded-full px-3.5 py-1 text-sm font-bold"
            style={{ backgroundColor: ratingStyle.bg, color: ratingStyle.text }}
          >
            {ratingLabel}
          </span>
        ) : null}
      </section>

      {visit.purpose ? <VisitSection title="Purpose" body={visit.purpose} /> : null}
      {visit.treatments ? (
        <VisitSection title="Treatments" body={visit.treatments} />
      ) : null}
      {visit.preAdvice ? (
        <VisitSection title="Pre-Treatment Advice" body={visit.preAdvice} />
      ) : null}
      {visit.postAdvice ? (
        <VisitSection title="Post-Treatment Advice" body={visit.postAdvice} />
      ) : null}
      {visit.prescription ? (
        <VisitSection title="Prescription" body={visit.prescription} />
      ) : null}
      {visit.notes ? <VisitSection title="Doctor's Notes" body={visit.notes} /> : null}

      {visit.attachments && visit.attachments.length > 0 ? (
        <section className="rounded-[18px] border border-zinc-100 bg-white/95 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#1E1B31]">
            Attachments
          </h2>
          <div className="mt-4 space-y-4">
            {visit.attachments.map((att, idx) => {
              const isImage = att.mimeType.startsWith("image/");
              if (isImage) {
                return (
                  <div
                    key={`${visit.id}-att-${idx}`}
                    className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.dataUri}
                      alt={att.fileName}
                      className="max-h-[min(420px,60vh)] w-full object-contain"
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2.5">
                      <p className="min-w-0 truncate text-xs text-zinc-500">{att.fileName}</p>
                      <a
                        href={att.dataUri}
                        download={att.fileName}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#e8ede6] px-3 py-1.5 text-sm font-semibold text-[#1E1B31] hover:bg-[#dce5da]"
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        Download
                      </a>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={`${visit.id}-att-${idx}`}
                  className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
                >
                  <FileText className="h-5 w-5 shrink-0 text-[#1E1B31]" aria-hidden />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
                    {att.fileName}
                  </p>
                  <a
                    href={att.dataUri}
                    download={att.fileName}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#e8ede6] px-3 py-1.5 text-sm font-semibold text-[#1E1B31] hover:bg-[#dce5da]"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}