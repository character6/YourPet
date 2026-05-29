-- Миграция для существующей БД (npm run db:migrate)

ALTER TABLE pets ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT '#2563eb';
ALTER TABLE pets ADD COLUMN IF NOT EXISTS photo_filename VARCHAR(255);
ALTER TABLE pets ADD COLUMN IF NOT EXISTS family_referral_token UUID UNIQUE DEFAULT gen_random_uuid();

UPDATE pets SET avatar_color = '#2563eb' WHERE avatar_color IS NULL;
UPDATE pets SET family_referral_token = gen_random_uuid() WHERE family_referral_token IS NULL;

ALTER TABLE calendar_tasks ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) NOT NULL DEFAULT 'once'
  CHECK (recurrence IN ('once', 'daily', 'weekly', 'monthly'));

ALTER TABLE family_invites ALTER COLUMN invitee_email DROP NOT NULL;

CREATE TABLE IF NOT EXISTS weight_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  weight DECIMAL(6, 2) NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weight_records_pet ON weight_records(pet_id);

INSERT INTO weight_records (pet_id, weight, recorded_at, note)
SELECT id, weight, CURRENT_DATE, 'Начальный вес'
FROM pets
WHERE weight IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM weight_records wr WHERE wr.pet_id = pets.id);
