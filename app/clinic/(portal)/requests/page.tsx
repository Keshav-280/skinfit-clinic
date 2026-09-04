import type { Metadata } from "next";
import { DoctorSimpleRequestsClient } from "@/components/doctor/DoctorSimpleRequestsClient";

export const metadata: Metadata = {
  title: "Requests",
  description: "Confirm or decline patient appointment requests.",
};

export default function ClinicRequestsPage() {
  return <DoctorSimpleRequestsClient />;
}
