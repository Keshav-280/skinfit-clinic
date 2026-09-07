ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamptz;

CREATE TABLE IF NOT EXISTS "login_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "method" varchar(32) NOT NULL DEFAULT 'password',
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "login_events_user_created_idx" ON "login_events" ("user_id", "created_at");
