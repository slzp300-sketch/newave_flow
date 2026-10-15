-- Additive request receipts only. Actual erasure remains a reviewed, maintenance-mode transaction.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('newave_flow_schema'));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM schema_migrations WHERE version='V010__account_deletion_requests') THEN
    RAISE EXCEPTION 'V010 is already applied';
  END IF;
END $$;
CREATE TABLE account_deletion_requests (
  id varchar(36) PRIMARY KEY,
  user_id bigint UNIQUE REFERENCES users(id),
  user_created_at timestamp(6),
  receipt_token_hash varchar(64) UNIQUE NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('REQUESTED','COMPLETED')),
  requested_at timestamp(6) with time zone NOT NULL,
  target_at timestamp(6) with time zone NOT NULL,
  completed_at timestamp(6) with time zone,
  handover_required boolean NOT NULL,
  CONSTRAINT account_deletion_receipt_state CHECK (
    (status='REQUESTED' AND user_id IS NOT NULL AND user_created_at IS NOT NULL AND completed_at IS NULL) OR
    (status='COMPLETED' AND user_id IS NULL AND user_created_at IS NULL AND completed_at IS NOT NULL))
);
CREATE INDEX account_deletion_requests_queue ON account_deletion_requests(status,requested_at);
INSERT INTO schema_migrations(version) VALUES('V010__account_deletion_requests');
COMMIT;
