import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { listScanReviews, REVIEW_HOURS } from "@/src/lib/scanReview/review";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scan reviews" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function waited(iso: string) {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);
  return hours < 1 ? "under an hour" : `${hours} h`;
}

export default async function ScanReviewsPage() {
  if (!(await getDoctorPortalUserId())) redirect("/clinic/login?next=/clinic/ops/reviews");
  const { waiting, done } = await listScanReviews();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[#1E1B31]">Scan reviews</h1>
          <p className="text-sm text-[#6B7280]">
            Patients see nothing until you approve. Each was promised a report within {REVIEW_HOURS} hours.
          </p>
        </div>
        <Link href="/clinic/ops" className="text-sm font-semibold text-[#2B2F63] underline">
          Back to Ops
        </Link>
      </div>

      <section className="overflow-x-auto rounded-xl border border-[#E4E6F0] bg-white">
        <h2 className="border-b border-[#E4E6F0] px-4 py-3 text-sm font-semibold text-[#1E1B31]">
          Waiting ({waiting.length}), oldest first
        </h2>
        {waiting.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#6B7280]">Nothing is waiting.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {waiting.map((r) => (
                <tr key={r.id} className="border-b border-[#E4E6F0] last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#1E1B31]">{r.patientName}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{when(r.capturedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={r.overdue ? "rounded-md bg-red-50 px-2 py-1 font-semibold text-red-800" : "text-[#6B7280]"}>
                      {r.overdue ? "Overdue, " : "Waiting "}
                      {waited(r.capturedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/clinic/ops/reviews/${r.id}`} className="rounded-lg bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {done.length > 0 ? (
        <section className="overflow-x-auto rounded-xl border border-[#E4E6F0] bg-white">
          <h2 className="border-b border-[#E4E6F0] px-4 py-3 text-sm font-semibold text-[#1E1B31]">Recently handled</h2>
          <table className="w-full text-sm">
            <tbody>
              {done.map((r) => (
                <tr key={r.id} className="border-b border-[#E4E6F0] last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#1E1B31]">{r.patientName}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{r.reviewedAt ? when(r.reviewedAt) : "-"}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{r.status === "approved" ? "Approved" : "Retake asked"}</td>
                  <td className="px-4 py-3 text-right">
                    {r.scanId ? (
                      <Link href={`/clinic/ops/scans/${r.scanId}`} className="font-semibold text-[#2B2F63] underline">
                        View scan
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
