-- =====================================================================
-- 75 Hard -- migration 10: last-seen coarse geo
--
-- Run after migration-09. Stores the coarse location headers provided by the
-- hosting edge (Vercel/Cloudflare) when a signed-in user's board loads. The
-- admin panel uses these for region/place graphs. IP addresses remain server-
-- side only and are not returned by the admin API.
--
-- Paste this into the Supabase SQL editor and run it once. Idempotent --
-- safe to re-run.
-- =====================================================================

alter table public.users add column if not exists last_country text;
alter table public.users add column if not exists last_region  text;
alter table public.users add column if not exists last_city    text;

create index if not exists users_last_geo_idx
  on public.users (last_country, last_region, last_city);
