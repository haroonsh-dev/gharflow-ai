CREATE TABLE IF NOT EXISTS household_appliance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  reference_number text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT 'Default Profile',
  usages jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_protected boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_household_appliance_ref UNIQUE (household_id, reference_number)
);

CREATE INDEX IF NOT EXISTS household_appliance_profiles_idx ON household_appliance_profiles(household_id, reference_number);
