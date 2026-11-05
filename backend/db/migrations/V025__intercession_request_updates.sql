-- Preparation only. Validate on an isolated database before an authorized deployment.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V025__intercession_request_updates') THEN RAISE EXCEPTION 'V025 already applied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V024__intercession_prayer_completion') THEN RAISE EXCEPTION 'V024 required'; END IF;
END $$;
ALTER TABLE intercession_requests ADD COLUMN pending_update text;
ALTER TABLE intercession_requests ADD COLUMN update_history text NOT NULL DEFAULT '[]';
INSERT INTO schema_migrations(version) VALUES('V025__intercession_request_updates');
COMMIT;
