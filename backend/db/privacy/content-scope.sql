-- Shared/authorless text needs an explicit ownership decision even when it contains no name.
-- Fixed-format status/type/image fields are reviewed separately; future plaintext columns enter
-- this scope automatically. No table/column/value supplied by the operator changes this inventory.
SELECT c.table_name,c.column_name
FROM information_schema.columns c
WHERE c.table_schema='public'
  AND c.data_type IN ('text','character varying','character')
  AND c.table_name IN (
    'attendances','daily_reports','daily_reports_before_class_merge','deactivation_requests','student_memos',
    'event_student_attendances','events','meeting_minutes','checklist_items','tts_item',
    'tts_question_revisions','evangelism_groups','content_reports','user_status_events','moderated_photos')
  AND (c.table_name,c.column_name) NOT IN (
    ('attendances','status'),('daily_reports','status'),('daily_reports_before_class_merge','status'),
    ('deactivation_requests','status'),('event_student_attendances','status'),
    ('events','start_time'),('events','end_time'),('events','color'),('events','event_type'),('events','attendance_target'),
    ('tts_item','q_type'),('tts_item','emoji'),('tts_item','link_type'),
    ('tts_question_revisions','type'),('tts_question_revisions','emoji'),('tts_question_revisions','link_type'),
    ('content_reports','request_id'),('content_reports','target_type'),('content_reports','content_type'),
    ('content_reports','reason'),('content_reports','status'),('content_reports','action'),
    ('user_status_events','action'),('moderated_photos','target_type'),('moderated_photos','status'),('moderated_photos','pending_image'))
ORDER BY c.table_name,c.column_name
