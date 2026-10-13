ALTER TABLE meter_readings ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE payments ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
CREATE TABLE record_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  record_kind text NOT NULL CHECK (record_kind IN ('reading','payment')),
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('updated','deleted')),
  before_record jsonb NOT NULL,
  after_record jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX record_changes_household_record_idx ON record_changes(household_id,record_kind,record_id,changed_at DESC);
ALTER TABLE record_changes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON record_changes FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON record_changes FROM authenticated; END IF;
END $$;
