-- Must run inside the caller's transaction, after request-tables.sql and reviewed inputs.
-- No wildcard/name-based deletion. All exceptions/redactions bind to a row's current digest.
DO $$
DECLARE
  req record; target record; item record; col record; legacy record;
  hits bigint; changed bigint; current_digest text; apple_subject text;
BEGIN
  IF (SELECT count(*) FROM privacy_request) <> 1 THEN RAISE EXCEPTION 'Exactly one reviewed request is required'; END IF;
  SELECT * INTO req FROM privacy_request;
  IF NOT (req.identity_verified AND req.handover_reviewed AND req.external_copies_reviewed AND req.free_text_reviewed) THEN
    RAISE EXCEPTION 'Identity, handover, external copies and free-text review are required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('newave_flow_schema'));
  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (
    'users','students','class_groups','teacher_classes','tags','user_tags','attendances','daily_reports',
    'daily_reports_before_class_merge','student_memos','deactivation_requests','checklist_items','checklist_records',
    'events','event_attendances','event_participants','event_reads','event_student_attendances','meeting_minutes',
    'meeting_minute_confirms','meeting_attendances','notifications','prayer_votes','evangelism_assignments',
    'evangelism_groups','evangelism_group_members','evangelism_schedules','tts_answers','tts_data_entry','tts_item',
    'tts_legacy_score','tts_question_revisions','completed_operations','kakao_auth_flows','apple_accounts','apple_auth_flows',
    'account_deletion_requests','community_agreements','content_reports','apple_notification_subjects',
    'apple_notification_receipts','schema_migrations')) THEN
    RAISE EXCEPTION 'Unreviewed table; update the privacy data inventory before deletion';
  END IF;
  -- Blocks application writes while preserving read availability. Also covers tables added later.
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',item.tablename);
  END LOOP;
  -- Unknown cascades must never erase data implicitly; expand this list only after a privacy review.
  IF EXISTS(SELECT 1 FROM pg_constraint fk JOIN pg_class src ON src.oid=fk.conrelid
    JOIN pg_namespace ns ON ns.oid=src.relnamespace
    WHERE fk.contype='f' AND fk.confrelid='public.users'::regclass
      AND (ns.nspname<>'public' OR src.relname NOT IN ('teacher_classes','user_tags','event_reads','notifications',
        'meeting_minute_confirms','checklist_records','prayer_votes','meeting_attendances','evangelism_assignments',
        'evangelism_group_members','event_attendances','tts_data_entry','attendances','daily_reports','student_memos',
        'deactivation_requests','event_student_attendances','kakao_auth_flows','apple_accounts','apple_auth_flows',
        'account_deletion_requests','community_agreements','content_reports','apple_notification_subjects'))) THEN RAISE EXCEPTION 'Unreviewed account foreign key'; END IF;
  -- V011 is optional. When present, only its reviewed owner and receipt edges may cascade.
  IF (to_regclass('public.apple_notification_subjects') IS NULL) <>
     (to_regclass('public.apple_notification_receipts') IS NULL) THEN
    RAISE EXCEPTION 'Incomplete Apple notification privacy schema';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_constraint fk JOIN pg_class src ON src.oid=fk.conrelid
    JOIN pg_namespace ns ON ns.oid=src.relnamespace
    WHERE fk.contype='f' AND (
      fk.confrelid=to_regclass('public.apple_notification_receipts')
      OR (fk.confrelid=to_regclass('public.apple_notification_subjects') AND (
        ns.nspname<>'public' OR src.relname<>'apple_notification_receipts' OR fk.confdeltype<>'c'
        OR fk.conkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=fk.conrelid AND attname='subject_hash')]::smallint[]
        OR fk.confkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=fk.confrelid AND attname='subject_hash')]::smallint[]))
      OR (fk.conrelid=to_regclass('public.apple_notification_subjects') AND fk.confrelid='public.users'::regclass AND (
        fk.confdeltype<>'c'
        OR fk.conkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=fk.conrelid AND attname='user_id')]::smallint[]
        OR fk.confkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])))) THEN
    RAISE EXCEPTION 'Unreviewed Apple notification foreign key';
  END IF;
  SELECT * INTO target FROM users WHERE id=req.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target account is absent; reconcile the receipt before retry'; END IF;
  IF target.created_at IS DISTINCT FROM req.expected_created_at THEN RAISE EXCEPTION 'Target account identity changed'; END IF;
  IF target.role='ADMIN' AND target.is_active AND (SELECT count(*) FROM users WHERE role='ADMIN' AND is_active) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last active administrator';
  END IF;
  IF to_regclass('public.account_deletion_requests') IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM account_deletion_requests WHERE user_id=req.user_id
      AND (id<>req.request_id::text OR user_created_at IS DISTINCT FROM req.expected_created_at OR status<>'REQUESTED')) THEN
      RAISE EXCEPTION 'App deletion receipt does not match the reviewed request';
    END IF;
  END IF;
  IF to_regclass('public.apple_accounts') IS NOT NULL THEN
    -- A database deletion cannot revoke Apple authorization. The in-app request must do so first.
    IF EXISTS(SELECT 1 FROM apple_accounts WHERE user_id=req.user_id
      AND (revoked_at IS NULL OR refresh_token_ciphertext IS NOT NULL)) THEN
      RAISE EXCEPTION 'Apple authorization must be revoked before account erasure';
    END IF;
    SELECT subject INTO apple_subject FROM apple_accounts WHERE user_id=req.user_id;
  END IF;

  INSERT INTO privacy_identifiers(value)
    SELECT v FROM (VALUES(target.name),(target.email),(target.phone),(to_jsonb(target)->>'kakao_id'),(apple_subject)) x(v)
    WHERE v IS NOT NULL AND length(trim(v)) >= 2 ON CONFLICT DO NOTHING;
  -- Every legacy row with a matching name requires an explicit ownership decision, including namesakes.
  FOR legacy IN SELECT id FROM tts_legacy_score WHERE name IN (SELECT value FROM privacy_identifiers) LOOP
    IF NOT EXISTS(SELECT 1 FROM privacy_legacy_decisions WHERE id=legacy.id) THEN
      RAISE EXCEPTION 'Legacy score ownership review incomplete';
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM privacy_legacy_decisions d LEFT JOIN tts_legacy_score l ON l.id=d.id
    WHERE l.id IS NULL OR l.name NOT IN (SELECT value FROM privacy_identifiers)) THEN
    RAISE EXCEPTION 'Legacy decision is stale or outside the reviewed identities';
  END IF;

  FOR item IN SELECT * FROM privacy_redactions LOOP
    IF item.table_name IN ('users','schema_migrations') OR NOT EXISTS(
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=item.table_name
        AND column_name=item.column_name AND data_type IN ('text','character varying','character')) THEN
      RAISE EXCEPTION 'Invalid redaction target';
    END IF;
    EXECUTE format('SELECT md5(coalesce(%I::text,'''')) FROM public.%I WHERE id=$1',item.column_name,item.table_name)
      INTO current_digest USING item.row_id;
    IF current_digest IS DISTINCT FROM item.before_md5 THEN RAISE EXCEPTION 'Redaction changed since review'; END IF;
    EXECUTE format('UPDATE public.%I SET %I=$1 WHERE id=$2',item.table_name,item.column_name)
      USING item.replacement,item.row_id;
  END LOOP;

  DELETE FROM tts_answers WHERE record_id IN (SELECT id FROM tts_data_entry WHERE teacher_id=req.user_id);
  DELETE FROM tts_data_entry WHERE teacher_id=req.user_id;
  DELETE FROM tts_legacy_score WHERE id IN (SELECT id FROM privacy_legacy_decisions WHERE remove);
  IF to_regclass('public.kakao_auth_flows') IS NOT NULL THEN
    DELETE FROM kakao_auth_flows WHERE user_id=req.user_id OR kakao_id=to_jsonb(target)->>'kakao_id';
  END IF;
  IF to_regclass('public.apple_auth_flows') IS NOT NULL THEN
    DELETE FROM apple_auth_flows WHERE user_id=req.user_id OR subject=apple_subject;
  END IF;
  IF to_regclass('public.apple_accounts') IS NOT NULL THEN
    DELETE FROM apple_accounts WHERE user_id=req.user_id;
  END IF;
  IF to_regclass('public.apple_notification_subjects') IS NOT NULL THEN
    -- Delete only subjects linked to this account, including all client/subject scopes.
    -- Unlinked replay state and other accounts' state remain intact.
    DELETE FROM apple_notification_receipts WHERE subject_hash IN (
      SELECT subject_hash FROM apple_notification_subjects WHERE user_id=req.user_id);
    DELETE FROM apple_notification_subjects WHERE user_id=req.user_id;
  END IF;
  IF to_regclass('public.community_agreements') IS NOT NULL THEN
    DELETE FROM community_agreements WHERE user_id=req.user_id;
  END IF;
  IF to_regclass('public.content_reports') IS NOT NULL THEN
    -- Account-linked safety records contain no shared attendance/TTS outcomes.
    DELETE FROM content_reports WHERE reporter_id=req.user_id OR (target_type='USER' AND target_id=req.user_id);
    UPDATE content_reports SET moderator_id=NULL WHERE moderator_id=req.user_id;
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('teacher_classes','teacher_id'),('user_tags','user_id'),('event_reads','user_id'),
    ('notifications','user_id'),('meeting_minute_confirms','user_id'),('checklist_records','teacher_id'),
    ('prayer_votes','teacher_id'),('meeting_attendances','teacher_id'),('evangelism_assignments','teacher_id'),
    ('evangelism_group_members','teacher_id'),('event_attendances','teacher_id'),('completed_operations','actor_id')
  ) x(tbl,key) LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I=$1',item.tbl,item.key) USING req.user_id;
  END LOOP;
  DELETE FROM event_participants WHERE kind='TEACHER' AND person_id=req.user_id;
  -- Shared student outcomes are preserved. No anonymous login account is created.
  FOR item IN SELECT unnest(ARRAY['attendances','daily_reports','student_memos','deactivation_requests',
    'event_student_attendances','daily_reports_before_class_merge']) AS tbl LOOP
    IF to_regclass('public.'||item.tbl) IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET teacher_id=NULL WHERE teacher_id=$1',item.tbl) USING req.user_id;
    END IF;
  END LOOP;
  IF to_regclass('public.account_deletion_requests') IS NOT NULL THEN
    -- Preserve only an anonymous status receipt; completion is committed with the actual erasure.
    UPDATE account_deletion_requests SET user_id=NULL,user_created_at=NULL,status='COMPLETED',completed_at=CURRENT_TIMESTAMP
      WHERE user_id=req.user_id AND id=req.request_id::text;
  END IF;
  DELETE FROM users WHERE id=req.user_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Account delete count mismatch'; END IF;

  -- Search ALL retained text columns, including legacy copies and future tables. Never print values.
  FOR col IN SELECT c.table_name,c.column_name FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.data_type IN ('text','character varying','character')
      AND c.table_name NOT IN ('schema_migrations') LOOP
    -- V011 stores only SHA-256 values in these exact fields. A name fragment in a hash
    -- is not retained plaintext; ownership erasure above determines which hashes to remove.
    -- Validate the surviving format and keep scanning every other/new text column.
    IF (col.table_name,col.column_name) IN (
      ('apple_notification_subjects','subject_hash'),
      ('apple_notification_receipts','subject_hash'),
      ('apple_notification_receipts','jti_hash'),
      ('apple_notification_receipts','payload_hash')) THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL OR %I::text !~ ''^[0-9a-f]{64}$''',
        col.table_name,col.column_name,col.column_name) INTO hits;
      IF hits>0 THEN RAISE EXCEPTION 'Invalid Apple notification hash in %.%',col.table_name,col.column_name; END IF;
      CONTINUE;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=col.table_name AND column_name='id') THEN
      EXECUTE format('SELECT count(*) FROM public.%I t WHERE EXISTS(SELECT 1 FROM privacy_identifiers p WHERE strpos(lower(t.%I::text),lower(p.value))>0)',col.table_name,col.column_name) INTO hits;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I t WHERE EXISTS(SELECT 1 FROM privacy_identifiers p WHERE strpos(lower(t.%I::text),lower(p.value))>0)
        AND NOT EXISTS(SELECT 1 FROM privacy_exceptions e WHERE e.table_name=$1 AND e.column_name=$2 AND e.row_id::text=t.id::text AND e.before_md5=md5(coalesce(t.%I::text,'''')))',col.table_name,col.column_name,col.column_name)
        INTO hits USING col.table_name,col.column_name;
    END IF;
    IF hits>0 THEN RAISE EXCEPTION 'Retained text needs review in %.% (% rows)',col.table_name,col.column_name,hits; END IF;
  END LOOP;
END $$;
