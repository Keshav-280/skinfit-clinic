import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, users } from "@/src/db/schema";
import { notifyChatThreadUpdated } from "@/src/lib/chatLive";
import { ensureDoctorPatientChatThread } from "@/src/lib/doctorPatientCare";
import { notifyPatientRoutinePlanUpdated } from "@/src/lib/expoPush";
import { publishNotification } from "@/src/lib/infra";
import { coerceRoutinePlanList } from "@/src/lib/routine";

function buildRoutinePlanMessage(opts: {
  kind: "set" | "clear";
  priorHadPlan: boolean;
  effectiveFromYmd: string;
  amCount: number;
  pmCount: number;
}): { title: string; text: string } {
  if (opts.kind === "clear") {
    return {
      title: "Routine cleared",
      text: `Your clinic cleared your AM/PM routine checklist (effective ${opts.effectiveFromYmd}).`,
    };
  }
  if (!opts.priorHadPlan) {
    return {
      title: "Routine added",
      text: `Your clinic set your AM/PM skincare routine (${opts.amCount} morning + ${opts.pmCount} evening steps), effective ${opts.effectiveFromYmd}. Open Home to view your checklist.`,
    };
  }
  return {
    title: "Routine updated",
    text: `Your clinic updated your AM/PM routine (${opts.amCount} morning + ${opts.pmCount} evening steps), effective ${opts.effectiveFromYmd}. Days before this date stay unchanged.`,
  };
}

/** In-app doctor chat message + push when clinic saves a routine plan. */
export async function notifyPatientRoutinePlanChanged(opts: {
  patientId: string;
  staffId: string;
  effectiveFromYmd: string;
  kind: "set" | "clear";
  priorHadPlan: boolean;
  amCount: number;
  pmCount: number;
}): Promise<void> {
  const { title, text } = buildRoutinePlanMessage(opts);

  const threadId = await ensureDoctorPatientChatThread(opts.patientId, opts.staffId);
  await db.insert(chatMessages).values({
    threadId,
    sender: "doctor",
    text,
  });
  await notifyChatThreadUpdated(threadId);

  void publishNotification("doctor.reply", opts.patientId, {
    messagePreview: text,
    title: `SkinnFit — ${title.toLowerCase()}`,
    body: text,
    doctorId: opts.staffId,
  });

  void notifyPatientRoutinePlanUpdated(opts.patientId, opts.effectiveFromYmd, {
    title: `SkinnFit — ${title.toLowerCase()}`,
    body: text,
    doctorId: opts.staffId,
  });
}

export async function patientHadRoutinePlan(patientId: string): Promise<boolean> {
  const [row] = await db
    .select({
      am: users.routinePlanAmItems,
      pm: users.routinePlanPmItems,
    })
    .from(users)
    .where(eq(users.id, patientId))
    .limit(1);
  const am = coerceRoutinePlanList(row?.am);
  const pm = coerceRoutinePlanList(row?.pm);
  return am.length > 0 || pm.length > 0;
}
