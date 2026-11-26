import Image from "next/image";
import {
  formatScanDate,
  VIEW_LABELS,
  VIEWS,
  type MedixoraReport,
} from "@/src/lib/medixora/report";

/** The SkinFit report on screen: header, three white-light photos, scores below. */
export function MedixoraReportView({ patientName, report }: { patientName: string; report: MedixoraReport }) {
  const facts = [report.customer.gender, report.customer.age ? `${report.customer.age} years` : ""].filter(Boolean);
  return (
    <article className="overflow-hidden rounded-2xl border border-[#E4E6F0] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#1E1B31] px-5 py-4">
        <Image src="/branding/skinfit-wellness-logo.svg" alt="SkinFit Wellness" width={560} height={135} className="h-8 w-auto" />
        <div className="sm:text-right">
          <h2 className="font-headline text-lg font-semibold text-[#1E1B31]">Skin Analysis Report</h2>
          <p className="text-xs text-[#5B66A1]">Scan date: {formatScanDate(report.scannedAt)}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <p className="font-headline text-xl font-semibold text-[#1E1B31]">{patientName}</p>
          {facts.length ? <p className="text-sm text-[#5B66A1]">{facts.join(" | ")}</p> : null}
        </div>
        {report.overallScore != null ? (
          <div className="rounded-xl bg-[#1E1B31] px-5 py-2 text-center text-white">
            <p className="text-[11px] uppercase tracking-wide text-[#AEB9E8]">Overall score</p>
            <p className="font-headline text-2xl font-semibold">{report.overallScore} / 100</p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 px-5 pt-4 sm:gap-3">
        {VIEWS.map((view) => {
          const url = report.photoUrls[view];
          return (
            <figure key={view}>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${VIEW_LABELS[view]} photo`} referrerPolicy="no-referrer" className="aspect-[3/4] w-full rounded-lg bg-[#FAF8F5] object-contain" />
                </a>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-[#FAF8F5] text-xs text-[#5B66A1]">Not captured</div>
              )}
              <figcaption className="mt-1 text-center text-xs font-semibold text-[#1E1B31]">{VIEW_LABELS[view]}</figcaption>
            </figure>
          );
        })}
      </div>

      <div className="px-5 pb-5 pt-5">
        <h3 className="font-headline text-lg font-semibold text-[#1E1B31]">Scores</h3>
        <table className="mt-2 w-full text-sm text-[#1E1B31]">
          <thead className="bg-[#F0EAE2] text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Measure</th>
              {VIEWS.map((v) => (
                <th key={v} className="px-2 py-2 text-center font-semibold">{VIEW_LABELS[v]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.scores.map((row) => (
              <tr key={row.name} className="border-b border-[#E4E6F0]">
                <td className="px-3 py-2">{row.name}</td>
                {VIEWS.map((v) => (
                  <td key={v} className="px-2 py-2 text-center font-semibold">{row[v] ?? "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-[#5B66A1]">Scores as measured by the Medixora skin analyser, out of 100.</p>
      </div>
    </article>
  );
}
