-- kAI onboarding, 12-parameter scores, tracker reports, SOS chat, resources

CREATE TYPE "parameter_source" AS ENUM ('ai', 'doctor', 'pending');

CREATE TYPE "visit_response_rating" AS ENUM ('excellent', 'good', 'moderate', 'poor');

CREATE TYPE "resource_kind" AS ENUM ('article', 'video', 'insight');

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_complete" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "primary_concern" varchar(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "concern_severity" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "concern_duration" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "triggers" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "prior_treatment" varchar(8);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "treatment_history_text" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "treatment_history_duration" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "skin_sensitivity" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "baseline_sleep" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "baseline_hydration" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "baseline_diet_type" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "baseline_sun_exposure" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fitzpatrick" varchar(8);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak_current" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak_longest" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak_last_date" date;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cycle_tracking_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "doctor_feedback_viewed_at" timestamp with time zone;

ALTER TABLE "daily_logs" ADD COLUMN IF NOT EXISTS "diet_type" varchar(32);
ALTER TABLE "daily_logs" ADD COLUMN IF NOT EXISTS "sun_exposure" varchar(32);
ALTER TABLE "daily_logs" ADD COLUMN IF NOT EXISTS "cycle_day" integer;
ALTER TABLE "daily_logs" ADD COLUMN IF NOT EXISTS "comments" text;

ALTER TABLE "visit_notes" ADD COLUMN IF NOT EXISTS "purpose" text;
ALTER TABLE "visit_notes" ADD COLUMN IF NOT EXISTS "treatments" text;
ALTER TABLE "visit_notes" ADD COLUMN IF NOT EXISTS "pre_advice" text;
ALTER TABLE "visit_notes" ADD COLUMN IF NOT EXISTS "post_advice" text;
ALTER TABLE "visit_notes" ADD COLUMN IF NOT EXISTS "prescription" text;
ALTER TABLE "visit_notes" ADD COLUMN IF NOT EXISTS "response_rating" "visit_response_rating";
ALTER TABLE "visit_notes" ADD COLUMN IF NOT EXISTS "before_image_ids" jsonb;
ALTER TABLE "visit_notes" ADD COLUMN IF NOT EXISTS "after_image_ids" jsonb;

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "is_urgent" boolean DEFAULT false NOT NULL;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_url" text;

CREATE TABLE IF NOT EXISTS "questionnaire_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "question_id" varchar(64) NOT NULL,
  "answer" jsonb NOT NULL,
  "questionnaire_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "questionnaire_answers_user_id_idx" ON "questionnaire_answers" ("user_id");

CREATE TABLE IF NOT EXISTS "skin_dna_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "skin_type" varchar(64),
  "primary_concern" text,
  "sensitivity_index" integer,
  "uv_sensitivity" varchar(32),
  "hormonal_correlation" varchar(32),
  "revision" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "skin_dna_cards_user_id_uidx" ON "skin_dna_cards" ("user_id");

CREATE TABLE IF NOT EXISTS "parameter_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scan_id" integer NOT NULL REFERENCES "scans"("id") ON DELETE CASCADE,
  "param_key" varchar(64) NOT NULL,
  "value" integer,
  "source" "parameter_source" NOT NULL DEFAULT 'pending',
  "severity_flag" boolean DEFAULT false NOT NULL,
  "delta_vs_prev" integer,
  "extras" jsonb,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "parameter_scores_scan_param_uidx"
  ON "parameter_scores" ("scan_id", "param_key");

CREATE TABLE IF NOT EXISTS "weekly_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "week_start" date NOT NULL,
  "kai_score" integer,
  "weekly_delta" integer,
  "consistency_score" integer,
  "causes_json" jsonb,
  "focus_actions_json" jsonb,
  "resources_json" jsonb,
  "narrative_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "weekly_reports_user_week_idx" ON "weekly_reports" ("user_id", "week_start");

CREATE TABLE IF NOT EXISTS "daily_focus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "focus_date" date NOT NULL,
  "message" text NOT NULL,
  "source_param" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_focus_user_date_uidx" ON "daily_focus" ("user_id", "focus_date");

CREATE TABLE IF NOT EXISTS "doctor_feedback_voice_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "doctor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "scan_id" integer REFERENCES "scans"("id") ON DELETE SET NULL,
  "audio_data_uri" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "doctor_feedback_voice_notes_user_idx" ON "doctor_feedback_voice_notes" ("user_id");

CREATE TABLE IF NOT EXISTS "monthly_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "month_start" date NOT NULL,
  "payload_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "monthly_reports_user_month_idx" ON "monthly_reports" ("user_id", "month_start");

CREATE TABLE IF NOT EXISTS "kai_resources" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "kind" "resource_kind" NOT NULL,
  "param_keys" jsonb,
  "tags" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
