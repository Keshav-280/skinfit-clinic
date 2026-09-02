import { notifyDoctorUsers } from "@/src/lib/expoPush";
import { patientHasOnboardingClinicalAlert } from "@/src/lib/patientOnboardingClinicalAlert";
import { postPatientDoctorThreadMessage } from "@/src/lib/patientDoctorChat";

/**
 * Red-flag questionnaire outcomes: urgent doctor thread + staff push (same path as SOS visibility).
 */
export async function notifyStaffQuestionnaireRedFlags(opts: {
  patientId: string;
  patientName: string;
  chronicConcern: boolean;
  highSensitivity: boolean;
}): Promise<void> {
  if (
    !patientHasOnboardingClinicalAlert({
      concernDuration: opts.chronicConcern ? "chronic" : null,
      skinSensitivity: opts.highSensitivity ? "high" : null,
    })
  ) {
    return;
  }

  const lines: string[] = [];
  if (opts.chronicConcern) {
    lines.push(
      "Chronic concern (>1 year) - “Chronic concern” flag on kAI report; please review."
    );
  }
  if (opts.highSensitivity) {
    lines.push(
      "High skin sensitivity - flag on kAI report; please review product prescription."
    );
  }

  const text = `📋 kAI questionnaire alert - ${opts.patientName}\n${lines.join("\n")}`;

  await postPatientDoctorThreadMessage(opts.patientId, text, true);

  await notifyDoctorUsers({
    title: "kAI questionnaire alert",
    body: lines.join(" · ").slice(0, 180),
    data: {
      type: "questionnaire_alert",
      patientId: opts.patientId,
      patientName: opts.patientName.slice(0, 80),
    },
  });
}
