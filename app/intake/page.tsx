import type { Metadata } from "next";
import { ClinicIntakeForm } from "@/components/intake/ClinicIntakeForm";

export const metadata: Metadata = {
  title: "Patient form",
  description: "SkinFit patient profile and consultation form.",
  robots: { index: false, follow: false },
};

export default function IntakePage() {
  return <ClinicIntakeForm />;
}
