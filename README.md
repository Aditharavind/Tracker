# 75 Hard

A shared daily tracker for two (or four) people doing the 75 Hard challenge.
FastAPI + SQLite on the back, Vite + React + TypeScript on the front.

```
backend/    FastAPI app, SQLite, all the streak maths
frontend/   Vite + React UI
dev.sh      both servers with hot reload  -> localhost:5173
serve.sh    build once, serve everything from FastAPI -> localhost:8000
```

## Run it

```bash
cd backend && pip install -r requirements.txt   # once
./dev.sh                                        # then open localhost:5173
```

First load asks for a name and a colour, seeds the seven 75 Hard rules as your
daily list, and starts you on day 1. Use the `+` in the top right to add your
friend. Everyone shares one database, so you both see each other's progress.

To see what it looks like mid-challenge before committing to anything:

```bash
cd backend && python3 seed_demo.py --fresh    # two fake users, ~3 weeks of history
```

Delete `backend/data.db` whenever you want a clean slate.

Sanity checks for the streak logic live in `backend/test_engine.py`
(`cd backend && python3 test_engine.py`).

## How the streak system works

**Core vs bonus.** The seven official rules are *core* tasks: miss any one of
them and the day is a failure. Anything you add yourself is a *bonus* habit --
it earns XP but can never kill your run, so you can track extra goals without
raising the stakes.

**Failing.** 75 Hard has no cheat days. Any past day where a core task went
unticked ends the run, and the next day becomes day 1 again. The app detects
this on its own; there's also a manual **Reset my run** button.

**Nothing is stored, everything is derived.** Streaks, resets, XP and levels are
all recomputed from the checkboxes on every request. The useful consequence:
if you forget to tick off yesterday and do it the next morning, your run heals
itself instead of staying broken. The nasty version of this bug -- a stored
counter drifting away from the actual ticks -- can't happen.

**XP** (never lost, even when a streak dies -- the streak is the punishment):

| | |
|---|---|
| each task ticked | 10 XP |
| a perfect day | +40 XP |
| reaching a milestone day | +5 x the day number |

Seven levels from Rookie to Legend; a clean 75 days lands you at Legend with
roughly 9,500 XP.

**Trophies** at days 3, 7, 14, 21, 30, 50, 60 and 75. They unlock off your
*best ever* streak, so a reset never takes a trophy back from you.

**Head to head** ranks everyone by current streak, then XP, and shows how far
each person has got through today's list. The 75-square grid at the bottom is
your current run -- click any past square to go back and fix that day.

## API

| | |
|---|---|
| `GET /api/board` | everyone's full progress -- the head-to-head view |
| `GET /api/users/{id}/progress` | one person's streak, XP, badges, calendar |
| `GET /api/users/{id}/day/{date}` | that day's tasks, what's pending, the note |
| `POST /api/users/{id}/toggle` | tick/untick `{task_id, day, done}` |
| `PUT /api/users/{id}/note` | save the "what's still pending" note |
| `POST/DELETE /api/users/{id}/tasks` | add or archive a bonus habit |
| `POST /api/users/{id}/restart` | back to day 1 today |

Interactive docs at `localhost:8000/docs` while the server is running.

## Worth knowing

There are no passwords -- you pick a name from the top bar and that's who you
are. Fine for two friends on a home network or a private box; put it behind a
reverse proxy with basic auth before exposing it to the internet.

Days use the *browser's* local date, so if you and your friend are in different
timezones you'll roll over to a new day at different moments.
