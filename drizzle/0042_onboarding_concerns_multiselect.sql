-- Onboarding: allow multiple skin concerns (MCQ multi-select)
ALTER TABLE users ADD COLUMN IF NOT EXISTS concerns jsonb;

UPDATE users
SET concerns = jsonb_build_array(primary_concern)
WHERE primary_concern IS NOT NULL
  AND concerns IS NULL;
