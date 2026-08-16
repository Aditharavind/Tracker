-- =====================================================================
-- 75 Hard -- migration 03: names unique per board, not globally
--
-- users.name was globally unique, so the second "Rahul" to ever sign up was
-- rejected even on a completely separate board. Names only need to be
-- unique among people who can actually see each other.
-- =====================================================================

alter table public.users drop constraint if exists users_name_key;

create unique index if not exists users_group_name_key
  on public.users (group_id, name);

--   select group_id, name from public.users order by group_id, name;
