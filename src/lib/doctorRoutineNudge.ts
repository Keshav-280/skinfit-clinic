import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { dailyLogs, users } from "@/src/db/schema";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { dateOnlyFromYmd } from "@/src/lib/date-only";
import { normalizeRoutineSteps } from "@/src/lib/routine";
import { getRoutinePlanForDate } from "@/src/lib/routinePlanRevisions";
import {
  buildRoutineReminderMessage,
  type RoutineKind,
} from "@/src/lib/routineReminder";
import { localYmdAndHm, normalizeIanaTimeZone } from "@/src/lib/timeZoneWallClock";

function remainingLabels(
  items: readonly string[],
  steps: boolean[]
): string[] {
  return items.filter((_, i) => !steps[i]);
}

/** Immediate AM/PM routine message in Clinic Support chat (does not touch reminder “last sent” flags). */
export async function sendDoctorRoutineNudge(
  patientId: string,
  kind: RoutineKind
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userRow = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: {
      id: true,
      onboardingComplete: true,
      timezone: true,
    },
  });
  if (!userRow) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (!userRow.onboardingComplete) {
    return { ok: false, error: "PATIENT_NOT_ONBOARDED" };
  }

  const tz = normalizeIanaTimeZone(userRow.timezone);
  const { ymd } = localYmdAndHm(new Date(), tz);
  const plan = await getRoutinePlanForDate(db, patientId, ymd);
  const amItems = plan.amItems;
  const pmItems = plan.pmItems;
  if (amItems.length === 0 || pmItems.length === 0) {
    return { ok: false, error: "ROUTINE_PLAN_NOT_SET" };
  }

  const dayDate = dateOnlyFromYmd(ymd);

  const [log] = await db
    .select({
      routineAmSteps: dailyLogs.routineAmSteps,
      routinePmSteps: dailyLogs.routinePmSteps,
    })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, patientId), eq(dailyLogs.date, dayDate)))
    .limit(1);

  const amSteps = normalizeRoutineSteps(
    log?.routineAmSteps,
    amItems.length,
    undefined
  );
  const pmSteps = normalizeRoutineSteps(
    log?.routinePmSteps,
    pmItems.length,
    undefined
  );

  const amLeft = remainingLabels(amItems, amSteps);
  const pmLeft = remainingLabels(pmItems, pmSteps);
  const left = kind === "am" ? amLeft : pmLeft;

  if (left.length === 0) {
    return { ok: false, error: "ROUTINE_ALREADY_DONE" };
  }

  const text = buildRoutineReminderMessage({ kind, remainingLabels: left });
  if (!text) {
    return { ok: false, error: "NOTHING_TO_SEND" };
  }

  await sendClinicSupportMessage({ patientId, text });
  return { ok: true };
}
