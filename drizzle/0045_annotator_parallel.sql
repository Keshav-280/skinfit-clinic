-- Parallel annotator: per-user image index ranges (non-overlapping).
CREATE TABLE IF NOT EXISTS "annotator_assignments" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "start_index" integer NOT NULL,
  "end_index" integer NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "annotator_assignments_range_idx"
  ON "annotator_assignments" ("start_index", "end_index");
