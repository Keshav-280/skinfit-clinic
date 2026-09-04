CREATE TABLE IF NOT EXISTS "patient_treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"title" varchar(200) NOT NULL,
	"treated_on" date NOT NULL,
	"notes" text,
	"affected_params" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_patient_id_users_id_fk"
   FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_doctor_id_users_id_fk"
   FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patient_treatments_patient_idx" ON "patient_treatments" USING btree ("patient_id","treated_on");
