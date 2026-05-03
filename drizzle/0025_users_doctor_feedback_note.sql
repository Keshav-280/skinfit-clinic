ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "doctor_feedback_note" text;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "doctor_feedback_updated_at" timestamp with time zone;
