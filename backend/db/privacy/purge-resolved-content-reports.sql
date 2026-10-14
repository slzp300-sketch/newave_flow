-- Manual scheduled maintenance: removes closed safety reports only after the 90-day retention window.
-- Never deletes open reports, original content, accounts, attendance or TTS records.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
DELETE FROM content_reports
WHERE status IN ('RESOLVED','DISMISSED') AND resolved_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
COMMIT;
