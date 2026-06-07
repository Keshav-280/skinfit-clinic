import { DoctorClinicWalletClient } from "@/components/doctor/DoctorClinicWalletClient";

export default async function DoctorClinicWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const params = await searchParams;
  const initialPatientId =
    typeof params.patientId === "string" ? params.patientId : undefined;

  return <DoctorClinicWalletClient initialPatientId={initialPatientId} />;
}
