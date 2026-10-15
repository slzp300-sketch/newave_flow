-- Additive only: no changes to existing users, passwords, approval state, or church records.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V009__apple_login') THEN
    RAISE EXCEPTION 'V009 is already applied';
  END IF;
END $$;
CREATE TABLE apple_accounts (
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  subject varchar(255) NOT NULL UNIQUE,
  refresh_token_ciphertext text,
  revoked_at timestamp(6) with time zone,
  CONSTRAINT apple_account_token_state CHECK (
    (revoked_at IS NULL AND refresh_token_ciphertext IS NOT NULL) OR
    (revoked_at IS NOT NULL AND refresh_token_ciphertext IS NULL))
);
CREATE TABLE apple_auth_flows (
  id varchar(36) PRIMARY KEY,
  state_hash varchar(64) NOT NULL,
  nonce_hash varchar(64) NOT NULL,
  challenge varchar(43) NOT NULL,
  purpose varchar(20) NOT NULL CHECK(purpose IN ('LOGIN','LINK')),
  stage varchar(20) NOT NULL CHECK(stage IN ('STARTED','REGISTERING')),
  expires_at timestamp(6) with time zone NOT NULL,
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  auth_version bigint,
  ticket_hash varchar(64),
  subject varchar(255),
  refresh_token_ciphertext text
);
CREATE INDEX apple_auth_flows_expiry ON apple_auth_flows(expires_at);
CREATE INDEX apple_auth_flows_subject ON apple_auth_flows(subject);
INSERT INTO schema_migrations(version) VALUES('V009__apple_login');
COMMIT;
