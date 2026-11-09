-- FitFlow database schema (Supabase / PostgreSQL 15+)
-- Run once in Supabase Dashboard -> SQL Editor (or `npx supabase db push`).
-- Every table is private: Row Level Security limits each row to its owner.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Synced tables use last-write-wins on the client timestamp `updated_at`.
-- An older write arriving late (e.g. from an offline phone) is ignored.
create or replace function public.fitflow_lww()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- keep the newer row, skip this update
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Synced tables. Primary key (user_id, id): ids are chosen by the app and are
-- deterministic where it matters (e.g. '2026-11-09:lunch'), so the same
-- record coming from two devices can never be duplicated.
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'me',
  display_name text,
  age int check (age between 10 and 120),
  sex text,
  height_cm numeric(5,1) check (height_cm between 50 and 260),
  start_weight_kg numeric(5,1) check (start_weight_kg between 20 and 400),
  goal_weight_kg numeric(5,1) check (goal_weight_kg between 20 and 400),
  activity_level text,
  exercise_window text,
  evening_window text,
  timezone text not null default 'Asia/Seoul',
  kcal_target_min int not null default 1800,
  kcal_target_max int not null default 2000,
  protein_target_min int not null default 110,
  protein_target_max int not null default 130,
  onboarding_done boolean not null default false,
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- Daily schedule: one row per routine item; reminder on/off lives here too.
create table public.schedule_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 1 and 80),
  time_local text not null check (time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  kind text not null default 'custom',
  days int[] , -- weekdays 0=Sun..6=Sat; null = every day
  reminder_enabled boolean not null default true,
  notify_body text check (char_length(notify_body) <= 200),
  sort_order int not null default 0,
  is_custom boolean not null default false,
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table public.reminder_preferences (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'me',
  push_enabled boolean not null default false,
  snooze_minutes int not null default 10 check (snooze_minutes between 1 and 120),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table public.task_completions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, -- '<local_date>:<item_id>'
  local_date date not null,
  item_id text not null,
  status text not null check (status in ('completed', 'skipped')),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id),
  unique (user_id, local_date, item_id)
);

-- Workout plans: each 4-week training cycle the user runs.
create table public.training_cycles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  label text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'maintenance')),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id),
  check (end_date >= start_date)
);

-- Workout exercises: the user's choice of standard or easier variant.
create table public.exercise_preferences (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, -- exercise key, e.g. 'pushup'
  variant text not null default 'standard' check (variant in ('standard', 'easier')),
  notes text,
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table public.workout_sessions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  local_date date not null,
  cycle_id text,
  program_week int check (program_week between 1 and 4),
  effective_week int check (effective_week between 1 and 4),
  day_type text not null,
  status text not null check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds int,
  fatigue int check (fatigue between 1 and 5),
  pain boolean,
  recovery text check (recovery in ('good', 'ok', 'poor')),
  notes text,
  progress jsonb, -- resume state of an interrupted session
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table public.exercise_results (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, -- '<session_id>:<step index>'
  session_id text not null,
  exercise_key text not null,
  variant text not null default 'standard',
  round int not null,
  target_reps int,
  actual_reps int,
  target_seconds int,
  actual_seconds int,
  skipped boolean not null default false,
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- Editable food database (nutrition values are estimates).
create table public.foods (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  unit text not null, -- e.g. '100 g', '1 egg'
  kcal numeric(7,1) not null check (kcal >= 0),
  protein_g numeric(6,1) not null check (protein_g >= 0),
  category text not null,
  is_custom boolean not null default false,
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table public.meal_templates (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  name text not null,
  items jsonb not null default '[]', -- [{food_id, qty}]
  steps jsonb not null default '[]', -- recipe steps (text)
  notes text,
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table public.meal_logs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, -- '<local_date>:<slot>'
  local_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  template_id text,
  items jsonb not null default '[]',
  checked jsonb not null default '[]',
  kcal numeric(7,1),
  protein_g numeric(6,1),
  status text not null default 'planned' check (status in ('planned', 'eaten', 'skipped')),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id),
  unique (user_id, local_date, slot)
);

create table public.weight_logs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, -- '<local_date>'
  local_date date not null,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 400),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id),
  unique (user_id, local_date)
);

-- ---------------------------------------------------------------------------
-- Server-managed tables (written by the Edge Function with the secret key)
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  failure_count int not null default 0,
  disabled_at timestamptz,
  disabled_reason text
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null unique, -- one row per reminder occurrence
  kind text not null check (kind in ('reminder', 'snooze', 'test')),
  item_id text,
  local_date date,
  title text,
  body text,
  scheduled_for timestamptz not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'no_subscription')),
  sent_at timestamptz,
  delivered_at timestamptz, -- set when the device's service worker confirms display
  success_count int not null default 0,
  failure_count int not null default 0,
  error text,
  receipt_token text unique,
  created_at timestamptz not null default now()
);

create table public.snoozes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id text not null,
  local_date date not null,
  title text not null,
  fire_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers and indexes
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles','schedule_items','reminder_preferences','task_completions',
    'training_cycles','exercise_preferences','workout_sessions','exercise_results','foods',
    'meal_templates','meal_logs','weight_logs']
  loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.fitflow_lww()', t || '_lww', t);
    execute format('create index %I on public.%I (user_id, server_updated_at)', t || '_sync_idx', t);
  end loop;
end $$;

create index task_completions_date_idx on public.task_completions (user_id, local_date);
create index workout_sessions_date_idx on public.workout_sessions (user_id, local_date);
create index meal_logs_date_idx on public.meal_logs (user_id, local_date);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id) where disabled_at is null;
create index notification_log_user_idx on public.notification_log (user_id, created_at desc);
create index snoozes_due_idx on public.snoozes (fire_at) where sent_at is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles','schedule_items','reminder_preferences','task_completions',
    'training_cycles','exercise_preferences','workout_sessions','exercise_results','foods',
    'meal_templates','meal_logs','weight_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_owner', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_owner on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Users may read and clear their own delivery history; only the server writes it.
alter table public.notification_log enable row level security;
create policy notification_log_read on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_log_delete on public.notification_log for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.notification_log from anon;
grant delete on public.notification_log to authenticated;
-- Column grant: the receipt token (a capability for the service worker) is
-- deliberately not readable through the API.
grant select (id, user_id, dedupe_key, kind, item_id, local_date, title, body, scheduled_for,
  status, sent_at, delivered_at, success_count, failure_count, error, created_at)
  on public.notification_log to authenticated;

alter table public.snoozes enable row level security;
create policy snoozes_owner on public.snoozes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.snoozes from anon;
grant select, insert, delete on public.snoozes to authenticated;
