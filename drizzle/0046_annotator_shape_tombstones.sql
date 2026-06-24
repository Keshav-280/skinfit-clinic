ALTER TABLE "annotator_state" ADD COLUMN IF NOT EXISTS "shape_tombstones" jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN "annotator_state"."shape_tombstones" IS 'userId -> shape ids removed remotely (e.g. admin delete); blocks stale-tab restore';
