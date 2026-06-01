import { and, eq, sql } from "drizzle-orm";
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
import {
  inHourlyCronReminderWindow,
  inReminderMinuteWindow,
  localYmdAndHm,
  normalizeIanaTimeZone,
} from "@/src/lib/timeZoneWallClock";

export type { RoutineKind };

const WINDOW_MINUTES = 8;

function remainingLabels(
  items: readonly string[],
  steps: boolean[]
): string[] {
  return items.filter((_, i) => !steps[i]);
}

export async function runRoutineReminders(options?: {
  /** Hourly VM cron uses a full previous-hour window; client ticks use a narrow window. */
  trigger?: "cron" | "client";
}): Promise<{
  sent: number;
  errors: number;
}> {
  const trigger = options?.trigger ?? "client";
  const rows = await db
    .select({
      id: users.id,
      timezone: users.timezone,
      routineRemindersEnabled: users.routineRemindersEnabled,
      routineAmReminderHm: users.routineAmReminderHm,
      routinePmReminderHm: users.routinePmReminderHm,
      routineAmReminderLastSentYmd: users.routineAmReminderLastSentYmd,
      routinePmReminderLastSentYmd: users.routinePmReminderLastSentYmd,
    })
    .from(users)
    .where(
      and(eq(users.role, "patient"), eq(users.onboardingComplete, true))
    );

  let sent = 0;
  let errors = 0;
  const now = new Date();

  for (const row of rows) {
    if (!row.routineRemindersEnabled) continue;

    const tz = normalizeIanaTimeZone(row.timezone);
    const { ymd, hm } = localYmdAndHm(now, tz);
    const plan = await getRoutinePlanForDate(db, row.id, ymd);
    const amItems = plan.amItems;
    const pmItems = plan.pmItems;
    if (amItems.length === 0 || pmItems.length === 0) continue;

    const dayDate = dateOnlyFromYmd(ymd);

    const [log] = await db
      .select({
        routineAmSteps: dailyLogs.routineAmSteps,
        routinePmSteps: dailyLogs.routinePmSteps,
      })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, row.id), eq(dailyLogs.date, dayDate)))
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

    for (const kind of ["am", "pm"] as const) {
      const targetHm =
        kind === "am" ? row.routineAmReminderHm : row.routinePmReminderHm;
      const prevYmd =
        kind === "am"
          ? row.routineAmReminderLastSentYmd
          : row.routinePmReminderLastSentYmd;
      const left = kind === "am" ? amLeft : pmLeft;

      const reminderHm = targetHm ?? "08:30";
      const inWindow =
        trigger === "cron"
          ? inHourlyCronReminderWindow(hm, reminderHm)
          : inReminderMinuteWindow(hm, reminderHm, WINDOW_MINUTES);
      if (!inWindow) {
        continue;
      }
      if (left.length === 0) continue;

      const text = buildRoutineReminderMessage({ kind, remainingLabels: left });
      if (!text) continue;

      // Claim the calendar day in the DB before sending so concurrent cron / layout
      // / chat ticks cannot both pass "not yet sent" and deliver duplicate messages.
      const [claimed] =
        kind === "am"
          ? await db
              .update(users)
              .set({ routineAmReminderLastSentYmd: ymd })
              .where(
                and(
                  eq(users.id, row.id),
                  sql`${users.routineAmReminderLastSentYmd} IS DISTINCT FROM ${ymd}`
                )
              )
              .returning({ id: users.id })
          : await db
              .update(users)
              .set({ routinePmReminderLastSentYmd: ymd })
              .where(
                and(
                  eq(users.id, row.id),
                  sql`${users.routinePmReminderLastSentYmd} IS DISTINCT FROM ${ymd}`
                )
              )
              .returning({ id: users.id });

      if (!claimed) continue;

      try {
        await sendClinicSupportMessage({
          patientId: row.id,
          text,
          notificationType: "routine.reminder",
        });
        sent += 1;
      } catch (e) {
        console.error("runRoutineReminders send failed", row.id, kind, e);
        errors += 1;
        await db
          .update(users)
          .set(
            kind === "am"
              ? { routineAmReminderLastSentYmd: prevYmd }
              : { routinePmReminderLastSentYmd: prevYmd }
          )
          .where(eq(users.id, row.id));
      }
    }
  }

  return { sent, errors };
}
