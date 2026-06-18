ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "face_reference_embedding" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "face_reference_image_path" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "face_reference_set_at" timestamp with time zone;
