-- Apply denial to installations that applied the pilot migration before lockdown was added.
DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['users','households','sessions','evidence_files','bills','meter_readings','payments','cases','invitations','rate_limits','deletion_tombstones','schema_migrations'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',table_name); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',table_name); END IF;
 END LOOP;
END $$;
