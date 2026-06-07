DO $$ BEGIN
  CREATE TYPE "family_wallet_member_role" AS ENUM('owner', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "family_wallet_tx_type" AS ENUM('topup', 'deduction', 'refund');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "family_wallets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "display_name" varchar(120) DEFAULT 'Family card' NOT NULL,
  "balance_credits" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "family_wallet_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "family_wallet_member_role" DEFAULT 'member' NOT NULL,
  "linked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "family_wallet_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_id" uuid NOT NULL,
  "type" "family_wallet_tx_type" NOT NULL,
  "amount_credits" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "patient_user_id" uuid,
  "performed_by_user_id" uuid,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "family_wallets" ADD CONSTRAINT "family_wallets_owner_user_id_users_id_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "family_wallet_members" ADD CONSTRAINT "family_wallet_members_wallet_id_family_wallets_id_fk"
    FOREIGN KEY ("wallet_id") REFERENCES "public"."family_wallets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "family_wallet_members" ADD CONSTRAINT "family_wallet_members_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "family_wallet_transactions" ADD CONSTRAINT "family_wallet_transactions_wallet_id_family_wallets_id_fk"
    FOREIGN KEY ("wallet_id") REFERENCES "public"."family_wallets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "family_wallet_transactions" ADD CONSTRAINT "family_wallet_transactions_patient_user_id_users_id_fk"
    FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "family_wallet_transactions" ADD CONSTRAINT "family_wallet_transactions_performed_by_user_id_users_id_fk"
    FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "family_wallets_owner_uidx" ON "family_wallets" USING btree ("owner_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "family_wallet_members_wallet_user_uidx" ON "family_wallet_members" USING btree ("wallet_id","user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "family_wallet_members_user_uidx" ON "family_wallet_members" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "family_wallet_tx_wallet_created_idx" ON "family_wallet_transactions" USING btree ("wallet_id","created_at");
