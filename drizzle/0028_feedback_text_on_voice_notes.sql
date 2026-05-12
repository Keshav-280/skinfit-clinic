ALTER TABLE "doctor_feedback_voice_notes" ADD COLUMN "feedback_text" text;
ALTER TABLE "doctor_feedback_voice_notes" ALTER COLUMN "audio_data_uri" DROP NOT NULL;
