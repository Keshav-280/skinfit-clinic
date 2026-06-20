-- Wipe all patients, doctors, and app data on local Docker Postgres.
-- Keeps kai_resources (global CMS seed). Does not touch schema/migrations.

BEGIN;

DELETE FROM doctor_sos_acknowledgements;
DELETE FROM chat_thread_e2ee_envelopes;
DELETE FROM chat_messages;
DELETE FROM doctor_feedback_voice_notes;
DELETE FROM parameter_scores;
DELETE FROM scan_jobs;
DELETE FROM doctor_patient_care;

DELETE FROM chat_threads;
DELETE FROM chat_user_e2ee_keys;

DELETE FROM appointment_requests;
DELETE FROM appointments;
DELETE FROM patient_schedule_requests;
DELETE FROM doctor_slots;

DELETE FROM visit_notes;
DELETE FROM priority_reminders;
DELETE FROM schedule_events;
DELETE FROM daily_logs;
DELETE FROM questionnaire_answers;
DELETE FROM skin_dna_cards;
DELETE FROM weekly_reports;
DELETE FROM monthly_reports;
DELETE FROM daily_focus;

DELETE FROM skin_scans;
DELETE FROM scans;

DELETE FROM doctor_profile_images;
DELETE FROM annotator_images;
DELETE FROM annotator_state;

DELETE FROM users;

COMMIT;
