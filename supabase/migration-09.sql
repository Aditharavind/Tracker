-- =====================================================================
-- 75 Hard -- migration 09: Coach chat transcript
--
-- Run after migration-08. Adds the table the new in-browser Coach chat
-- writes to -- inference runs entirely on the user's own device (WebLLM),
-- this table only persists the transcript so the panel still has it after a
-- refresh. The server never calls a model for this feature, unlike the
-- existing /users/:id/coach report endpoint.
--
-- Paste this into the Supabase SQL editor and run it once. Idempotent --
-- safe to re-run.
-- =====================================================================

create table if not exists public.coach_messages (
  id         bigint generated always as identity primary key,
  user_id    bigint      not null references public.users(id) on delete cascade,
  day        date        not null,
  role       text        not null check (role in ('user', 'assistant')),
  text       text        not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_day_idx
  on public.coach_messages (user_id, day);

alter table public.coach_messages enable row level security;

-- No policies -- same posture as every other table (see schema.sql's header
-- note): only the server's service-role key can touch this, anon/
-- authenticated get nothing.
