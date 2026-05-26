-- OAuth account linking + nullable password for social-only patients.

DO $$ BEGIN
  CREATE TYPE oauth_provider AS ENUM ('google', 'apple', 'github', 'microsoft');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider oauth_provider NOT NULL,
  provider_account_id varchar(255) NOT NULL,
  provider_email varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_accounts_provider_account_uidx UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx ON oauth_accounts(user_id);

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
