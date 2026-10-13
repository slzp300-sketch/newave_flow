-- Standard meeting TTS items are checked after participation, separately from
-- attendance responses. Preserve all answers and rules before the current KST week.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
SET LOCAL lock_timeout='10s';
LOCK TABLE tts_item, tts_question_revisions IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  today_kst date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date;
  effective date; mapping record; target_id bigint; matches integer; prior tts_question_revisions%ROWTYPE;
BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V007__manual_standard_tts_meetings') THEN
    RAISE EXCEPTION 'V007 is already applied';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V005__link_standard_tts_meetings') THEN
    RAISE EXCEPTION 'Expected the reviewed V005 configuration';
  END IF;
  effective := today_kst - EXTRACT(DOW FROM today_kst)::integer;
  FOR mapping IN SELECT * FROM (VALUES ('교사회의','SAT_MEETING'),('온라인줌기도모임','PRAYER_MEETING')) AS m(title,link) LOOP
    SELECT count(*),min(id) INTO matches,target_id FROM tts_item
      WHERE regexp_replace(title,'\s','','g')=mapping.title AND q_type='ATTEND' AND is_active;
    IF matches<>1 THEN RAISE EXCEPTION 'Expected exactly one standard meeting item'; END IF;
    IF EXISTS(SELECT 1 FROM tts_question_revisions WHERE question_id=target_id AND effective_from>effective) THEN
      RAISE EXCEPTION 'Future question rules require separate review';
    END IF;
    SELECT * INTO prior FROM tts_question_revisions WHERE question_id=target_id AND effective_from<=effective
      ORDER BY effective_from DESC LIMIT 1;
    IF NOT FOUND OR prior.type<>'ATTEND' OR NOT prior.active
      OR regexp_replace(prior.title,'\s','','g')<>mapping.title
      OR prior.link_type IS DISTINCT FROM mapping.link
      OR (SELECT link_type FROM tts_item WHERE id=target_id) IS DISTINCT FROM mapping.link THEN
      RAISE EXCEPTION 'Question configuration differs from the reviewed linked configuration';
    END IF;
    INSERT INTO tts_question_revisions(question_id,effective_from,title,type,emoji,display_order,active,points,link_type)
      VALUES(target_id,effective,prior.title,prior.type,prior.emoji,prior.display_order,prior.active,prior.points,'NONE')
      ON CONFLICT(question_id,effective_from) DO UPDATE SET link_type=EXCLUDED.link_type;
    UPDATE tts_item SET link_type='NONE' WHERE id=target_id;
  END LOOP;
  INSERT INTO schema_migrations(version) VALUES('V007__manual_standard_tts_meetings');
END $$;
COMMIT;
