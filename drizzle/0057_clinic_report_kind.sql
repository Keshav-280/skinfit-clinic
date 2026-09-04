ALTER TABLE "clinic_external_reports" ADD COLUMN IF NOT EXISTS "report_kind" varchar(32) DEFAULT 'medixora' NOT NULL;
ALTER TABLE "clinic_external_reports" ADD COLUMN IF NOT EXISTS "mime_type" varchar(120);
