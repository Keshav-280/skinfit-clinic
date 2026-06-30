-- Prod: apply via `psql $DATABASE_URL -f drizzle/0048_mobile_capture_crop_context.sql`
-- or your usual Drizzle migration runner before deploying mobile-capture crop handoff.
ALTER TABLE "mobile_capture_sessions" ADD COLUMN IF NOT EXISTS "capture_crop_context" jsonb;
