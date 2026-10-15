-- Optional until Apple notifications are activated. No mapped JPA fields depend on these tables.
-- Only scoped SHA-256 identifiers and event/grant times are retained; never JWTs, names, or email addresses.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V011__apple_notifications') THEN
    RAISE EXCEPTION 'V011 is already applied';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V010__account_deletion_requests') THEN
    RAISE EXCEPTION 'V010 must be applied before V011';
  END IF;
END $$;
CREATE TABLE apple_notification_subjects (
  subject_hash varchar(64) PRIMARY KEY CHECK(subject_hash ~ '^[0-9a-f]{64}$'),
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  consent_revoked_at bigint CHECK(consent_revoked_at > 0),
  account_deleted_at bigint CHECK(account_deleted_at > 0),
  grant_started_at bigint CHECK(grant_started_at > 0),
  updated_at timestamp(6) with time zone NOT NULL
);
CREATE INDEX apple_notification_subjects_owner ON apple_notification_subjects(user_id);
CREATE INDEX apple_notification_subjects_expiry ON apple_notification_subjects(updated_at) WHERE user_id IS NULL;
CREATE TABLE apple_notification_receipts (
  jti_hash varchar(64) PRIMARY KEY CHECK(jti_hash ~ '^[0-9a-f]{64}$'),
  subject_hash varchar(64) NOT NULL REFERENCES apple_notification_subjects(subject_hash) ON DELETE CASCADE,
  payload_hash varchar(64) NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}$'),
  received_at timestamp(6) with time zone NOT NULL
);
CREATE INDEX apple_notification_receipts_subject ON apple_notification_receipts(subject_hash);
CREATE INDEX apple_notification_receipts_expiry ON apple_notification_receipts(received_at);
INSERT INTO schema_migrations(version) VALUES('V011__apple_notifications');
COMMIT;
