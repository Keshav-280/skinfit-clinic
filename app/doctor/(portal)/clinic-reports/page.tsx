import { Suspense } from "react";
import { DoctorClinicReportsClient } from "@/components/doctor/DoctorClinicReportsClient";

export default function DoctorClinicReportsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-zinc-500">Loading…</p>}>
      <DoctorClinicReportsClient />
    </Suspense>
  );
}
