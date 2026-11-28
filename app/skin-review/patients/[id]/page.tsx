import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { patientReviews } from "@/src/lib/scanReview/review";
import { isReviewSignedIn } from "@/src/lib/skinReview/auth";
import { STAFF_AREAS } from "@/src/lib/staffReview/model";

export const dynamic = "force-dynamic";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS: Record<string, string> = {
  pending: "Waiting for scores",
  publishing: "Being sent",
  approved: "Sent to patient",
  retake: "Retake asked",
};

export default async function SkinReviewPatientPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isReviewSignedIn())) redirect("/skin-review");
  const data = await patientReviews((await params).id);
  if (!data) notFound();
  const { patient, reviews } = data;

  return (
    <div className="space-y-5">
      <Link href="/skin-review" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E1B31] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All patients
      </Link>
      <section className="rounded-2xl bg-[#1E1B31] p-5 text-white">
        <h1 className="font-headline text-2xl font-semibold">{patient.name}</h1>
        <p className="text-sm text-[#AEB9E8]">
          {[patient.age != null ? `${patient.age} yrs` : null, patient.gender].filter(Boolean).join(" | ")}
        </p>
      </section>

      {reviews.length === 0 ? <p className="text-sm text-[#6B7280]">No app scan from this patient yet.</p> : null}

      {reviews.map((r) => (
        <section key={r.id} className="rounded-2xl border border-[#E4E6F0] bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#1E1B31]">{when(r.capturedAt)}</p>
              <p className="text-xs text-[#6B7280]">
                {STATUS[r.status] ?? r.status}
                {r.reviewer ? ` by ${r.reviewer}` : ""}
                {r.reason ? `: ${r.reason}` : ""}
              </p>
            </div>
            <a href={`/skin-review-tool.html?id=${r.id}`} className="rounded-lg bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white">
              {r.status === "pending" ? "Mark and score" : "View markings"}
            </a>
          </div>
          {r.result ? (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-7">
                <div>
                  <dt className="text-xs text-[#6B7280]">Overall</dt>
                  <dd className="text-xl font-semibold text-[#1E1B31]">{r.result.overall}</dd>
                </div>
                {STAFF_AREAS.map((a) => (
                  <div key={a.key}>
                    <dt className="text-xs text-[#6B7280]">{a.label}</dt>
                    <dd className="text-xl font-semibold text-[#1E1B31]">{r.result!.scores[a.key]}</dd>
                  </div>
                ))}
              </dl>
              {r.result.note ? <p className="mt-3 text-sm text-[#1E1B31]">Note: {r.result.note}</p> : null}
            </>
          ) : null}
        </section>
      ))}
    </div>
  );
}
