-- Doctors' availability is expressed in their local IANA time zone.
-- Existing accounts preserve the former behavior until the doctor updates this setting.
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'Asia/Manila';