CREATE TABLE IF NOT EXISTS "routine_plan_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "effective_from" date NOT NULL,
  "am_items" jsonb NOT NULL,
  "pm_items" jsonb NOT NULL,
  "created_by_staff_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "routine_plan_revisions_user_effective_idx"
  ON "routine_plan_revisions" ("user_id", "effective_from" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "routine_plan_revisions_user_effective_uidx"
  ON "routine_plan_revisions" ("user_id", "effective_from");

-- Baseline revision for patients who already have a clinician plan.
INSERT INTO "routine_plan_revisions" ("user_id", "effective_from", "am_items", "pm_items")
SELECT
  u."id",
  COALESCE(u."created_at"::date, DATE '1970-01-01'),
  COALESCE(u."routine_plan_am_items", '[]'::jsonb),
  COALESCE(u."routine_plan_pm_items", '[]'::jsonb)
FROM "users" u
WHERE u."role" = 'patient'
  AND jsonb_array_length(COALESCE(u."routine_plan_am_items", '[]'::jsonb)) > 0
  AND jsonb_array_length(COALESCE(u."routine_plan_pm_items", '[]'::jsonb)) > 0
ON CONFLICT ("user_id", "effective_from") DO NOTHING;
