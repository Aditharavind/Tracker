-- =====================================================================
-- 75 Hard -- migration 05: make sign-in scale, and enforce the name rule
--            the application has always actually applied
--
-- Run after migration-04. Idempotent apart from the unique index, which is
-- called out below because it can legitimately fail on existing data.
--
-- Starting from an empty project? Just run schema.sql, which includes all
-- of this.
-- =====================================================================

-- ------------------------------------------------- indexed name lookup

-- POST /login searches by name across every user. The query was ILIKE, which
-- no btree index can serve, so each sign-in attempt sequentially scanned the
-- whole users table -- fine at a hundred users, not at a hundred thousand.
--
-- A stored generated column gives PostgREST something it can match on with a
-- plain equality filter, which the index below then answers directly.
alter table public.users
  add column if not exists name_lower text
  generated always as (lower(name)) stored;

create index if not exists users_name_lower_idx
  on public.users (name_lower);

-- ------------------------------------------------- case-insensitive names

-- The app has always compared names case-insensitively (ILIKE on the server,
-- toLowerCase in the in-memory store), but the uniqueness constraint was
-- case-SENSITIVE. So "Adith" and "adith" could both exist on one board: the
-- application check rejected the second signup, the database would have
-- allowed it, and two concurrent signups could slip past the check entirely
-- and both land. This closes that.
--
-- If this fails with a uniqueness violation, the board already contains names
-- that differ only by case. Find them with:
--
--   select group_id, lower(name) as clash, count(*), array_agg(name)
--     from public.users
--    group by group_id, lower(name)
--   having count(*) > 1;
--
-- Rename the duplicates, then re-run.
create unique index if not exists users_group_name_lower_key
  on public.users (group_id, name_lower);

-- Superseded by the case-insensitive index above.
drop index if exists public.users_group_name_key;

-- ---------------------------------------------------------------- checks

--   explain analyze select * from public.users where name_lower = 'adith';
--     -> expect an Index Scan on users_name_lower_idx, not a Seq Scan
