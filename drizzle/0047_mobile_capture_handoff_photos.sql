ALTER TABLE "mobile_capture_sessions" ADD COLUMN IF NOT EXISTS "capture_images" jsonb;

COMMENT ON COLUMN "mobile_capture_sessions"."capture_images" IS 'Photos uploaded from phone for desktop handoff before scan submission';
