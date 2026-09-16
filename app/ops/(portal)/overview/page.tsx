import { redirect } from "next/navigation";
import { OPS_IN_CLINIC_PATH } from "@/src/lib/auth/ops-portal-next";

export default function OpsOverviewPage() {
  redirect(OPS_IN_CLINIC_PATH);
}
