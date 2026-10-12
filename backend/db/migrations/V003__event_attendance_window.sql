-- Add a reception start date; preserve every existing event and attendance record.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'V003__event_attendance_window') THEN
        RAISE EXCEPTION 'V003__event_attendance_window already applied';
    END IF;
END $$;
ALTER TABLE events ADD COLUMN attendance_start_date DATE;
ALTER TABLE events ADD CONSTRAINT ck_event_attendance_window
    CHECK (attendance_start_date IS NULL OR attendance_start_date <= COALESCE(attendance_deadline, end_date, event_date));
INSERT INTO schema_migrations(version) VALUES ('V003__event_attendance_window');
COMMIT;
