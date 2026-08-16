-- =====================================================================
-- 75 Hard -- migration 02: groups, PINs, share links, wake-up task
--
-- Run this if you already ran schema.sql. It brings that database up to the
-- full feature set. Idempotent -- safe to run more than once.
--
-- Starting from an empty project instead? Just run schema.sql, which now
-- includes everything here.
-- =====================================================================

-- ---------------------------------------------------------------- groups

-- A board. You only ever see other members of your own group, which is what
-- stops two strangers who both open the app landing on the same board.
create table if not exists public.groups (
  id         bigint generated always as identity primary key,
  name       text        not null default 'My board',
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

-- ---------------------------------------------------------------- users

alter table public.users add column if not exists group_id     bigint;
alter table public.users add column if not exists pin_hash     text;
alter table public.users add column if not exists wake_time    time;
alter table public.users add column if not exists share_token  text;
-- keeps lifetime stats and earned trophies alive across a manual restart
alter table public.users add column if not exists restarted_at date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_group_id_fkey') then
    alter table public.users
      add constraint users_group_id_fkey
      foreign key (group_id) references public.groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'users_share_token_key') then
    alter table public.users add constraint users_share_token_key unique (share_token);
  end if;
end $$;

create index if not exists users_group_idx on public.users (group_id, id);

-- ---------------------------------------------------------------- tasks

-- locked tasks are the bare minimum and cannot be deleted; reps_target
-- carries the "N reps to wake up" number.
alter table public.tasks add column if not exists locked      boolean not null default false;
alter table public.tasks add column if not exists reps_target int;

-- ------------------------------------------------- backfill existing rows

-- Anyone created before groups existed gets their own isolated board and a
-- share link, so nothing suddenly becomes visible to everyone else.
-- md5(random()) rather than gen_random_bytes() so this needs no extensions.
do $$
declare
  u record;
  g bigint;
begin
  for u in select id from public.users where group_id is null loop
    insert into public.groups default values returning id into g;
    update public.users set group_id = g where id = u.id;
  end loop;

  for u in select id from public.users where share_token is null loop
    update public.users
       set share_token = substr(md5(random()::text || clock_timestamp()::text), 1, 12)
     where id = u.id;
  end loop;
end $$;

-- ---------------------------------------------------------------- checks

--   select id, name, group_id, share_token, pin_hash is not null as has_pin
--     from public.users order by id;
--   select column_name, data_type from information_schema.columns
--    where table_name = 'users' order by ordinal_position;
