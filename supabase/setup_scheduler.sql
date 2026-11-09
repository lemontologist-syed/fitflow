-- FitFlow reminder scheduler (pg_cron + pg_net), run AFTER the schema
-- migration and AFTER deploying the `fitflow` Edge Function.
-- Supabase Dashboard -> SQL Editor -> paste -> replace the three placeholders -> Run.
--
--   <PROJECT_URL>  e.g. https://abcdefghijklmnop.supabase.co   (Settings -> API)
--   <CRON_SECRET>  the CRON_SECRET you generated with GENERATE_KEYS.bat
--                  (must equal the CRON_SECRET Edge Function secret)
--   <PUBLISHABLE_KEY>  the same public key you put in config.js (sb_publishable_...);
--                  sent as `apikey` so the call also passes Supabase's gateway
--                  if "Verify JWT" was left on. It is public; the CRON_SECRET is what
--                  actually authorizes the call.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secrets live in Supabase Vault, not in the job text.
select vault.create_secret('<PROJECT_URL>', 'fitflow_project_url', 'FitFlow: Supabase project URL');
select vault.create_secret('<CRON_SECRET>', 'fitflow_cron_secret', 'FitFlow: shared secret for the cron route');
select vault.create_secret('<PUBLISHABLE_KEY>', 'fitflow_publishable_key', 'FitFlow: public API key (same as config.js)');

-- Every minute: ask the Edge Function to send due reminders.
select cron.schedule(
  'fitflow-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'fitflow_project_url')
           || '/functions/v1/fitflow/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'fitflow_publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fitflow_cron_secret')
    ),
    body := jsonb_build_object('at', now()),
    timeout_milliseconds := 25000
  ) as request_id;
  $$
);

-- Daily housekeeping of pg_cron's own run history.
select cron.schedule(
  'fitflow-cron-history-cleanup',
  '17 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '3 days' $$
);

-- ---------------------------------------------------------------------------
-- Checks (run these any time):
--   select jobid, jobname, schedule, active from cron.job;
--   select status, return_message, start_time from cron.job_run_details
--     order by start_time desc limit 10;
--   select status_code, content, created from net._http_response
--     order by created desc limit 10;
--
-- To change the URL or secret later:
--   select vault.update_secret((select id from vault.secrets where name = 'fitflow_cron_secret'), '<NEW_SECRET>');
-- To stop reminders entirely:
--   select cron.unschedule('fitflow-reminders');
-- ---------------------------------------------------------------------------
