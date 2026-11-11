-- Preparation only. Validate on a restored database before a separately authorized deployment.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V023__intercession_schedule') THEN RAISE EXCEPTION 'V023 already applied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V022__intercession_team') THEN RAISE EXCEPTION 'V022 required'; END IF;
END $$;
ALTER TABLE intercession_meetings
 ADD COLUMN canceled boolean NOT NULL DEFAULT false,
 ADD COLUMN cancellation_reason varchar(120) NOT NULL DEFAULT '' CHECK(cancellation_reason IN('','교회 행사','부서 행사','기타'));
ALTER TABLE intercession_meetings ALTER COLUMN start_time SET DEFAULT TIME '21:30';
UPDATE intercession_meetings SET start_time=TIME '21:30' WHERE start_time IS DISTINCT FROM TIME '21:30';
INSERT INTO schema_migrations(version) VALUES('V023__intercession_schedule');
COMMIT;
