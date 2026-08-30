-- =====================================================================
-- 75 Hard -- migration 06: per-user timezone
--
-- Run after migration-05. Idempotent -- safe to run more than once.
--
-- Before this, every "what day is it" decision used whatever local date the
-- calling browser sent. That is wrong the moment one browser asks about
-- another user (the board, a share link): it judged everyone against the
-- viewer's midnight. Each user now stores an IANA zone (e.g. 'Asia/Kolkata'),
-- auto-detected from their device, and the server derives their current day
-- from it.
--
-- Starting from an empty project instead? Just run schema.sql, which already
-- includes this column.
-- =====================================================================

alter table public.users add column if not exists timezone text;

-- ---------------------------------------------------------------- checks

--   select id, name, timezone from public.users order by id;
