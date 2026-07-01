CREATE TABLE IF NOT EXISTS "pre_release_signups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "source" varchar(64) DEFAULT 'pre-release' NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pre_release_signups_email_unique" ON "pre_release_signups" ("email");
