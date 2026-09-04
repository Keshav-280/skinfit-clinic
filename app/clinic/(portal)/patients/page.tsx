import type { Metadata } from "next";
import { DoctorSimplePatientsClient } from "@/components/doctor/DoctorSimplePatientsClient";

export const metadata: Metadata = {
  title: "Patients",
  description: "Open a patient to review details, reports, and chat.",
};

export default function ClinicPatientsPage() {
  return <DoctorSimplePatientsClient />;
}
