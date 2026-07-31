CREATE TABLE IF NOT EXISTS "wellness_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nutrition_level" text,
	"exercise_hours" text,
	"sleep_hours" text,
	"supplements" text,
	"stress_level" integer,
	"city" text,
	"skincare_routine" jsonb,
	"active_ingredients" text,
	"week_ymd" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wellness_checkins" ADD CONSTRAINT "wellness_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wellness_checkins_user_week_uidx" ON "wellness_checkins" USING btree ("user_id","week_ymd");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wellness_checkins_user_created_idx" ON "wellness_checkins" USING btree ("user_id","created_at");
