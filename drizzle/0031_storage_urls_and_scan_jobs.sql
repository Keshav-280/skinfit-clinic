-- URL-based file storage (no base64 in DB) + async scan job tracking

CREATE TYPE scan_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status scan_job_status NOT NULL DEFAULT 'pending',
  payload_json jsonb NOT NULL,
  result_scan_id integer REFERENCES scans(id) ON DELETE SET NULL,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_jobs_user_id_idx ON scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS scan_jobs_status_idx ON scan_jobs(status);

-- Doctor voice notes: prefer URL column (legacy audio_data_uri retained for read compat)
ALTER TABLE doctor_feedback_voice_notes
  ADD COLUMN IF NOT EXISTS audio_url text;

-- Annotator library: file path instead of inline data
ALTER TABLE annotator_images
  ADD COLUMN IF NOT EXISTS file_url text;

COMMENT ON COLUMN scans.face_capture_images IS 'Array of { label, imageUrl, previewUrl? } — paths only';
COMMENT ON COLUMN scans.scores IS 'overlayUrl, wrinkleMaskUrl, acneMaskUrl — not data URIs';
