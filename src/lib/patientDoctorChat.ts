import { db } from "@/src/db";
import { chatMessages } from "@/src/db/schema";
import { notifyChatThreadUpdated } from "@/src/lib/chatLive";
import {
  ensureDoctorPatientChatThread,
  getAssignedDoctorIdForPatient,
  listRegisteredClinicDoctors,
} from "@/src/lib/doctorPatientCare";

export type PatientDoctorMessageInsert = {
  text: string;
  isUrgent: boolean;
  attachmentUrl?: string | null;
};

async function insertPatientDoctorThreadMessage(
  threadId: string,
  body: PatientDoctorMessageInsert
): Promise<void> {
  const text = body.text.trim().slice(0, 12_000);
  if (!text && !body.attachmentUrl) return;

  await db.insert(chatMessages).values({
    threadId,
    sender: "patient",
    text: text || (body.attachmentUrl?.startsWith("data:audio/") ? "🎤 Voice note" : "🖼️ Image"),
    isUrgent: body.isUrgent,
    attachmentUrl: body.attachmentUrl ?? null,
  });
  await notifyChatThreadUpdated(threadId);
}

/** Urgent patient message on every registered doctor↔patient thread (shared clinic). */
export async function postPatientUrgentMessageToAllClinicDoctors(
  patientId: string,
  body: PatientDoctorMessageInsert
): Promise<{ primaryThreadId: string | null; notifiedThreadCount: number }> {
  const doctors = await listRegisteredClinicDoctors();
  if (doctors.length === 0) {
    return { primaryThreadId: null, notifiedThreadCount: 0 };
  }

  let primaryThreadId: string | null = null;
  let notifiedThreadCount = 0;

  for (const doc of doctors) {
    const threadId = await ensureDoctorPatientChatThread(patientId, doc.id);
    await insertPatientDoctorThreadMessage(threadId, body);
    notifiedThreadCount += 1;
    if (!primaryThreadId) primaryThreadId = threadId;
  }

  return { primaryThreadId, notifiedThreadCount };
}

/** Patient-originated message on one doctor chat thread (non-urgent alerts). */
export async function postPatientDoctorThreadMessage(
  userId: string,
  text: string,
  isUrgent: boolean,
  attachmentUrl?: string | null
): Promise<void> {
  const body: PatientDoctorMessageInsert = {
    text,
    isUrgent,
    attachmentUrl: attachmentUrl ?? null,
  };

  if (isUrgent) {
    const { notifiedThreadCount } = await postPatientUrgentMessageToAllClinicDoctors(
      userId,
      body
    );
    if (notifiedThreadCount === 0) {
      throw new Error("NO_CLINIC_DOCTOR");
    }
    return;
  }

  const doctorId = await getAssignedDoctorIdForPatient(userId);
  if (!doctorId) {
    throw new Error("NO_ASSIGNED_DOCTOR");
  }

  const threadId = await ensureDoctorPatientChatThread(userId, doctorId);
  await insertPatientDoctorThreadMessage(threadId, body);
}
