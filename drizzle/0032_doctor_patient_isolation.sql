-- Doctor–patient care relationships and per-doctor data isolation.

CREATE TABLE IF NOT EXISTS doctor_patient_care (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_feedback_note text,
  doctor_feedback_updated_at timestamptz,
  doctor_feedback_viewed_at timestamptz,
  clinic_visited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doctor_patient_care_doctor_patient_uidx UNIQUE (doctor_id, patient_id)
);

CREATE INDEX IF NOT EXISTS doctor_patient_care_doctor_idx ON doctor_patient_care(doctor_id);
CREATE INDEX IF NOT EXISTS doctor_patient_care_patient_idx ON doctor_patient_care(patient_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_doctor_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_patient_doctor_uidx
  ON chat_threads (user_id, doctor_id)
  WHERE assistant_id = 'doctor' AND doctor_id IS NOT NULL;

ALTER TABLE scans ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS scans_doctor_patient_idx ON scans (doctor_id, user_id);

ALTER TABLE visit_notes ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS visit_notes_doctor_patient_idx ON visit_notes (doctor_id, user_id);

ALTER TABLE skin_dna_cards ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE monthly_reports ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Backfill care links from latest appointment per patient (fallback: clinic doctor email).
INSERT INTO doctor_patient_care (doctor_id, patient_id, doctor_feedback_note, doctor_feedback_updated_at, doctor_feedback_viewed_at, clinic_visited_at)
SELECT DISTINCT ON (p.id)
  COALESCE(latest_appt.doctor_id, clinic_doc.id) AS doctor_id,
  p.id AS patient_id,
  p.doctor_feedback_note,
  p.doctor_feedback_updated_at,
  p.doctor_feedback_viewed_at,
  p.clinic_visited_at
FROM users p
LEFT JOIN LATERAL (
  SELECT a.doctor_id
  FROM appointments a
  WHERE a.user_id = p.id AND a.doctor_id IS NOT NULL
  ORDER BY a.date_time DESC NULLS LAST
  LIMIT 1
) latest_appt ON true
LEFT JOIN LATERAL (
  SELECT u.id
  FROM users u
  WHERE u.email = 'ajaydey1946@gmail.com' AND u.role IN ('doctor', 'admin')
  LIMIT 1
) clinic_doc ON true
WHERE p.role = 'patient'
  AND COALESCE(latest_appt.doctor_id, clinic_doc.id) IS NOT NULL
ON CONFLICT (doctor_id, patient_id) DO NOTHING;

UPDATE users u
SET assigned_doctor_id = c.doctor_id
FROM doctor_patient_care c
WHERE u.id = c.patient_id
  AND u.role = 'patient'
  AND u.assigned_doctor_id IS NULL;

UPDATE chat_threads t
SET doctor_id = c.doctor_id
FROM doctor_patient_care c
WHERE t.user_id = c.patient_id
  AND t.assistant_id = 'doctor'
  AND t.doctor_id IS NULL;

UPDATE scans s
SET doctor_id = u.assigned_doctor_id
FROM users u
WHERE s.user_id = u.id AND s.doctor_id IS NULL AND u.assigned_doctor_id IS NOT NULL;

UPDATE visit_notes v
SET doctor_id = u.assigned_doctor_id
FROM users u
WHERE v.user_id = u.id AND v.doctor_id IS NULL AND u.assigned_doctor_id IS NOT NULL;

UPDATE skin_dna_cards d
SET doctor_id = u.assigned_doctor_id
FROM users u
WHERE d.user_id = u.id AND d.doctor_id IS NULL AND u.assigned_doctor_id IS NOT NULL;

UPDATE weekly_reports w
SET doctor_id = u.assigned_doctor_id
FROM users u
WHERE w.user_id = u.id AND w.doctor_id IS NULL AND u.assigned_doctor_id IS NOT NULL;

UPDATE monthly_reports m
SET doctor_id = u.assigned_doctor_id
FROM users u
WHERE m.user_id = u.id AND m.doctor_id IS NULL AND u.assigned_doctor_id IS NOT NULL;

UPDATE doctor_feedback_voice_notes v
SET doctor_id = u.assigned_doctor_id
FROM users u
WHERE v.user_id = u.id AND v.doctor_id IS NULL AND u.assigned_doctor_id IS NOT NULL;

DROP INDEX IF EXISTS skin_dna_cards_user_id_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS skin_dna_cards_user_doctor_uidx
  ON skin_dna_cards (user_id, doctor_id)
  WHERE doctor_id IS NOT NULL;
