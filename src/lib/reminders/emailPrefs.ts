import { sql } from "drizzle-orm";
import { db } from "@/src/db";
import { ensureReminderSchema } from "@/src/lib/reminders/schema";

/** true = said yes, false = said no, null = not asked yet. */
export async function getEmailReminderChoice(userId: string): Promise<boolean | null> {
  await ensureReminderSchema();
  const res = await db.execute(
    sql`SELECT opted_in FROM email_reminder_prefs WHERE user_id = ${userId}`
  );
  const row = res.rows[0];
  return row ? row.opted_in === true : null;
}

export async function setEmailReminderChoice(userId: string, optedIn: boolean): Promise<void> {
  await ensureReminderSchema();
  await db.execute(
    sql`INSERT INTO email_reminder_prefs (user_id, opted_in) VALUES (${userId}, ${optedIn})
        ON CONFLICT (user_id) DO UPDATE SET opted_in = EXCLUDED.opted_in, updated_at = now()`
  );
}

/** Only these patients may receive weekly reminders. */
export async function listOptedInUserIds(): Promise<string[]> {
  await ensureReminderSchema();
  const res = await db.execute(
    sql`SELECT user_id FROM email_reminder_prefs WHERE opted_in = true`
  );
  return res.rows.map((r) => String(r.user_id));
}
