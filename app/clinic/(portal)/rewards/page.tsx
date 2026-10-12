import type { Metadata } from "next";
import { DoctorRewardsClient } from "@/components/doctor/DoctorRewardsClient";

export const metadata: Metadata = { title: "Rewards" };

export default async function ClinicRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const params = await searchParams;
  const initialPatientId =
    typeof params.patientId === "string" ? params.patientId : undefined;
  return <DoctorRewardsClient initialPatientId={initialPatientId} />;
}
