DO $$ BEGIN
  CREATE TYPE "public"."clinic_external_report_status" AS ENUM('draft', 'pending_account', 'sent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "clinic_external_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "doctor_id" uuid NOT NULL,
  "patient_email" varchar(255) NOT NULL,
  "patient_name" varchar(255),
  "patient_user_id" uuid,
  "title" varchar(255) NOT NULL,
  "storage_path" text,
  "share_token" uuid DEFAULT gen_random_uuid() NOT NULL,
  "status" "clinic_external_report_status" DEFAULT 'draft' NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "clinic_external_reports_share_token_unique" UNIQUE("share_token")
);

DO $$ BEGIN
  ALTER TABLE "clinic_external_reports"
    ADD CONSTRAINT "clinic_external_reports_doctor_id_users_id_fk"
    FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "clinic_external_reports"
    ADD CONSTRAINT "clinic_external_reports_patient_user_id_users_id_fk"
    FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "clinic_external_reports_doctor_created_idx"
  ON "clinic_external_reports" ("doctor_id", "created_at");

CREATE INDEX IF NOT EXISTS "clinic_external_reports_patient_email_idx"
  ON "clinic_external_reports" ("patient_email");

CREATE INDEX IF NOT EXISTS "clinic_external_reports_patient_user_idx"
  ON "clinic_external_reports" ("patient_user_id");
