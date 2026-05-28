-- Reset all doctor-portal / doctor–patient isolation data (local dev).
-- Does NOT delete patients or their scans. Run against Docker Postgres only.

BEGIN;

-- Chat (doctor threads + E2EE)
DELETE FROM doctor_sos_acknowledgements
WHERE staff_user_id IN (SELECT id FROM users WHERE role IN ('doctor', 'admin'));

DELETE FROM chat_thread_e2ee_envelopes
WHERE thread_id IN (SELECT id FROM chat_threads WHERE assistant_id = 'doctor');

DELETE FROM chat_messages
WHERE thread_id IN (SELECT id FROM chat_threads WHERE assistant_id = 'doctor');

DELETE FROM chat_threads WHERE assistant_id = 'doctor';

DELETE FROM chat_user_e2ee_keys
WHERE user_id IN (SELECT id FROM users WHERE role IN ('doctor', 'admin'));

-- Doctor feedback & care
DELETE FROM doctor_feedback_voice_notes;
DELETE FROM doctor_patient_care;
DELETE FROM visit_notes;

-- Per-doctor scoping columns (keep patient rows)
UPDATE scans SET doctor_id = NULL;
UPDATE skin_dna_cards SET doctor_id = NULL;
UPDATE weekly_reports SET doctor_id = NULL;
UPDATE monthly_reports SET doctor_id = NULL;

UPDATE users
SET
  assigned_doctor_id = NULL,
  doctor_feedback_note = NULL,
  doctor_feedback_updated_at = NULL,
  doctor_feedback_viewed_at = NULL,
  doctor_feedback_scan_voice_viewed_at = NULL,
  clinic_visited_at = NULL
WHERE role = 'patient';

-- Profile images (also cascade on user delete; explicit for clarity)
DELETE FROM doctor_profile_images
WHERE owner_user_id IN (SELECT id FROM users WHERE role IN ('doctor', 'admin'));

-- Scheduling rows tied to doctors (portal isolation test — fresh calendar)
DELETE FROM appointments;
DELETE FROM appointment_requests;
DELETE FROM doctor_slots;

-- Doctor accounts (re-signup at /doctor/signup)
DELETE FROM users WHERE role IN ('doctor', 'admin');

COMMIT;
