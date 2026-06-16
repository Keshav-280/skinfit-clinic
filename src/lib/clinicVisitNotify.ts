import { db } from "@/src/db";
import { chatMessages } from "@/src/db/schema";
import { notifyChatThreadUpdated } from "@/src/lib/chatLive";
import { ensureDoctorPatientChatThread } from "@/src/lib/doctorPatientCare";
import { notifyPatientScoresUnlocked } from "@/src/lib/expoPush";

export const SCORES_UNLOCKED_PATIENT_MESSAGE =
  "Your clinic visit is complete. Your exact kAI score and full scan details are now unlocked — open SkinnFit to view them on your dashboard and scan reports.";

/** In-app doctor chat + Expo push when clinic marks the patient visited. */
export async function notifyPatientClinicVisitScoresUnlocked(
  patientId: string,
  staffId: string
): Promise<void> {
  const threadId = await ensureDoctorPatientChatThread(patientId, staffId);
  await db.insert(chatMessages).values({
    threadId,
    sender: "doctor",
    text: SCORES_UNLOCKED_PATIENT_MESSAGE,
  });
  await notifyChatThreadUpdated(threadId);
  void notifyPatientScoresUnlocked(patientId);
}
