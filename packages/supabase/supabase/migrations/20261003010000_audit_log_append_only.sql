-- Audit log is evidence: nobody with a client role (anon, authenticated, even
-- service_role used by app code) may rewrite or erase it. Rows are only ever
-- inserted by the log_activity() trigger (SECURITY DEFINER, runs as owner).
--
-- Foreign-key actions (e.g. audit_log.actor_id ON DELETE SET NULL when a
-- profile is permanently removed) execute as the table owner, so they are
-- unaffected by revoking these privileges.

revoke update, delete, truncate on waytara.audit_log from anon, authenticated, service_role;
revoke insert on waytara.audit_log from anon, authenticated;
-- service_role keeps INSERT: some trusted server paths record events directly.

comment on table waytara.audit_log is
  'Append-only: UPDATE/DELETE/TRUNCATE are revoked from every client role (see 20261003010000_audit_log_append_only).';

-- Same idea for the rate limiter's scratch table: only the SECURITY DEFINER
-- function writes it (already revoked from clients in the previous migration).
