ALTER TABLE users ADD COLUMN recovery_hash text;
ALTER TABLE households ADD COLUMN deleting boolean NOT NULL DEFAULT false;
ALTER TABLE evidence_files ADD COLUMN preview_bytes integer NOT NULL DEFAULT 0 CHECK (preview_bytes >= 0);
ALTER TABLE evidence_files ADD COLUMN ocr_state text NOT NULL DEFAULT 'pending' CHECK (ocr_state IN ('pending','processing','extracted','failed'));
ALTER TABLE evidence_files ADD COLUMN processing_started_at timestamptz;
ALTER TABLE evidence_files ADD COLUMN deleting boolean NOT NULL DEFAULT false;
UPDATE evidence_files SET ocr_state='extracted' WHERE ocr_result IS NOT NULL;
ALTER TABLE cases ADD COLUMN checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days', consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_email_idx ON invitations(email);
CREATE TABLE rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE deletion_tombstones (user_id uuid PRIMARY KEY, household_id uuid NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now());
