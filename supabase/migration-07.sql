-- =====================================================================
-- 75 Hard -- migration 07: Forest Dash minigame scores
--
-- Run after migration-06. Idempotent -- safe to run more than once.
--
-- The optional "Forest Dash" minigame keeps a global leaderboard ranked by
-- coins collected in a single run. These two columns hold each user's personal
-- best; nothing here touches the 75-day challenge state.
--
-- Starting from an empty project instead? Just run schema.sql.
-- =====================================================================

alter table public.users add column if not exists dash_best_coins int not null default 0;
alter table public.users add column if not exists dash_best_dist  int not null default 0;

create index if not exists users_dash_coins_idx
  on public.users (dash_best_coins desc);

-- ---------------------------------------------------------------- checks

--   select name, dash_best_coins, dash_best_dist
--     from public.users order by dash_best_coins desc limit 20;
