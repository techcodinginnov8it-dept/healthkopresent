-- HealthKo doctor audit schema update
-- Run this in the Supabase SQL editor.

BEGIN;

-- Doctors table: split name fields while keeping the existing full name column.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS suffix text;

-- Doctor audits: store split name fields and approval type.
ALTER TABLE public.doctor_audits
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS suffix text,
  ADD COLUMN IF NOT EXISTS approval_type text NOT NULL DEFAULT 'PRC_PRIMARY_SOURCE_VERIFICATION';

-- Helpful indexes for the new name fields and approval type.
CREATE INDEX IF NOT EXISTS doctors_last_name_first_name_idx
  ON public.doctors (last_name, first_name);

CREATE INDEX IF NOT EXISTS doctor_audits_approval_type_idx
  ON public.doctor_audits (approval_type);

CREATE INDEX IF NOT EXISTS doctor_audits_last_name_first_name_idx
  ON public.doctor_audits (last_name, first_name);

-- Backfill approval type for existing audits.
UPDATE public.doctor_audits
SET approval_type = COALESCE(approval_type, 'PRC_PRIMARY_SOURCE_VERIFICATION');

-- If a doctor record already has only the old full name, keep it as-is.
-- New audit submissions will populate the split fields directly.

-- Ensure the HealthKo storage bucket exists and is public so returned URLs can be opened.
INSERT INTO storage.buckets (id, name, public)
VALUES ('healthko', 'healthko', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

COMMIT;
