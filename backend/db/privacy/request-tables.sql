-- Connection-local review inputs. Never store raw review material in public tables.
CREATE TEMP TABLE privacy_request (
  request_id uuid NOT NULL, user_id bigint NOT NULL, expected_created_at timestamp NOT NULL,
  identity_verified boolean NOT NULL DEFAULT false,
  handover_reviewed boolean NOT NULL DEFAULT false,
  external_copies_reviewed boolean NOT NULL DEFAULT false,
  free_text_reviewed boolean NOT NULL DEFAULT false
) ON COMMIT DROP;
CREATE TEMP TABLE privacy_legacy_decisions (id bigint PRIMARY KEY, remove boolean NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE privacy_redactions (
  table_name text NOT NULL, column_name text NOT NULL, row_id bigint NOT NULL,
  before_md5 text NOT NULL, replacement text,
  PRIMARY KEY(table_name,column_name,row_id)
) ON COMMIT DROP;
CREATE TEMP TABLE privacy_identifiers (value text PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE privacy_exceptions (
  table_name text NOT NULL,column_name text NOT NULL,row_id bigint NOT NULL,before_md5 text NOT NULL,
  reason text NOT NULL CHECK(length(trim(reason)) >= 10),
  PRIMARY KEY(table_name,column_name,row_id)
) ON COMMIT DROP;
-- Explicit author-content decisions are independent of identifier search exceptions.
CREATE TEMP TABLE privacy_content_review (
  table_name text NOT NULL,column_name text NOT NULL,row_id bigint NOT NULL,before_md5 text NOT NULL,
  decision text NOT NULL CHECK(decision IN ('erase','redact','retain_other')),
  reason text NOT NULL CHECK(length(trim(reason))>=10),
  PRIMARY KEY(table_name,column_name,row_id)
) ON COMMIT DROP;
CREATE TEMP TABLE privacy_owned_student_memos (id bigint PRIMARY KEY,before_md5 text NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE privacy_content_candidates (
  table_name text NOT NULL,column_name text NOT NULL,row_id bigint NOT NULL,before_md5 text NOT NULL,
  PRIMARY KEY(table_name,column_name,row_id)
) ON COMMIT DROP;
