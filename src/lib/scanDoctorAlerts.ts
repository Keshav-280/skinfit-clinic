import { notifyDoctorUsers } from "@/src/lib/expoPush";
import { listDoctorIdsForPatient } from "@/src/lib/doctorPatientCare";

/** Push assigned care-team doctors when a patient scan completes successfully. */
export async function notifyDoctorsPatientScanCompleted(opts: {
  patientId: string;
  patientName: string;
  scanId: number;
  scanName?: string | null;
}): Promise<void> {
  if (!Number.isFinite(opts.scanId) || opts.scanId < 1) return;

  const doctorIds = await listDoctorIdsForPatient(opts.patientId);
  if (doctorIds.length === 0) return;

  const scanLabel = opts.scanName?.trim() || "New skin scan";
  const patientName = opts.patientName.trim() || "Patient";

  await notifyDoctorUsers({
    title: "Patient scan ready",
    body: `${patientName} · ${scanLabel}`.slice(0, 180),
    doctorIds,
    data: {
      type: "patient_scan_completed",
      patientId: opts.patientId,
      scanId: opts.scanId,
      patientName: patientName.slice(0, 80),
    },
  });
}
