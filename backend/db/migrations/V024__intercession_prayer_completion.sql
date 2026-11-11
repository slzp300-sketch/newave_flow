-- Preparation only. Validate on an isolated database before an authorized deployment.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V024__intercession_prayer_completion') THEN RAISE EXCEPTION 'V024 already applied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V023__intercession_schedule') THEN RAISE EXCEPTION 'V023 required'; END IF;
END $$;
ALTER TABLE intercession_requests ADD COLUMN prayer_completed boolean NOT NULL DEFAULT false;
UPDATE intercession_requests SET prayer_completed=true WHERE status='ANSWERED';
INSERT INTO schema_migrations(version) VALUES('V024__intercession_prayer_completion');
COMMIT;
