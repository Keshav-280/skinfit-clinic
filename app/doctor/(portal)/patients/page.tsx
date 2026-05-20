import type { Metadata } from "next";
import { DoctorPatientsClient } from "@/components/doctor/DoctorPatientsClient";
import { DoctorPortalCalendar } from "@/components/doctor/DoctorPortalCalendar";

export const metadata: Metadata = {
  title: "Patients",
  description:
    "Browse patients and your clinic calendar — visits, alerts, and profiles in one view.",
};

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ sos?: string }>;
}) {
  const { sos } = await searchParams;

  return (
    <article>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <DoctorPatientsClient initialSosOnly={sos === "1"} />
        <DoctorPortalCalendar className="lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-5.5rem)] lg:self-start" />
      </div>
    </article>
  );
}
