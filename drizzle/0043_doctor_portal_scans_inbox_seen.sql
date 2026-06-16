ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "doctor_portal_scans_inbox_seen_at" timestamp with time zone;
