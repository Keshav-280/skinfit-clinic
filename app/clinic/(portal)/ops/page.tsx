import type { Metadata } from "next";
import Link from "next/link";
import { OpsOverviewClient } from "@/components/ops/OpsOverviewClient";
import { countScanReviews } from "@/src/lib/scanReview/review";
import { loadOpsOverview } from "@/src/lib/ops/loadOpsOverview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ops",
  description: "Website signups, logins, scans, and questionnaire completion.",
};

export default async function ClinicOpsPage() {
  const [data, reviews] = await Promise.all([
    loadOpsOverview(),
    countScanReviews().catch((e) => {
      console.error("ops review count", e);
      return { waiting: 0, overdue: 0 };
    }),
  ]);
  return (
    <>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pt-3">
        <Link
          href="/clinic/ops/reviews"
          className="rounded-xl bg-[#1E1B31] px-4 py-2.5 text-sm font-bold text-white"
        >
          Scan reviews: {reviews.waiting} waiting
          {reviews.overdue > 0 ? `, ${reviews.overdue} overdue` : ""}
        </Link>
        <Link href="/clinic/ops/scans" className="text-sm font-semibold text-[#2B2F63] underline">
          Scan inspector: view annotations and raw scores
        </Link>
      </div>
      <OpsOverviewClient data={data} />
    </>
  );
}
