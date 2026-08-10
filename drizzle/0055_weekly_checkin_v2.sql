-- Weekly check-in v2: concern path payload + doctor flags
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "concern" varchar(32);
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "water" text;
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "stress_anchor" text;
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "nutrition_multi" jsonb;
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "supplements_list" jsonb;
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "concern_specific" jsonb;
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "flags" jsonb;
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "payload" jsonb;
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "scan_id" integer;
ALTER TABLE "wellness_checkins" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;

DO $$ BEGIN
 ALTER TABLE "wellness_checkins" ADD CONSTRAINT "wellness_checkins_scan_id_scans_id_fk"
   FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
