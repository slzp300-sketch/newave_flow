-- Apple-created accounts retain the provider-verified email and do not require a local password.
-- Existing account passwords, identities, approvals and business rows are preserved.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V014__apple_passwordless') THEN
    RAISE EXCEPTION 'V014 is already applied';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V013__content_moderation') THEN
    RAISE EXCEPTION 'V013 must be applied before V014';
  END IF;
END $$;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE apple_auth_flows ADD COLUMN verified_email varchar(100);
ALTER TABLE apple_auth_flows ADD COLUMN email_private boolean;
ALTER TABLE apple_auth_flows DROP CONSTRAINT apple_auth_flows_purpose_check;
ALTER TABLE apple_auth_flows ADD CONSTRAINT apple_auth_flows_purpose_check CHECK(purpose IN ('LOGIN','LINK','DELETE'));
ALTER TABLE apple_auth_flows DROP CONSTRAINT apple_auth_flows_stage_check;
ALTER TABLE apple_auth_flows ADD CONSTRAINT apple_auth_flows_stage_check CHECK(stage IN ('STARTED','REGISTERING','DELETE_READY'));
INSERT INTO schema_migrations(version) VALUES('V014__apple_passwordless');
COMMIT;
