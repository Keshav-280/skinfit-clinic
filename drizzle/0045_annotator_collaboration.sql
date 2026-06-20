-- Multi-user annotator: per-user labels/shapes + image edit locks.
ALTER TABLE "annotator_state"
  ADD COLUMN IF NOT EXISTS "per_user_labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "per_user_shapes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "image_locks" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "user_sync_at" jsonb DEFAULT '{}'::jsonb NOT NULL;

COMMENT ON COLUMN "annotator_state"."per_user_labels" IS 'Map userId -> sparse imageIndex -> category labels';
COMMENT ON COLUMN "annotator_state"."per_user_shapes" IS 'Map userId -> annotation shapes array';
COMMENT ON COLUMN "annotator_state"."image_locks" IS 'Map imageIndex -> { userId, userName, expiresAt }';
COMMENT ON COLUMN "annotator_state"."user_sync_at" IS 'Map userId -> ISO timestamp of last label/shape save';
