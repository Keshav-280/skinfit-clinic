CREATE TABLE IF NOT EXISTS "profile_insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scan_count" integer NOT NULL DEFAULT 0,
  "payload_json" jsonb,
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "profile_insights_user_uidx"
  ON "profile_insights" ("user_id");
