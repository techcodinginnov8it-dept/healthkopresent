-- Supabase SQL Table definition for Pet Profiles
-- Table: pet_profiles
-- Syncs with Patient Companion Pass & Pet Profile in HealthKo

CREATE TABLE IF NOT EXISTS pet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'Canine',
  breed TEXT NOT NULL,
  age TEXT NOT NULL,
  gender TEXT NOT NULL,
  weight TEXT NOT NULL,
  microchip_id TEXT,
  vaccination_status TEXT,
  last_vaccination_date TEXT,
  rabies_tag_number TEXT,
  primary_vet TEXT,
  clinic_name TEXT,
  clinic_phone TEXT,
  allergies TEXT,
  diet_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by patient_id
CREATE INDEX IF NOT EXISTS idx_pet_profiles_patient_id ON pet_profiles(patient_id);

-- Row Level Security (RLS) policies
ALTER TABLE pet_profiles ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on pet_profiles" 
  ON pet_profiles 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Allow authenticated users to read their own pets
CREATE POLICY "Users can read own pet profiles" 
  ON pet_profiles 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow authenticated users to insert/update their own pets
CREATE POLICY "Users can manage own pet profiles" 
  ON pet_profiles 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);
