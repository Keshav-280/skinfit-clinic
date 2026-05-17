CREATE TYPE "public"."parameter_source" AS ENUM('ai', 'doctor', 'pending');--> statement-breakpoint
CREATE TYPE "public"."patient_schedule_request_status" AS ENUM('pending', 'confirmed', 'cancelled', 'declined');--> statement-breakpoint
CREATE TYPE "public"."resource_kind" AS ENUM('article', 'video', 'insight');--> statement-breakpoint
CREATE TYPE "public"."visit_response_rating" AS ENUM('excellent', 'good', 'moderate', 'poor');--> statement-breakpoint
CREATE TABLE "annotator_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"data_uri" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annotator_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" varchar(64) DEFAULT 'default' NOT NULL,
	"per_image_by_category" jsonb,
	"annotations" jsonb,
	"current_index" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_focus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"focus_date" date NOT NULL,
	"message" text NOT NULL,
	"source_param" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_feedback_voice_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"doctor_id" uuid,
	"scan_id" integer,
	"audio_data_uri" text,
	"feedback_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"patient_listened_at" timestamp with time zone,
	"patient_archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "doctor_sos_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"chat_message_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kai_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"kind" "resource_kind" NOT NULL,
	"param_keys" jsonb,
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month_start" date NOT NULL,
	"payload_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parameter_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" integer NOT NULL,
	"param_key" varchar(64) NOT NULL,
	"value" integer,
	"source" "parameter_source" DEFAULT 'pending' NOT NULL,
	"severity_flag" boolean DEFAULT false NOT NULL,
	"delta_vs_prev" integer,
	"extras" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_schedule_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"preferred_date" date NOT NULL,
	"issue" text DEFAULT 'Skin concern' NOT NULL,
	"days_affected" integer,
	"time_preferences" text NOT NULL,
	"attachments" jsonb,
	"status" "patient_schedule_request_status" DEFAULT 'pending' NOT NULL,
	"external_ref" text,
	"confirmed_at" timestamp with time zone,
	"crm_patient_message" text,
	"cancelled_reason" text,
	"patient_notes" text,
	"appointment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questionnaire_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" varchar(64) NOT NULL,
	"answer" jsonb NOT NULL,
	"questionnaire_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skin_dna_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skin_type" varchar(64),
	"primary_concern" text,
	"sensitivity_index" integer,
	"uv_sensitivity" varchar(32),
	"hormonal_correlation" varchar(32),
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "daily_logs" ALTER COLUMN "sleep_hours" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "slot_end_time" varchar(5);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "patient_clinic_note" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "patient_clinic_note_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "clinic_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "is_urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "attachment_url" text;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "patient_cleared_chat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "doctor_portal_last_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "diet_type" varchar(32);--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "sun_exposure" varchar(32);--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "cycle_day" integer;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "comments" text;--> statement-breakpoint
ALTER TABLE "doctor_slots" ADD COLUMN "slot_end_time" varchar(5);--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "face_capture_images" jsonb;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD COLUMN "event_kind" varchar(32) DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" varchar(24);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "appointment_reminder_hours_before" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "expo_push_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "routine_reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "routine_am_reminder_hm" varchar(5) DEFAULT '08:30' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "routine_pm_reminder_hm" varchar(5) DEFAULT '22:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "routine_am_reminder_last_sent_ymd" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "routine_pm_reminder_last_sent_ymd" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_complete" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "routine_plan_am_items" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "routine_plan_pm_items" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "routine_plan_clinician_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "primary_concern" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "concern_severity" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "concern_duration" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "triggers" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "prior_treatment" varchar(8);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "treatment_history_text" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "treatment_history_duration" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "skin_sensitivity" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "baseline_sleep" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "baseline_hydration" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "baseline_diet_type" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "baseline_sun_exposure" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fitzpatrick" varchar(8);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak_current" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak_longest" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak_last_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cycle_tracking_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "doctor_feedback_viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "doctor_feedback_note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "doctor_feedback_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "doctor_feedback_scan_voice_viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "schedule_crm_digest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_photo_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clinic_visited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "treatments" text;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "pre_advice" text;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "post_advice" text;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "prescription" text;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "response_rating" "visit_response_rating";--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "before_image_ids" jsonb;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "after_image_ids" jsonb;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "daily_focus" ADD CONSTRAINT "daily_focus_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_feedback_voice_notes" ADD CONSTRAINT "doctor_feedback_voice_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_feedback_voice_notes" ADD CONSTRAINT "doctor_feedback_voice_notes_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_feedback_voice_notes" ADD CONSTRAINT "doctor_feedback_voice_notes_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_sos_acknowledgements" ADD CONSTRAINT "doctor_sos_acknowledgements_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_sos_acknowledgements" ADD CONSTRAINT "doctor_sos_acknowledgements_chat_message_id_chat_messages_id_fk" FOREIGN KEY ("chat_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_scores" ADD CONSTRAINT "parameter_scores_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_schedule_requests" ADD CONSTRAINT "patient_schedule_requests_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_schedule_requests" ADD CONSTRAINT "patient_schedule_requests_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_schedule_requests" ADD CONSTRAINT "patient_schedule_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_answers" ADD CONSTRAINT "questionnaire_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_dna_cards" ADD CONSTRAINT "skin_dna_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "annotator_images_sort_order_uidx" ON "annotator_images" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "annotator_state_scope_uidx" ON "annotator_state" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_focus_user_date_uidx" ON "daily_focus" USING btree ("user_id","focus_date");--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_sos_ack_staff_message_uidx" ON "doctor_sos_acknowledgements" USING btree ("staff_user_id","chat_message_id");--> statement-breakpoint
CREATE INDEX "doctor_sos_ack_staff_idx" ON "doctor_sos_acknowledgements" USING btree ("staff_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parameter_scores_scan_param_uidx" ON "parameter_scores" USING btree ("scan_id","param_key");--> statement-breakpoint
CREATE INDEX "patient_schedule_requests_patient_idx" ON "patient_schedule_requests" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patient_schedule_requests_status_idx" ON "patient_schedule_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "patient_schedule_requests_external_ref_idx" ON "patient_schedule_requests" USING btree ("external_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "skin_dna_cards_user_id_uidx" ON "skin_dna_cards" USING btree ("user_id");