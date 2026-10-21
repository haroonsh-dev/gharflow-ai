CREATE TABLE IF NOT EXISTS household_submeter_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  reference_number text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT 'Shared Meter Setup',
  portions jsonb NOT NULL DEFAULT '[]'::jsonb,
  common_load_handling text NOT NULL DEFAULT 'equal_split' CHECK (common_load_handling IN ('equal_split', 'proportional', 'landlord_absorb')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_household_submeter_ref UNIQUE (household_id, reference_number)
);

CREATE INDEX IF NOT EXISTS household_submeter_configurations_idx ON household_submeter_configurations(household_id, reference_number);
