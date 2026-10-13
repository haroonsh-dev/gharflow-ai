ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS meter_type text NOT NULL DEFAULT 'unknown' CHECK (meter_type IN ('conventional','unsupported','unknown'));
