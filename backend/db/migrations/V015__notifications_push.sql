-- Prepared only. Apply after backup/restore rehearsal, before deploying the new server.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V015__notifications_push') THEN
    RAISE EXCEPTION 'V015 is already applied';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V014__apple_passwordless') THEN
    RAISE EXCEPTION 'V014 must be applied before V015';
  END IF;
END $$;
ALTER TABLE notifications ADD COLUMN dedupe_key varchar(180);
ALTER TABLE notifications ADD COLUMN target_path varchar(200);
CREATE UNIQUE INDEX notifications_user_dedupe ON notifications(user_id,dedupe_key);
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK(type IN ('EVENT','MINUTE','SYSTEM','ATTENDANCE','EVENT_DEADLINE','TTS','MEETING_VOTE','EVANGELISM'));
ALTER TABLE meeting_minutes ADD COLUMN notification_published boolean NOT NULL DEFAULT false;
UPDATE meeting_minutes SET notification_published=true WHERE is_active;
CREATE TABLE notification_preferences(
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE push_devices(
  installation_id varchar(36) PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform varchar(10) NOT NULL CHECK(platform IN ('IOS','ANDROID')),
  token varchar(4096) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  app_version varchar(50), active boolean NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX push_devices_user ON push_devices(user_id);
CREATE TABLE push_deliveries(
  id bigserial PRIMARY KEY,
  notification_id bigint NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  installation_id varchar(36) NOT NULL REFERENCES push_devices(installation_id) ON DELETE CASCADE,
  status varchar(16) NOT NULL CHECK(status IN ('PENDING','SENT','FAILED','CANCELED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  UNIQUE(notification_id,installation_id)
);
CREATE INDEX push_deliveries_due ON push_deliveries(status,next_attempt_at,id);
INSERT INTO schema_migrations(version) VALUES('V015__notifications_push');
COMMIT;
