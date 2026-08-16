# 75 Hard

A shared daily tracker for two (or four) people doing the 75 Hard challenge.
Express + Supabase behind a Vite/React PWA, deployed on Vercel and installable
to a phone home screen without an app store.

```
src/          Vite + React + TypeScript UI
server/       Express app, streak engine, data layer
api/index.js  Vercel serverless entry -- exports the same Express app
supabase/     schema.sql -- run this once in the SQL editor
tests/        26 assertions, no database required
scripts/      dev runner, Supabase health check, icon generator
```

## Get it running locally

```bash
npm install
npm run dev          # API on :3001, UI on :5173 -- open localhost:5173
```

With no Supabase credentials configured this uses an **in-memory store**, so
the app works offline and starts empty every time. That is also what the tests
run against. Point it at a real database by creating `.env.local`:

```bash
cp .env.example .env.local   # then paste your secret key in
npm run check                # verifies tables, trigger and constraints
npm run dev
```

Other commands:

| | |
|---|---|
| `npm test` | 26 assertions -- streak maths and every API route |
| `npm run build` | typecheck, bundle, generate the service worker |
| `npm run preview` | serve the built bundle, service worker and all |
| `npm run check` | verify a Supabase project is set up correctly |

`npm run dev` works the same on Windows, macOS and Linux -- it's a Node script,
not a shell script.

## Setting up Supabase

1. Open your project's **SQL editor** and run all of `supabase/schema.sql`.
   It is idempotent, so re-running it is safe.
2. Grab **Project Settings → API keys → `secret`** (older projects call this
   `service_role`). This is not the publishable/anon key.
3. Put it in `.env.local` locally, and in the Vercel env vars for production.
4. `npm run check` to confirm.

### Why the server uses the secret key

The schema turns RLS **on with no policies**, so the publishable key that ships
in a browser bundle cannot read or write anything. All access goes through the
Express API, which holds the secret key server-side and bypasses RLS. Since
there are no end-user logins, this is what stops anyone who views source from
reading your data.

Never expose the secret key to the client — anything named `VITE_*` gets baked
into the browser bundle, which is why neither Supabase variable has that prefix.

### What the schema creates

`users`, `tasks`, `completions`, `day_notes` — plus:

- `completions` is unique on `(user_id, task_id, day)`, so ticking the same box
  twice is a no-op rather than a duplicate.
- A `seed_core_tasks` trigger gives every new user the seven official rules, so
  the invariant holds even if you add a user from the table editor by hand.
- `on delete cascade` everywhere, so removing a user cleans up after itself.
- Indexes on the two hot paths: all completions for a user, and a user's live
  task list in display order.

## Deploying to Vercel

```bash
npx vercel        # first deploy, links the project
npx vercel --prod
```

Or import the repo at vercel.com. Add two environment variables in the project
settings before the first production deploy:

```
SUPABASE_URL         https://<your-project>.supabase.co
SUPABASE_SECRET_KEY  <the secret key>
```

`vercel.json` sends `/api/*` to the Express function and everything else to the
SPA. The function guards against a missing config: if the env vars aren't set
in a Vercel environment it fails loudly at startup rather than silently falling
back to the in-memory store and losing your data.

## Installing it on a phone

It's a PWA, so there is no APK and no app store.

- **Android/Chrome** — an "Add to home screen" button appears in the app, or
  use the browser menu.
- **iOS/Safari** — Share → Add to Home Screen. (iOS never fires the install
  event, so the in-app button won't show there.)

Once installed it opens without browser chrome, keeps its own icon, and the
status bar colour follows the theme. Requires HTTPS, which Vercel gives you.

The service worker precaches the shell so the app opens instantly and still
loads with a bad connection, but API calls are deliberately `NetworkOnly` — a
stale streak is worse than a spinner. New deploys are picked up on next launch.

## How the streak system works

**Core vs bonus.** The seven official rules are *core* tasks: miss any one and
the day is a failure. Anything you add yourself is a *bonus* habit — it earns
XP but can never kill your run.

**Failing.** 75 Hard has no cheat days. Any past day with an unticked core task
ends the run, and the next day becomes day 1 again. Detected automatically;
there's also a manual **Reset my run** button.

**Nothing is stored, everything is derived.** Streaks, resets, XP and levels are
recomputed from the completion rows on every request. So if you forget to tick
off yesterday and do it the next morning, your run *heals* instead of staying
broken — and a stored counter can't drift away from the actual ticks.

**XP** is never lost when a streak dies; losing the streak is the punishment.

| | |
|---|---|
| each task ticked | 10 XP |
| a perfect day | +40 XP |
| reaching a milestone day | +5 × the day number |

Seven levels, Rookie → Legend; a clean 75 days lands on Legend at ~9,500 XP.

**Trophies** at days 3, 7, 14, 21, 30, 50, 60 and 75, unlocked off your *best
ever* streak — a reset never takes one back.

**Timezones.** Vercel runs in UTC, so the browser sends its own local date with
anything that depends on what day it is. Two people in different timezones roll
over to a new day at their own midnight.

## Themes

Four, switchable from the top bar and remembered in `localStorage`: **Dark**,
**Light**, **Terminal** (green phosphor CRT, mono type, scanlines) and **Retro**
(cream stock, hard ink outlines, offset shadows).

Themes are pure token swaps on `[data-theme]` at the top of `styles.css` — no
component knows which is active. `--u` is the player's colour, `--accent` is
what the UI paints with; they're normally the same, but Terminal overrides
`--accent` to phosphor green while avatars keep their per-player tint. Adding a
fifth theme is one token block and zero TSX changes.

## API

| | |
|---|---|
| `GET /api/board` | everyone's progress — the head-to-head view |
| `GET /api/users/:id/progress` | streak, XP, badges, calendar |
| `GET /api/users/:id/day/:date` | that day's tasks, what's pending, the note |
| `POST /api/users/:id/toggle` | tick/untick `{task_id, day, done}` |
| `PUT /api/users/:id/note` | save the "still pending" note |
| `POST`/`DELETE /api/users/:id/tasks` | add or archive a bonus habit |
| `POST /api/users/:id/restart` | back to day 1 today |

## Worth knowing

There are no passwords — you pick a name from the top bar and that's who you
are. Fine for a private tracker shared between friends; anyone with the URL can
tick anyone's boxes. Put it behind Vercel's password protection or add real auth
before sharing it widely.

Icons are generated by `python3 scripts/make_icons.py` (needs Pillow). Re-run it
if you change the mark.
