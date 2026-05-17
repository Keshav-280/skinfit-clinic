--CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
--CREATE TYPE "public"."appointment_type" AS ENUM('consultation', 'follow-up', 'scan-review');--> statement-breakpoint
--CREATE TYPE "public"."chat_assistant_id" AS ENUM('ai', 'doctor', 'support');--> statement-breakpoint
--CREATE TYPE "public"."chat_sender" AS ENUM('patient', 'doctor', 'support');--> statement-breakpoint
--CREATE TYPE "public"."reminder_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
--CREATE TYPE "public"."user_role" AS ENUM('patient', 'doctor', 'admin');--> statement-breakpoint
--CREATE TABLE "appointments" (
--	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
--	"user_id" uuid NOT NULL,
--	"doctor_id" uuid NOT NULL,
--	"date_time" timestamp with time zone NOT NULL,
--	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
--	"type" "appointment_type" DEFAULT 'consultation' NOT NULL,
--	"created_at" timestamp with time zone DEFAULT now() NOT NULL
--);
--> statement-breakpoint

--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_reminders" ADD CONSTRAINT "priority_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_scans" ADD CONSTRAINT "skin_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD CONSTRAINT "visit_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_threads_user_assistant_uidx" ON "chat_threads" USING btree ("user_id","assistant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_logs_user_id_date_uidx" ON "daily_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "priority_reminders_user_sort_uidx" ON "priority_reminders" USING btree ("user_id","sort_order");