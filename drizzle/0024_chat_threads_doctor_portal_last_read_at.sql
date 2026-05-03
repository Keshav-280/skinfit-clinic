ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "doctor_portal_last_read_at" timestamp with time zone;
