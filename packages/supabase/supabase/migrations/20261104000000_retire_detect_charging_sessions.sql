-- The 2-minute job `detect-charging-sessions` guessed charging sessions from the charger's status and energy readings. Since OCPP (the charger's
-- own transaction messages) became the source of truth it only did harm: when its read of the open sessions failed, or the status moved on, it
-- inserted a second "inferred" session for a charge already running, and wrote an end time and "Local" onto real ones without marking them finished.
-- Sessions now come from the charger only. Idempotent; the route /api/cron/detect-charging-sessions stays as a no-op.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'detect-charging-sessions';
end $$;
