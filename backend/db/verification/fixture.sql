-- Synthetic data only. Apply to the empty schema reconstructed from baseline 7e3584e.
INSERT INTO users (id,name,email,password,role,is_active,large_font) VALUES
 (1,'검증 담임','primary@example.invalid','synthetic','TEACHER',true,false),
 (2,'검증 부담임','assistant@example.invalid','synthetic','TEACHER',true,false),
 (3,'검증 비활성','inactive@example.invalid','synthetic','TEACHER',false,false),
 (4,'검증 관리자','admin@example.invalid','synthetic','ADMIN',true,false);
INSERT INTO class_groups (id,name,age_group) VALUES (1,'검증 원래 반','중1'),(2,'검증 이동 반','중2');
INSERT INTO teacher_classes (id,teacher_id,class_group_id,is_primary) VALUES (1,1,1,true),(2,2,1,false);
INSERT INTO students (id,name,class_group_id,grade,is_active) VALUES
 (1,'검증 재적',1,'중1',true),(2,'검증 제적',1,'중1',false);
INSERT INTO attendances (id,student_id,class_group_id,teacher_id,attendance_date,status) VALUES
 (1,1,1,1,DATE '2026-01-04','PRESENT');
INSERT INTO daily_reports (id,teacher_id,class_group_id,report_date,status,total_students,present_count,absent_count,late_count,special_notes,submitted_at,updated_at) VALUES
 (1,1,1,DATE '2026-01-04','SUBMITTED',1,1,0,0,'담임 메모',TIMESTAMP '2026-01-04 12:00',TIMESTAMP '2026-01-04 12:00'),
 (2,2,1,DATE '2026-01-04','DRAFT',1,0,1,0,'부담임 메모',null,TIMESTAMP '2026-01-04 13:00'),
 (3,1,1,DATE '2026-01-11','DRAFT',0,0,0,0,'같은 메모',null,TIMESTAMP '2026-01-11 12:00'),
 (4,2,1,DATE '2026-01-11','DRAFT',0,0,0,0,'같은 메모',null,TIMESTAMP '2026-01-11 13:00');
INSERT INTO events (id,title,event_date,end_date,event_type,attendance_required,attendance_target) VALUES
 (1,'검증 행사',DATE '2026-01-04',DATE '2026-01-06','SPECIAL',true,'BOTH'),
 (2,'출석 표시를 끈 과거 행사',DATE '2026-01-04',null,'SPECIAL',false,'BOTH'),
 (3,'일반 일정',DATE '2026-01-04',null,'MEETING',false,'STUDENT_ONLY');
INSERT INTO event_student_attendances (id,event_id,student_id,teacher_id,status) VALUES
 (1,1,2,1,'PRESENT'),(2,2,2,1,'PRESENT');
INSERT INTO event_attendances (id,event_id,teacher_id,status) VALUES (1,1,3,'PRESENT'),(2,2,3,'PRESENT');
INSERT INTO tts_item (id,title,q_type,is_active,display_order,points,link_type) VALUES
 (1,'검증 말씀','DAYS',true,1,5,'NONE'),(2,'검증 회의','ATTEND',true,2,10,'SAT_MEETING');
INSERT INTO tts_data_entry (id,teacher_id,info_year,week_num,is_submitted) VALUES (1,1,2026,2,false);
INSERT INTO tts_answers (id,record_id,question_id,answer_data) VALUES (1,1,1,'{"월":true}');
INSERT INTO meeting_attendances (id,teacher_id,meeting_date,status) VALUES (1,1,DATE '2026-01-10','ATTEND');
-- Explicit fixture IDs must not collide with later application inserts.
SELECT setval(pg_get_serial_sequence('users','id'),4);
SELECT setval(pg_get_serial_sequence('students','id'),2);
SELECT setval(pg_get_serial_sequence('class_groups','id'),2);
SELECT setval(pg_get_serial_sequence('teacher_classes','id'),2);
SELECT setval(pg_get_serial_sequence('daily_reports','id'),4);
SELECT setval(pg_get_serial_sequence('events','id'),3);
SELECT setval(pg_get_serial_sequence('tts_item','id'),2);
SELECT setval(pg_get_serial_sequence('tts_data_entry','id'),1);
SELECT setval(pg_get_serial_sequence('tts_answers','id'),1);
