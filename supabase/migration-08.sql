-- =====================================================================
-- 75 Hard -- migration 08: names are unique across the whole app
--
-- Run after migration-07. The code side of this already shipped: POST /users
-- and POST /invite/:token/join now check every account, not just the ones on
-- the same board, and refuse a repeat with "that name is already taken".
--
-- Before this, a name only had to be unique within one board (see
-- users_group_name_lower_key in schema.sql) -- deliberately, so two strangers
-- on different boards could share a name without knowing it. Login already
-- resolves that by name + PIN together, and refuses outright if a name+PIN
-- pair is still ambiguous, so nothing was ever broken by it -- but it does
-- mean your existing data may already have the same name on more than one
-- board, and the app-level check alone cannot fix data that predates it.
--
-- This migration has three parts. Run them in order, and read the middle one
-- before running it -- it renames real people's accounts.
-- =====================================================================

-- ---------------------------------------------------------------- 1. look

-- Read-only. Run this first. If it returns no rows, skip straight to part 3.
select
  name_lower,
  count(*)                          as accounts,
  array_agg(id order by id)         as user_ids,
  array_agg(name order by id)       as names,
  array_agg(group_id order by id)   as group_ids
from public.users
group by name_lower
having count(*) > 1
order by count(*) desc;

-- ---------------------------------------------------------------- 2. fix

-- Only if the query above returned rows. Renames every duplicate EXCEPT the
-- oldest account (lowest id) per name, appending " 2", " 3", and so on --
-- "Alex" stays "Alex", the next "Alex" becomes "Alex 2". Nobody's progress,
-- board, PIN, or login id changes; only the `name` column does, and
-- `name_lower` regenerates from it automatically (it is a stored generated
-- column, not something to set by hand).
--
-- The real effect on a renamed person: they still open the app exactly as
-- before if their device already remembers them (the common case -- it signs
-- back in by id, not by typing a name). Only someone who signs OUT and then
-- types their OLD name back in on part 2 hits "no account matches" and needs
-- their new, suffixed name instead. If that matters for how few people the
-- query above shows, it may be worth messaging them directly and renaming by
-- hand instead of running this block.
--
-- with dupes as (
--   select id, name, row_number() over (partition by name_lower order by id) as rn
--   from public.users
-- )
-- update public.users u
-- set name = u.name || ' ' || d.rn
-- from dupes d
-- where u.id = d.id and d.rn > 1;

-- ---------------------------------------------------------------- 3. lock it in

-- Fails if any duplicate name_lower still exists -- confirms part 1 returned
-- nothing, or part 2 (or your own manual renames) actually cleared them. This
-- is what stops a NEW duplicate from ever landing again even outside the app
-- (a row inserted by hand from the Supabase table editor, for instance) --
-- the app-level check alone only covers requests that go through the API.
create unique index if not exists users_name_lower_key
  on public.users (name_lower);

-- ---------------------------------------------------------------- checks

--   select indexname from pg_indexes
--     where tablename = 'users' and indexname = 'users_name_lower_key';
