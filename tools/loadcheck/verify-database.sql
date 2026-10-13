\set ON_ERROR_STOP on
DO $$
BEGIN
  IF current_database() <> 'newave_loadcheck' THEN RAISE EXCEPTION 'Unexpected database'; END IF;
  IF (SELECT count(*) FROM users) <> 100 THEN RAISE EXCEPTION 'User count mismatch'; END IF;
  IF (SELECT count(*) FROM students) <> 500 THEN RAISE EXCEPTION 'Student count mismatch'; END IF;
  IF (SELECT count(*) FROM attendances) <> 500 THEN RAISE EXCEPTION 'Attendance count mismatch'; END IF;
  IF (SELECT count(*) FROM daily_reports WHERE status='SUBMITTED' AND total_students=10 AND present_count=9 AND absent_count=1) <> 50
    OR (SELECT count(*) FROM daily_reports) <> 50 THEN RAISE EXCEPTION 'Shared report mismatch'; END IF;
  IF (SELECT count(*) FROM event_attendances) <> 100 THEN RAISE EXCEPTION 'Teacher event response mismatch'; END IF;
  IF (SELECT count(*) FROM event_student_attendances) <> 500 THEN RAISE EXCEPTION 'Student event response mismatch'; END IF;
  IF (SELECT count(*) FROM tts_data_entry) <> 1400 THEN RAISE EXCEPTION 'TTS record mismatch'; END IF;
  IF (SELECT count(*) FROM tts_answers) <> 9300 THEN RAISE EXCEPTION 'TTS answer mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM daily_reports GROUP BY class_group_id,report_date HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM tts_data_entry GROUP BY teacher_id,info_year,week_num HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM event_student_attendances GROUP BY event_id,student_id HAVING count(*)>1)
    THEN RAISE EXCEPTION 'Duplicate record'; END IF;
END $$;
SELECT json_build_object('passed',true,'teachers',100,'students',500,'attendanceRows',500,
 'submittedSharedReports',50,'teacherEventResponses',100,'studentEventResponses',500,
 'ttsRecords',1400,'ttsAnswers',9300,'duplicateRecords',0);
