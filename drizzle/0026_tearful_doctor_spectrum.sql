CREATE TYPE "public"."family_wallet_member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."family_wallet_tx_type" AS ENUM('topup', 'deduction', 'refund');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'apple', 'facebook', 'github', 'microsoft');--> statement-breakpoint
CREATE TYPE "public"."scan_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "chat_thread_e2ee_envelopes" (
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"wrapped_key_b64" text NOT NULL,
	CONSTRAINT "chat_thread_e2ee_envelopes_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_user_e2ee_keys" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"public_key_jwk" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_patient_care" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_feedback_note" text,
	"doctor_feedback_updated_at" timestamp with time zone,
	"doctor_feedback_viewed_at" timestamp with time zone,
	"clinic_visited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_wallet_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "family_wallet_member_role" DEFAULT 'member' NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"type" "family_wallet_tx_type" NOT NULL,
	"amount_credits" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"patient_user_id" uuid,
	"performed_by_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"display_name" varchar(120) DEFAULT 'Family card' NOT NULL,
	"balance_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hydration_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"insight_date" date NOT NULL,
	"insight" text NOT NULL,
	"tip" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_capture_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scan_id" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_capture_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"provider_email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"payload_json" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_plan_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"am_items" jsonb NOT NULL,
	"pm_items" jsonb NOT NULL,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "scan_job_status" DEFAULT 'pending' NOT NULL,
	"payload_json" jsonb NOT NULL,
	"result_scan_id" integer,
	"error_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "skin_dna_cards_user_id_uidx";--> statement-breakpoint
ALTER TABLE "annotator_images" ALTER COLUMN "data_uri" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "annotator_images" ADD COLUMN "file_url" text;--> statement-breakpoint
ALTER TABLE "annotator_state" ADD COLUMN "per_user_labels" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "annotator_state" ADD COLUMN "per_user_shapes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "annotator_state" ADD COLUMN "image_locks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "annotator_state" ADD COLUMN "user_sync_at" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "annotator_state" ADD COLUMN "shape_tombstones" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "sleep_quality" varchar(32);--> statement-breakpoint
ALTER TABLE "doctor_feedback_voice_notes" ADD COLUMN "audio_url" text;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD COLUMN "doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "tracker_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "skin_dna_cards" ADD COLUMN "doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "face_reference_embedding" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "face_reference_image_path" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "face_reference_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "concerns" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "doctor_portal_scans_inbox_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assigned_doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_thread_e2ee_envelopes" ADD CONSTRAINT "chat_thread_e2ee_envelopes_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread_e2ee_envelopes" ADD CONSTRAINT "chat_thread_e2ee_envelopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_user_e2ee_keys" ADD CONSTRAINT "chat_user_e2ee_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_patient_care" ADD CONSTRAINT "doctor_patient_care_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_patient_care" ADD CONSTRAINT "doctor_patient_care_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_wallet_members" ADD CONSTRAINT "family_wallet_members_wallet_id_family_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."family_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_wallet_members" ADD CONSTRAINT "family_wallet_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_wallet_transactions" ADD CONSTRAINT "family_wallet_transactions_wallet_id_family_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."family_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_wallet_transactions" ADD CONSTRAINT "family_wallet_transactions_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_wallet_transactions" ADD CONSTRAINT "family_wallet_transactions_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_wallets" ADD CONSTRAINT "family_wallets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hydration_insights" ADD CONSTRAINT "hydration_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_capture_sessions" ADD CONSTRAINT "mobile_capture_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_capture_sessions" ADD CONSTRAINT "mobile_capture_sessions_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_insights" ADD CONSTRAINT "profile_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_plan_revisions" ADD CONSTRAINT "routine_plan_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_plan_revisions" ADD CONSTRAINT "routine_plan_revisions_created_by_staff_id_users_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_result_scan_id_scans_id_fk" FOREIGN KEY ("result_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_patient_care_doctor_patient_uidx" ON "doctor_patient_care" USING btree ("doctor_id","patient_id");--> statement-breakpoint
CREATE INDEX "doctor_patient_care_doctor_idx" ON "doctor_patient_care" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "doctor_patient_care_patient_idx" ON "doctor_patient_care" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "family_wallet_members_wallet_user_uidx" ON "family_wallet_members" USING btree ("wallet_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "family_wallet_members_user_uidx" ON "family_wallet_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "family_wallet_tx_wallet_created_idx" ON "family_wallet_transactions" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "family_wallets_owner_uidx" ON "family_wallets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hydration_insights_user_date_uidx" ON "hydration_insights" USING btree ("user_id","insight_date");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_account_uidx" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_insights_user_uidx" ON "profile_insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "routine_plan_revisions_user_effective_idx" ON "routine_plan_revisions" USING btree ("user_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "routine_plan_revisions_user_effective_uidx" ON "routine_plan_revisions" USING btree ("user_id","effective_from");--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_dna_cards" ADD CONSTRAINT "skin_dna_cards_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_doctor_id_users_id_fk" FOREIGN KEY ("assigned_doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD CONSTRAINT "visit_notes_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skin_dna_cards_user_doctor_uidx" ON "skin_dna_cards" USING btree ("user_id","doctor_id");