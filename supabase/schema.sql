-- =====================================================================
-- 75 Hard -- Supabase schema
--
-- Paste the whole file into the Supabase SQL editor and hit Run. It is
-- idempotent: re-running it will not destroy data.
--
-- Security model: there are no end-user logins. Every request goes through
-- the Express API, which holds the service-role key. RLS is therefore ON with
-- *no* permissive policies, so the anon key that ships in a browser bundle
-- cannot read or write anything even if someone digs it out. The service role
-- bypasses RLS by design.
-- =====================================================================

-- ---------------------------------------------------------------- tables

-- A board. You only ever see other members of your own group, which is what
-- stops two strangers who both open the app landing on the same board.
create table if not exists public.groups (
  id           bigint generated always as identity primary key,
  name         text        not null default 'My board',
  -- link that lets someone join this board as a real, editable member --
  -- distinct from users.share_token, which is read-only progress
  invite_token text,
  created_at   timestamptz not null default now(),
  constraint groups_invite_token_key unique (invite_token)
);

create table if not exists public.users (
  id          bigint generated always as identity primary key,
  name        text        not null,
  color       text        not null default '#e8734a',
  start_date  date        not null default current_date,
  -- set by the "Reset my run" button. start_date stays put so lifetime stats
  -- and already-earned trophies survive a restart; only the current run moves.
  restarted_at date,
  group_id    bigint      references public.groups(id) on delete cascade,
  pin_hash    text,        -- pbkdf2, see server/security.js
  wake_time   time,
  -- IANA zone (e.g. 'Asia/Kolkata'), auto-detected from the user's device.
  -- Every day-boundary decision for this user is derived from it server-side.
  timezone    text,
  -- Forest Dash minigame personal bests (global leaderboard). Not challenge state.
  dash_best_coins int not null default 0,
  dash_best_dist  int not null default 0,
  share_token text,        -- public read-only progress link
  -- Where this user was last seen, for the /session/suggest convenience only.
  -- Grants nothing: every write still needs the PIN.
  last_ip      text,
  last_seen_at timestamptz,
  -- Lets sign-in match on an indexed equality instead of an unindexable ILIKE.
  name_lower  text generated always as (lower(name)) stored,
  created_at  timestamptz not null default now(),
  constraint users_share_token_key unique (share_token),
  constraint users_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.tasks (
  id         bigint generated always as identity primary key,
  user_id    bigint      not null references public.users(id) on delete cascade,
  title      text        not null,
  emoji      text        not null default '*',
  -- core tasks are the 75 Hard rules: missing one kills the run.
  -- non-core ("bonus") tasks earn XP but can never break a streak.
  is_core    boolean     not null default true,
  -- locked tasks are the bare minimum and can't be deleted; reps_target
  -- carries the "N reps to wake up" number.
  locked     boolean     not null default false,
  reps_target int,
  sort       int         not null default 0,
  archived   boolean     not null default false,
  created_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0)
);

create table if not exists public.completions (
  id         bigint generated always as identity primary key,
  user_id    bigint      not null references public.users(id) on delete cascade,
  task_id    bigint      not null references public.tasks(id) on delete cascade,
  day        date        not null,
  created_at timestamptz not null default now(),
  -- ticking the same task twice on the same day is a no-op, not a duplicate
  constraint completions_unique_per_day unique (user_id, task_id, day)
);

create table if not exists public.day_notes (
  id         bigint generated always as identity primary key,
  user_id    bigint      not null references public.users(id) on delete cascade,
  day        date        not null,
  text       text        not null default '',
  updated_at timestamptz not null default now(),
  constraint day_notes_unique_per_day unique (user_id, day)
);

-- Upgrading a database made from an older copy of this file? Run
-- supabase/migration-02.sql instead, which adds the newer columns in place.

-- ---------------------------------------------------------------- indexes

-- the hot path: "give me every completion for this user" on each progress call
create index if not exists completions_user_day_idx
  on public.completions (user_id, day);

-- the task list is always filtered to the live ones and read in display order
create index if not exists tasks_user_active_idx
  on public.tasks (user_id, sort)
  where archived = false;

create index if not exists day_notes_user_day_idx
  on public.day_notes (user_id, day);

-- the board query: every member of one group, in join order
create index if not exists users_group_idx
  on public.users (group_id, id);

-- Sign-in looks an account up by name across the whole table, so it needs an
-- index it can actually use -- see migration-05 for why ILIKE could not.
create index if not exists users_name_lower_idx
  on public.users (name_lower);

-- Names only need to be unique among people who can see each other, and the
-- app compares them case-insensitively, so the index has to as well.
create unique index if not exists users_group_name_lower_key
  on public.users (group_id, name_lower);

-- ---------------------------------------------------------------- triggers

-- Every new player starts with the seven official rules. Doing this in a
-- trigger rather than in the API means the invariant holds even if you insert
-- a user by hand from the Supabase table editor.
create or replace function public.seed_core_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tasks (user_id, title, emoji, is_core, sort) values
    (new.id, 'Two 45-min workouts',        '🏋', true, 0),
    (new.id, 'One workout outdoors',       '🌳', true, 1),
    (new.id, 'Follow the diet, no cheats', '🥗', true, 2),
    (new.id, 'No alcohol',                 '🚫', true, 3),
    (new.id, '1 gallon of water',          '💧', true, 4),
    (new.id, 'Read 10 pages',              '📖', true, 5),
    (new.id, 'Progress photo',             '📸', true, 6);
  return new;
end;
$$;

drop trigger if exists seed_core_tasks_on_user on public.users;
create trigger seed_core_tasks_on_user
  after insert on public.users
  for each row execute function public.seed_core_tasks();

-- keep day_notes.updated_at honest
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_day_notes on public.day_notes;
create trigger touch_day_notes
  before update on public.day_notes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- rls

alter table public.groups      enable row level security;
alter table public.users       enable row level security;
alter table public.tasks       enable row level security;
alter table public.completions enable row level security;
alter table public.day_notes   enable row level security;

-- No policies are created on purpose -- see the note at the top of the file.
-- With RLS enabled and zero policies, anon and authenticated roles are denied
-- everything; only the service-role key (server-side) can touch these tables.

-- ---------------------------------------------------------------- sanity

-- Handy checks after running the file:
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
--   select * from public.users;

-- Backs the /session/suggest lookup (most recent user from an address).
create index if not exists users_last_ip_idx
  on public.users (last_ip, last_seen_at desc);

-- Backs the global Forest Dash leaderboard.
create index if not exists users_dash_coins_idx
  on public.users (dash_best_coins desc);
