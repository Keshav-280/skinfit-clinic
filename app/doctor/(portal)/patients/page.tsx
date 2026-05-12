import { DoctorPatientsClient } from "@/components/doctor/DoctorPatientsClient";

export default function PatientsPage({
  searchParams,
}: {
  searchParams: { sos?: string };
}) {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Patients</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage and view patient profiles, scans, and treatment plans
        </p>
      </div>
      <DoctorPatientsClient initialSosOnly={searchParams.sos === "1"} />
    </div>
  );
}
