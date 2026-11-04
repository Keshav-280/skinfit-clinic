import type { Metadata } from "next";
import Link from "next/link";
import { OpsOverviewClient } from "@/components/ops/OpsOverviewClient";
import { loadOpsOverview } from "@/src/lib/ops/loadOpsOverview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ops",
  description: "Website signups, logins, scans, and questionnaire completion.",
};

export default async function ClinicOpsPage() {
  const data = await loadOpsOverview();
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-3">
        <Link href="/clinic/ops/scans" className="text-sm font-semibold text-[#2B2F63] underline">
          Scan inspector: view annotations and raw scores
        </Link>
      </div>
      <OpsOverviewClient data={data} />
    </>
  );
}
