CREATE TYPE "public"."notification_channel" AS ENUM('push', 'whatsapp', 'email');
--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('weekly_reminder');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"type" "notification_type" DEFAULT 'weekly_reminder' NOT NULL,
	"week_ymd" varchar(10) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_logs_user_channel_type_week_uidx" ON "notification_logs" USING btree ("user_id","channel","type","week_ymd");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_logs_user_sent_idx" ON "notification_logs" USING btree ("user_id","sent_at");
