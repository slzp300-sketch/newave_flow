-- Prepared for a future deployment. Do not apply to production during preview work.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V016__teacher_profile_gender') THEN RAISE EXCEPTION 'V016 is already applied'; END IF;
  IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V015__weekly_church_reports') THEN RAISE EXCEPTION 'V015 must be applied before V016'; END IF;
END $$;
ALTER TABLE users ADD COLUMN gender varchar(10) CHECK(gender IS NULL OR gender IN ('남','여'));
-- Reuse an explicitly recorded value; never infer it from a name, title or assigned class.
UPDATE users u SET gender=last_check.gender
FROM (SELECT DISTINCT ON (teacher_id) teacher_id,gender FROM teacher_worship_attendances
      WHERE gender IN ('남','여') ORDER BY teacher_id,worship_date DESC,updated_at DESC,id DESC) last_check
WHERE u.id=last_check.teacher_id;
ALTER TABLE teacher_worship_attendances DROP CONSTRAINT teacher_worship_attendances_gender_check;
ALTER TABLE teacher_worship_attendances ADD CONSTRAINT teacher_worship_attendances_gender_check CHECK(gender IN ('','남','여'));
INSERT INTO schema_migrations(version) VALUES('V016__teacher_profile_gender');
COMMIT;
