-- Additive migration. Existing user IDs, passwords and all attendance/TTS rows remain unchanged.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V006__kakao_login') THEN
    RAISE EXCEPTION 'V006 is already applied';
  END IF;
END $$;
ALTER TABLE users ADD COLUMN kakao_id varchar(100);
CREATE UNIQUE INDEX users_kakao_id_unique ON users(kakao_id);
CREATE TABLE kakao_auth_flows (
  id varchar(36) PRIMARY KEY,
  state_hash varchar(64) NOT NULL UNIQUE,
  challenge varchar(43) NOT NULL,
  purpose varchar(20) NOT NULL CHECK(purpose IN ('LOGIN','LINK')),
  stage varchar(20) NOT NULL CHECK(stage IN ('STARTED','AUTHORIZED','REGISTERING')),
  native_client boolean NOT NULL,
  expires_at timestamp(6) with time zone NOT NULL,
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  auth_version bigint,
  ticket_hash varchar(64),
  kakao_id varchar(100),
  failure varchar(20)
);
CREATE INDEX kakao_auth_flows_expiry ON kakao_auth_flows(expires_at);
INSERT INTO schema_migrations(version) VALUES('V006__kakao_login');
COMMIT;
