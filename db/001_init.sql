CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My household',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('bill', 'receipt', 'reading')),
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_household_idx ON evidence_files(household_id);

CREATE TABLE bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  evidence_file_id uuid REFERENCES evidence_files(id) ON DELETE SET NULL,
  reference_number text NOT NULL,
  bill_month date NOT NULL,
  previous_reading numeric(12,2),
  current_reading numeric(12,2),
  multiplier numeric(10,3) NOT NULL DEFAULT 1,
  billed_units numeric(12,2),
  total_amount numeric(12,2) NOT NULL,
  due_date date,
  field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocr_status text NOT NULL DEFAULT 'manual' CHECK (ocr_status IN ('extracted', 'failed', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bills_household_month_idx ON bills(household_id, bill_month DESC);

CREATE TABLE meter_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  reading_date date NOT NULL,
  reading_value numeric(12,2) NOT NULL,
  note text NOT NULL DEFAULT '',
  evidence_file_id uuid REFERENCES evidence_files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX readings_household_date_idx ON meter_readings(household_id, reading_date DESC);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  evidence_file_id uuid REFERENCES evidence_files(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_at date NOT NULL,
  channel text NOT NULL,
  reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_household_bill_idx ON payments(household_id, bill_id);
