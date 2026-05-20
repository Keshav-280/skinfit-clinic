CREATE TABLE IF NOT EXISTS "chat_user_e2ee_keys" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "public_key_jwk" text NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "chat_thread_e2ee_envelopes" (
  "thread_id" uuid NOT NULL REFERENCES "chat_threads"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "wrapped_key_b64" text NOT NULL,
  PRIMARY KEY ("thread_id", "user_id")
);
