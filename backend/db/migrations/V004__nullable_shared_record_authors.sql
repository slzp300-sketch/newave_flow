-- Author removal for verified account deletion. This migration deletes no rows.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V004__nullable_shared_record_authors') THEN
    RAISE EXCEPTION 'V004 is already applied';
  END IF;
END $$;
ALTER TABLE attendances ALTER COLUMN teacher_id DROP NOT NULL;
ALTER TABLE daily_reports ALTER COLUMN teacher_id DROP NOT NULL;
ALTER TABLE student_memos ALTER COLUMN teacher_id DROP NOT NULL;
ALTER TABLE deactivation_requests ALTER COLUMN teacher_id DROP NOT NULL;
INSERT INTO schema_migrations(version) VALUES('V004__nullable_shared_record_authors');
COMMIT;
