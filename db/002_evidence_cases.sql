ALTER TABLE households ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE evidence_files ADD COLUMN ocr_result jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bills ADD COLUMN meter_identity text;
ALTER TABLE bills ADD COLUMN reading_date date;
ALTER TABLE bills ADD COLUMN reading_status text NOT NULL DEFAULT 'unknown' CHECK (reading_status IN ('actual','estimated','unknown'));
ALTER TABLE bills ADD COLUMN meter_type text NOT NULL DEFAULT 'unknown' CHECK (meter_type IN ('conventional','unsupported','unknown'));
ALTER TABLE bills ADD COLUMN superseded_by_id uuid REFERENCES bills(id) ON DELETE SET NULL;
ALTER TABLE bills ADD COLUMN corrections jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bills ADD COLUMN confirmed_at timestamptz;
ALTER TABLE meter_readings ADD COLUMN reference_number text;
ALTER TABLE meter_readings ADD COLUMN meter_identity text;
ALTER TABLE meter_readings ADD COLUMN multiplier numeric(10,3) NOT NULL DEFAULT 1;
CREATE TABLE cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  finding_id text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','awaiting_response','resolved','dismissed')),
  snapshot jsonb NOT NULL,
  evidence_ids uuid[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cases_household_idx ON cases(household_id,created_at DESC);
CREATE INDEX readings_connection_idx ON meter_readings(household_id,reference_number,reading_date);
