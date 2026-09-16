import type { Metadata } from "next";
import { OpsOverviewClient } from "@/components/ops/OpsOverviewClient";
import { loadOpsOverview } from "@/src/lib/ops/loadOpsOverview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ops",
  description: "Website signups, logins, scans, and questionnaire completion.",
};

export default async function ClinicOpsPage() {
  const data = await loadOpsOverview();
  return <OpsOverviewClient data={data} />;
}
