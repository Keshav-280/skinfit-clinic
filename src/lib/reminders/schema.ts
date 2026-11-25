import { sql } from "drizzle-orm";
import { db } from "@/src/db";

/**
 * Reminder tables are created on first use (idempotent DDL) so no manual migration is needed
 * on deploy. The consent is deliberately a separate table, not a column on `users`: a new
 * `users` column would break every existing query until a migration is run by hand.
 * `notification_logs` mirrors drizzle/0054 for servers where that file was never applied.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS email_reminder_prefs (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    opted_in boolean NOT NULL,
    answered_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('push', 'whatsapp', 'email');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('weekly_reminder');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `CREATE TABLE IF NOT EXISTS notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    type notification_type NOT NULL DEFAULT 'weekly_reminder',
    week_ymd varchar(10) NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_user_channel_type_week_uidx
    ON notification_logs (user_id, channel, type, week_ymd)`,
  `CREATE INDEX IF NOT EXISTS notification_logs_user_sent_idx
    ON notification_logs (user_id, sent_at)`,
];

let ready: Promise<void> | null = null;

export function ensureReminderSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
