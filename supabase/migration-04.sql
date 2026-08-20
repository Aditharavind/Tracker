-- =====================================================================
-- 75 Hard -- migration 04: invite links, IP-based session suggestion
--
-- Run this if your database already has groups/users/tasks/completions/
-- day_notes (e.g. from the older schema.sql or migration-02/03). Idempotent
-- -- safe to run more than once.
--
-- Starting from an empty project instead? Just run schema.sql, which now
-- includes everything here.
-- =====================================================================

-- ---------------------------------------------------------------- groups

alter table public.groups add column if not exists invite_token text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_invite_token_key') then
    alter table public.groups add constraint groups_invite_token_key unique (invite_token);
  end if;
end $$;

-- Backfill: every existing group needs a link before anyone can invite into it.
update public.groups
   set invite_token = substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 12)
 where invite_token is null;

-- ---------------------------------------------------------------- users

alter table public.users add column if not exists last_ip      text;
alter table public.users add column if not exists last_seen_at timestamptz;

create index if not exists users_last_ip_idx
  on public.users (last_ip, last_seen_at desc);

-- ---------------------------------------------------------------- checks

--   select id, invite_token from public.groups order by id;
--   select id, name, last_ip, last_seen_at from public.users order by id;
