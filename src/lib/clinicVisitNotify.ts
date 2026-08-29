import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { notifyPatientScoresUnlocked } from "@/src/lib/expoPush";

export const SCORES_UNLOCKED_PATIENT_MESSAGE =
  "Your clinic visit is complete. Your exact kAI score and full scan details are now unlocked — open SkinFit to view them on your dashboard and scan reports.";

/** In-app doctor chat + Expo push when clinic marks the patient visited. */
export async function notifyPatientClinicVisitScoresUnlocked(
  patientId: string,
  _staffId: string
): Promise<void> {
  // IMPORTANT: this is a clinic/support notification, not a doctor-origin message.
  await sendClinicSupportMessage({
    patientId,
    assistantId: "support",
    text: SCORES_UNLOCKED_PATIENT_MESSAGE,
    notificationType: "doctor.reply",
    // keep sender neutral; no doctor attribution for this unlock event
    doctorId: null,
  });
  void notifyPatientScoresUnlocked(patientId);
}
