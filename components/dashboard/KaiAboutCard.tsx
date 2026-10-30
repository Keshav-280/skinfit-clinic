import { FREE_AI_MESSAGE_LIMIT } from "@/src/lib/aiChatLimitShared";
import {
  patientDashboardCard,
  patientMuted,
  patientSectionTitle,
} from "@/src/lib/patientDashboardTheme";

export function KaiAboutCard() {
  return (
    <section className={`${patientDashboardCard} p-5 sm:p-6`}>
      <h2 className={patientSectionTitle}>About kAI and your privacy</h2>
      <ul className={`mt-3 space-y-2 ${patientMuted}`}>
        <li>
          <b className="text-[#1E1B31]">kAI is an AI companion, not a doctor.</b> It can explain your
          report and answer skin questions, but it never diagnoses or prescribes. For anything that
          worries you, use Clinic Support in the Chat tab or book a visit.
        </li>
        <li>
          To reply, your messages and the details of your reports (scores, findings, weekly check-in
          answers, treatment notes and appointments) are sent securely to our AI provider. Your photos
          are not sent, and only your first name is used.
        </li>
        <li>
          You get {FREE_AI_MESSAGE_LIMIT} free messages with kAI. Visiting the clinic unlocks unlimited
          messages.
        </li>
      </ul>
    </section>
  );
}
