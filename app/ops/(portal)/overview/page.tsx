import { OpsOverviewClient } from "@/components/ops/OpsOverviewClient";
import { loadOpsOverview } from "@/src/lib/ops/loadOpsOverview";

export const dynamic = "force-dynamic";

export default async function OpsOverviewPage() {
  const data = await loadOpsOverview();
  return <OpsOverviewClient data={data} />;
}
