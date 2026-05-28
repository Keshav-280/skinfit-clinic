import {
  ensureDoctorPatientChatThread,
  resolveDoctorIdForPatientChat,
} from "@/src/lib/doctorPatientCare";

export type ResolvedPatientDoctorThread = {
  doctorId: string;
  threadId: string;
};

export async function resolvePatientDoctorThread(
  patientId: string,
  doctorIdParam?: string | null
): Promise<ResolvedPatientDoctorThread | null> {
  const doctorId = await resolveDoctorIdForPatientChat(
    patientId,
    doctorIdParam
  );
  if (!doctorId) return null;

  const threadId = await ensureDoctorPatientChatThread(patientId, doctorId);
  return { doctorId, threadId };
}
