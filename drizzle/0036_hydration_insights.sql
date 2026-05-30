CREATE TABLE IF NOT EXISTS "hydration_insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "insight_date" date NOT NULL,
  "insight" text NOT NULL,
  "tip" text NOT NULL,
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "hydration_insights_user_date_uidx"
  ON "hydration_insights" ("user_id", "insight_date");
