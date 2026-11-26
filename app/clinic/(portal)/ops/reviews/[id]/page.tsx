import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { buildFaceCaptureGallery } from "@/src/lib/faceCaptureGallery";
import { scanDisplayMetricsFromRow } from "@/src/lib/resolveScanDisplayScores";
import { getScanReview } from "@/src/lib/scanReview/review";
import { ScanReviewActions } from "@/components/ops/ScanReviewActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review scan" };

export default async function ReviewScanPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getDoctorPortalUserId())) redirect("/clinic/login?next=/clinic/ops/reviews");
  const review = await getScanReview((await params).id);
  if (!review) notFound();

  const back = (
    <Link href="/clinic/ops/reviews" className="text-sm font-semibold text-[#2B2F63] underline">
      All reviews
    </Link>
  );
  const values = review.pending?.scanValues;
  if (!values || review.status !== "pending") {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        {back}
        <p className="rounded-xl border border-[#E4E6F0] bg-white p-4 text-sm text-[#1E1B31]">
          {review.status === "approved" ? "This scan was approved." : review.status === "retake" ? `A retake was asked: ${review.reason}` : "This scan is being processed."}
        </p>
      </div>
    );
  }

  const stored = (values.scores ?? {}) as Record<string, unknown>;
  const marked = (stored.spotAnnotatedByPose ?? {}) as Record<string, string>;
  const gallery = buildFaceCaptureGallery(0, values.faceCaptureImages as never) ?? [];
  const photos = (gallery.length ? gallery : [{ label: "Front Profile", poseId: "centre" }]).map((g, i) => ({
    label: g.label,
    poseId: g.poseId ?? "",
    original: `/api/clinic/scan-reviews/${review.id}/image?i=${i}`,
    marked: g.poseId && marked[g.poseId] ? `/api/clinic/scan-reviews/${review.id}/image?marked=${g.poseId}` : null,
  }));

  // The same display rules the patient will get, including the limit on early scans.
  const metrics = scanDisplayMetricsFromRow({
    overallScore: values.overallScore,
    acne: values.acne,
    wrinkles: values.wrinkles,
    pigmentation: values.pigmentation,
    hydration: values.hydration,
    texture: values.texture,
    scores: { ...stored, scanOrdinal: review.earlierScans + 1 },
  });
  const scores: [string, number][] = [
    ["Overall", metrics.overall_score],
    ["Acne", metrics.acne],
    ["Pigmentation", metrics.pigmentation],
    ["Wrinkles", metrics.wrinkles],
    ["Under-eye", metrics.hydration],
    ["Acne scars", metrics.texture],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      {back}
      <div>
        <h1 className="text-xl font-semibold text-[#1E1B31]">{review.patientName}</h1>
        <p className="text-sm text-[#6B7280]">
          Taken {new Date(review.capturedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          {review.age ? ` | ${review.age} years` : ""} | {review.earlierScans === 0 ? "First scan" : `${review.earlierScans} earlier scans`}
        </p>
      </div>
      <section className="rounded-xl border border-[#E4E6F0] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1E1B31]">Scores the patient will see</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
          {scores.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-[#6B7280]">{label}</dt>
              <dd className="text-xl font-semibold text-[#1E1B31]">{Math.round(value)}</dd>
            </div>
          ))}
        </dl>
        {values.aiSummary ? <p className="mt-3 text-sm text-[#1E1B31]">{values.aiSummary}</p> : null}
        <p className="mt-2 text-xs text-[#6B7280]">
          The longer written report is created after you approve.
        </p>
      </section>
      <ScanReviewActions reviewId={review.id} patientName={review.patientName} photos={photos} />
    </div>
  );
}
