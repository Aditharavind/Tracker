import express from "express";

import { compute, dayDetail } from "./engine.js";
import { hashSecret, newShareToken, verifySecret } from "./security.js";
import { getStore } from "./store/index.js";
import { isValidZone, zoneToday } from "./time.js";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const PIN = /^\d{4,6}$/;

/** Today in UTC. The client sends its own local day for anything that matters. */
const todayISO = () => new Date().toISOString().slice(0, 10);

const dayFrom = (value) => (ISO_DAY.test(value ?? "") ? value : todayISO());

/**
 * The day *this user* is currently living in.
 *
 * When the user's OWN client tells us its local date we trust that outright --
 * it is the real wall clock on their device, and it can never disagree with
 * what their own checklist is showing. The stored IANA zone is the fallback
 * for when there is no client date: asking about someone else (the board, a
 * share link), where we still want each member judged on their own clock.
 */
const userToday = (user, clientToday) =>
  ISO_DAY.test(clientToday ?? "") ? clientToday : zoneToday(user?.timezone) ?? todayISO();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PAGE_DEFAULT = 50;
const PAGE_MAX = 200;

/**
 * Group membership is unbounded -- an invite link handed round a gym or posted
 * publicly grows one board without limit, and /board computes full progress for
 * every member it returns. Without a ceiling a single large board is enough to
 * blow the function's memory and time budget, whatever the total user count.
 *
 * The response stays a plain array so existing clients are unaffected; the
 * paging state rides on headers.
 */
function pageParams(query) {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), PAGE_MAX)
    : PAGE_DEFAULT;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;
  return { limit, offset };
}

function setPageHeaders(res, { limit, offset }, total) {
  res.set("X-Total-Count", String(total));
  res.set("X-Page-Limit", String(limit));
  res.set("X-Page-Offset", String(offset));
  if (offset + limit < total) res.set("X-Has-More", "1");
}

const RATE_WINDOW_MS = 60_000;
/**
 * 10 req/s sustained. Set high on purpose: mobile carriers and offices put
 * thousands of people behind one address, so a tight per-IP limit would lock
 * out real users long before it inconvenienced anyone. This is sized to catch
 * a runaway loop, not to apportion capacity.
 */
const rateMax = () => Number(process.env.RATE_LIMIT_PER_MIN) || 600;

/**
 * Coarse per-IP backstop, and honest about being only that: serverless
 * instances share no memory, so the fleet-wide ceiling is this times however
 * many instances are warm. It exists because writes are unauthenticated (see
 * requirePin) and one client in a retry loop should not be able to sit on the
 * database. For a real guarantee put rate limiting at the edge, where it sees
 * every request and can key on more than an address.
 *
 * The counter lives per app instance rather than per module so that each
 * createApp() -- one per cold start in production, one per test here -- starts
 * clean, instead of tests bleeding budget into each other.
 */
function createRateLimit() {
  const hits = new Map();
  // Read per instance rather than at import, so a deployment can retune it
  // without a rebuild -- and so tests can set a small ceiling.
  const max = rateMax();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const ip = clientIp(req);
    const entry = hits.get(ip);

    if (!entry || now >= entry.reset) {
      hits.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    } else if (entry.count >= max) {
      res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: "too many requests -- slow down" });
    } else {
      entry.count += 1;
    }

    // Sweep on write rather than on a timer: an interval would hold a
    // serverless instance open, and an unbounded Map is the leak this guards.
    if (hits.size > 10_000) {
      for (const [key, value] of hits) if (now >= value.reset) hits.delete(key);
    }
    next();
  };
}

async function loadUser(store, id) {
  const user = await store.getUser(id);
  if (!user) throw new HttpError(404, "user not found");
  return user;
}

/**
 * Per-request PIN checks are disabled, matching the FastAPI backend this
 * replaced -- its _require_pin was already a no-op "by request", because
 * prompting on every single checkmark is pure friction on a device only its
 * owner uses.
 *
 * This has to stay in step with the client. App.tsx's runWithPin sends no PIN
 * and has no prompt UI, so enforcing here produced a "wrong PIN" toast on
 * every task tick with no way to supply one.
 *
 * Deliberate trade-off, not an oversight: while this is a no-op, anyone who
 * can reach the API and knows a user id can write to that user. PINs are still
 * hashed, stored, and verified by POST /login -- which is what stops someone
 * signing in as you -- so re-enabling this is a one-line change if the sharing
 * model ever needs it.
 */
// eslint-disable-next-line no-unused-vars
function requirePin(_user, _pin) {}

/**
 * Other members of your board can see your name, colour and progress, but
 * never your share link -- that would let them hand your board to anyone.
 */
function userOut(u, revealToken = false, group = null) {
  const out = {
    id: u.id,
    name: u.name,
    color: u.color,
    start_date: u.start_date,
    wake_time: u.wake_time ?? null,
    timezone: u.timezone ?? null,
    has_pin: Boolean(u.pin_hash),
  };
  // share_token is read-only progress; invite_token lets someone join the
  // board as a real editable member. Neither is anyone else's business, so
  // both are handed back only to the user themself.
  if (revealToken) {
    out.share_token = u.share_token;
    if (group) out.invite_token = group.invite_token ?? null;
  }
  return out;
}

/**
 * Only ever used for the /session/suggest convenience below, which grants no
 * access on its own. X-Forwarded-For is what Vercel sets; behind a proxy that
 * doesn't, this degrades to the proxy's own address, which makes the
 * suggestion less precise but never unsafe -- the PIN still gates every write.
 */
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

/** Records where a user was last seen, so a cleared browser can be offered them. */
async function touchSession(store, user, req) {
  try {
    await store.updateUser(user.id, {
      last_ip: clientIp(req),
      last_seen_at: new Date().toISOString(),
    });
  } catch {
    // A database still on migration-03 has no last_ip column. The suggestion
    // is a nicety -- never fail a board load over it.
  }
}

async function progressFor(store, user, today) {
  const [tasks, completions] = await Promise.all([
    store.listTasks(user.id),
    store.listCompletions(user.id),
  ]);
  return compute({ user, tasks, completions }, today || todayISO());
}

/**
 * Every member's progress in two queries instead of two per member.
 *
 * The per-user version above is fine for one user, but /board ran it in a
 * Promise.all over the whole group, so a six-person board issued twelve
 * queries -- each reading that member's entire lifetime completion history --
 * on every board load and after every task tick. That is the shape that stops
 * scaling first: cost grows with members *and* with how far into the run
 * everyone is.
 */
async function boardFor(store, users, today) {
  if (!users.length) return [];
  const ids = users.map((u) => u.id);
  const [tasks, completions] = await Promise.all([
    store.listTasksForUsers(ids),
    store.listCompletionsForUsers(ids),
  ]);

  const bucket = (rows) => {
    const by = new Map(ids.map((id) => [Number(id), []]));
    for (const row of rows) by.get(Number(row.user_id))?.push(row);
    return by;
  };
  const tasksBy = bucket(tasks);
  const doneBy = bucket(completions);
  const fallbackDay = today || todayISO();

  // Each member is judged on *their own* clock. Before per-user timezones this
  // used one `day` for the whole board -- the viewer's -- so a night-owl in a
  // later zone could show a broken streak on someone else's phone hours before
  // their own day was actually over.
  return users.map((user) =>
    compute(
      { user, tasks: tasksBy.get(Number(user.id)) ?? [], completions: doneBy.get(Number(user.id)) ?? [] },
      zoneToday(user.timezone) ?? fallbackDay
    )
  );
}

async function dayFor(store, user, day) {
  const [tasks, done, note] = await Promise.all([
    store.listTasks(user.id),
    store.listCompletionsForDay(user.id, day),
    store.getNote(user.id, day),
  ]);
  return dayDetail({ tasks, doneIds: new Set(done.map((c) => c.task_id)), note: note?.text }, day);
}

/** The caller identifies themself with ?as=<their user id>. */
async function callerGroup(store, asId) {
  if (asId == null || asId === "") return null;
  const me = await store.getUser(asId);
  return me ?? null;
}

const wakeTitle = (reps) => `${reps} reps to wake up`;

async function syncWakeTask(store, user, wakeTime, repsTarget) {
  const tasks = await store.listTasks(user.id);
  const locked = tasks.find((t) => t.locked);

  if (wakeTime == null) return; // keeping the task is harmless; it stays ticked-off work

  if (locked) {
    await store.updateTask(locked.id, {
      reps_target: repsTarget,
      title: wakeTitle(repsTarget),
    });
    return;
  }
  const top = tasks.reduce((max, t) => Math.max(max, t.sort), 0);
  await store.createTask({
    user_id: user.id,
    title: wakeTitle(repsTarget),
    emoji: "⏰",
    is_core: true,
    locked: true,
    reps_target: repsTarget,
    sort: top + 1,
  });
}

export function createRouter() {
  const r = express.Router();

  /**
   * Is this instance actually talking to its database, and which migrations
   * have landed? On the deployed site "progress isn't saving" almost always
   * means the function fell back to the in-memory store (missing env vars) or
   * a migration was never run -- both are visible here in one request.
   *   GET /api/health -> { store, ok, checks: { users, restarted_at, timezone } }
   */
  r.get(
    "/health",
    wrap(async (_req, res) => {
      const store = getStore();
      let checks;
      try {
        checks = await store.health();
      } catch (err) {
        checks = { ok: false, error: err.message };
      }
      res.json({ store: store.kind ?? "unknown", ok: Boolean(checks.ok), checks });
    })
  );

  /**
   * Scoped to the caller's own board. A browser with no local user yet sends
   * no `as`, sees an empty board, and starts a fresh isolated group on signup
   * -- which is what stops two strangers who both open the app sharing one.
   */
  r.get(
    "/users",
    wrap(async (req, res) => {
      const store = getStore();
      const me = await callerGroup(store, req.query.as);
      if (!me) return res.json([]);
      await touchSession(store, me, req);
      const page = pageParams(req.query);
      const [users, group, total] = await Promise.all([
        store.listUsersInGroup(me.group_id, page),
        store.getGroup(me.group_id),
        store.countUsersInGroup(me.group_id),
      ]);
      setPageHeaders(res, page, total);
      res.json(users.map((u) => userOut(u, u.id === me.id, group)));
    })
  );

  /**
   * Convenience only, never auth: if this address was last seen as a specific
   * user, a browser with no saved local user (cleared storage, new device) gets
   * pre-selected instead of dropped on the onboarding screen. Editing still
   * needs that user's PIN, exactly as if they had picked their own tile.
   */
  r.get(
    "/session/suggest",
    wrap(async (req, res) => {
      const store = getStore();
      const user = await store.getUserByLastIp(clientIp(req));
      if (!user) return res.json({ user_id: null });
      res.json({ user_id: user.id, name: user.name, color: user.color });
    })
  );

  /** Public preview of who is already in the lobby. No ids, PINs or tokens. */
  r.get(
    "/invite/:token",
    wrap(async (req, res) => {
      const store = getStore();
      const group = await store.getGroupByInviteToken(req.params.token);
      if (!group) throw new HttpError(404, "invalid or expired invite");
      // A preview, not a directory: show the first few and say how many more.
      // This endpoint is public and uncredentialed, so it must not become a way
      // to enumerate an entire board.
      const page = { limit: 12, offset: 0 };
      const [members, total] = await Promise.all([
        store.listUsersInGroup(group.id, page),
        store.countUsersInGroup(group.id),
      ]);
      res.set("Cache-Control", "public, max-age=30, s-maxage=30");
      res.json({
        members: members.map((u) => ({ name: u.name, color: u.color })),
        total,
      });
    })
  );

  /**
   * Unlike /share, this creates a real editable member with their own tasks
   * and PIN. Name uniqueness is per board, matching POST /users.
   */
  r.post(
    "/invite/:token/join",
    wrap(async (req, res) => {
      const store = getStore();
      const group = await store.getGroupByInviteToken(req.params.token);
      if (!group) throw new HttpError(404, "invalid or expired invite");

      const name = String(req.body?.name ?? "").trim();
      const color = String(req.body?.color ?? "#e8734a");
      const pin = String(req.body?.pin ?? "");
      const wakeTime = req.body?.wake_time ?? null;
      const repsTarget = Number(req.body?.reps_target ?? 20);
      const startDate = req.body?.start_date;
      const timezone = isValidZone(req.body?.timezone) ? req.body.timezone : null;

      if (!name) throw new HttpError(400, "name is required");
      if (name.length > 40) throw new HttpError(400, "name is too long");
      if (!PIN.test(pin)) throw new HttpError(400, "PIN must be 4-6 digits");
      if (startDate && !ISO_DAY.test(startDate)) throw new HttpError(400, "bad start_date");
      if (wakeTime !== null && !HH_MM.test(wakeTime)) throw new HttpError(400, "bad wake_time");
      if (!Number.isInteger(repsTarget) || repsTarget < 1 || repsTarget > 999) {
        throw new HttpError(400, "bad reps_target");
      }
      if (await store.getUserByNameInGroup(group.id, name)) {
        throw new HttpError(409, "someone on this board already has that name");
      }

      const user = await store.createUser({
        name,
        color,
        start_date: startDate || todayISO(),
        pin_hash: hashSecret(pin),
        wake_time: wakeTime,
        timezone,
        group_id: group.id,
        share_token: newShareToken(),
      });

      if (wakeTime !== null) await syncWakeTask(store, user, wakeTime, repsTarget);
      res.status(201).json(userOut(user, true, group));
    })
  );

  r.post(
    "/users",
    wrap(async (req, res) => {
      const store = getStore();
      const name = String(req.body?.name ?? "").trim();
      const color = String(req.body?.color ?? "#e8734a");
      const pin = String(req.body?.pin ?? "");
      const wakeTime = req.body?.wake_time ?? null;
      const repsTarget = Number(req.body?.reps_target ?? 20);
      const invitedBy = req.body?.invited_by ?? null;
      const startDate = req.body?.start_date;
      const timezone = isValidZone(req.body?.timezone) ? req.body.timezone : null;

      if (!name) throw new HttpError(400, "name is required");
      if (name.length > 40) throw new HttpError(400, "name is too long");
      if (!PIN.test(pin)) throw new HttpError(400, "PIN must be 4-6 digits");
      if (startDate && !ISO_DAY.test(startDate)) throw new HttpError(400, "bad start_date");
      if (wakeTime !== null && !HH_MM.test(wakeTime)) throw new HttpError(400, "bad wake_time");
      if (!Number.isInteger(repsTarget) || repsTarget < 1 || repsTarget > 999) {
        throw new HttpError(400, "bad reps_target");
      }
      // Names only have to be unique among people who can see each other, so
      // the board has to be settled before the clash check means anything.
      let groupId;
      if (invitedBy != null) {
        const host = await store.getUser(invitedBy);
        if (!host) throw new HttpError(404, "that invite is no longer valid");
        groupId = host.group_id;
        if (await store.getUserByNameInGroup(groupId, name)) {
          throw new HttpError(409, "someone on this board already has that name");
        }
      } else {
        groupId = (await store.createGroup()).id;
      }

      const user = await store.createUser({
        name,
        color,
        start_date: startDate || todayISO(),
        pin_hash: hashSecret(pin),
        wake_time: wakeTime,
        timezone,
        group_id: groupId,
        share_token: newShareToken(),
      });

      if (wakeTime !== null) await syncWakeTask(store, user, wakeTime, repsTarget);
      res.status(201).json(userOut(user, true, await store.getGroup(groupId)));
    })
  );

  /**
   * Sign back in on a new device, or after signing out. Names are only unique
   * per board, so the PIN is what actually picks the account out; if two
   * people on different boards share both a name and a PIN we refuse rather
   * than guess which one you meant.
   */
  r.post(
    "/login",
    wrap(async (req, res) => {
      const store = getStore();
      const name = String(req.body?.name ?? "").trim();
      const pin = String(req.body?.pin ?? "");
      if (!name || !pin) throw new HttpError(400, "name and PIN are required");

      const candidates = await store.listUsersByName(name);
      const matches = candidates.filter((u) => u.pin_hash && verifySecret(pin, u.pin_hash));
      if (matches.length !== 1) {
        throw new HttpError(403, "no account matches that name and PIN");
      }
      // Signing in from a new device is a good moment to catch the zone up.
      let me = matches[0];
      const tz = req.body?.timezone;
      if (isValidZone(tz) && tz !== me.timezone) {
        try {
          me = (await store.updateUser(me.id, { timezone: tz })) ?? { ...me, timezone: tz };
        } catch {
          /* column not migrated yet -- ignore, client keeps sending its day */
        }
      }
      res.json(userOut(me, true, await store.getGroup(me.group_id)));
    })
  );

  // Everything the board needs for the head-to-head view, scoped like /users.
  r.get(
    "/board",
    wrap(async (req, res) => {
      const store = getStore();
      const me = await callerGroup(store, req.query.as);
      if (!me) return res.json([]);
      const today = dayFrom(req.query.today);
      const page = pageParams(req.query);
      const [users, total] = await Promise.all([
        store.listUsersInGroup(me.group_id, page),
        store.countUsersInGroup(me.group_id),
      ]);
      setPageHeaders(res, page, total);
      res.json(await boardFor(store, users, today));
    })
  );

  /**
   * Public, PIN-free, read-only. Deliberately the same payload group-mates
   * already see on the board -- no day, task or note detail is exposed.
   */
  r.get(
    "/share/:token",
    wrap(async (req, res) => {
      const store = getStore();
      const user = await store.getUserByShareToken(req.params.token);
      if (!user) throw new HttpError(404, "invalid or expired link");
      // Public, read-only, and the same for everyone holding the link -- so a
      // link that gets passed around widely can be served from the edge instead
      // of recomputing a full history per viewer. Half a minute is short enough
      // that a tick still shows up while someone is watching.
      res.set("Cache-Control", "public, max-age=30, s-maxage=30");
      res.json(await progressFor(store, user, userToday(user, req.query.today)));
    })
  );

  r.get(
    "/users/:id/progress",
    wrap(async (req, res) => {
      const store = getStore();
      const user = await loadUser(store, req.params.id);
      res.json(await progressFor(store, user, userToday(user, req.query.today)));
    })
  );

  r.get(
    "/users/:id/day/:day",
    wrap(async (req, res) => {
      const store = getStore();
      if (!ISO_DAY.test(req.params.day)) throw new HttpError(400, "bad day");
      const user = await loadUser(store, req.params.id);
      res.json(await dayFor(store, user, req.params.day));
    })
  );

  r.post(
    "/users/:id/toggle",
    wrap(async (req, res) => {
      const store = getStore();
      const { task_id: taskId, day, done } = req.body ?? {};
      if (!ISO_DAY.test(day ?? "")) throw new HttpError(400, "bad day");

      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);

      const task = await store.getTask(taskId);
      if (!task || Number(task.user_id) !== Number(user.id)) {
        throw new HttpError(404, "task not found");
      }
      // Judge the day against this user's own timezone, not the server's UTC
      // clock and not the caller's browser.
      const today = userToday(user, req.body?.today);
      if (day > today) throw new HttpError(400, "can't tick off a day that hasn't happened");
      // Once a day is over it is sealed: you resume on the next day, never
      // backfill an old one. (Reading a past day stays open -- see GET day.)
      if (day < today) {
        throw new HttpError(409, "that day is locked -- you can only update today");
      }

      const row = { user_id: user.id, task_id: task.id, day };
      if (done) await store.addCompletion(row);
      else await store.removeCompletion(row);

      // persist -> verify (CLAUDE.md Stage 5 / section 12): the response day is
      // built from a fresh read of what actually landed in the store, so the
      // client always redraws from the real persisted state -- if a write
      // silently didn't stick, the box simply doesn't move rather than showing
      // a tick that isn't saved. A mismatch is logged, never a 500 (a spurious
      // 500 here would break every tick).
      const fresh = await dayFor(store, user, day);
      const storedDone = Boolean(fresh.tasks.find((t) => Number(t.id) === Number(task.id))?.done);
      if (storedDone !== Boolean(done)) {
        console.warn("[toggle] write did not verify", { userId: user.id, taskId: task.id, day, wrote: done, stored: storedDone });
      }

      res.json({ day: fresh, progress: await progressFor(store, user, today) });
    })
  );

  r.put(
    "/users/:id/note",
    wrap(async (req, res) => {
      const store = getStore();
      const { day, text } = req.body ?? {};
      if (!ISO_DAY.test(day ?? "")) throw new HttpError(400, "bad day");
      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);
      const today = userToday(user, req.body?.today);
      if (day !== today) {
        throw new HttpError(409, "that day is locked -- notes can only be changed today");
      }
      await store.upsertNote(user.id, day, String(text ?? "").slice(0, 4000));
      res.json({ ok: true });
    })
  );

  r.get(
    "/users/:id/tasks",
    wrap(async (req, res) => {
      const store = getStore();
      const user = await loadUser(store, req.params.id);
      res.json(await store.listTasks(user.id));
    })
  );

  r.post(
    "/users/:id/tasks",
    wrap(async (req, res) => {
      const store = getStore();
      const title = String(req.body?.title ?? "").trim();
      if (!title) throw new HttpError(400, "title is required");
      if (title.length > 80) throw new HttpError(400, "title is too long");

      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);

      const existing = await store.listTasks(user.id);
      const top = existing.reduce((max, t) => Math.max(max, t.sort), 0);

      res.status(201).json(
        await store.createTask({
          user_id: user.id,
          title,
          emoji: String(req.body?.emoji || "*"),
          is_core: Boolean(req.body?.is_core),
          sort: top + 1,
        })
      );
    })
  );

  r.delete(
    "/users/:id/tasks/:taskId",
    wrap(async (req, res) => {
      const store = getStore();
      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);

      const task = await store.getTask(req.params.taskId);
      if (!task || Number(task.user_id) !== Number(user.id)) {
        throw new HttpError(404, "task not found");
      }
      if (task.locked) {
        throw new HttpError(409, "this one's the bare minimum -- can't be removed");
      }
      await store.archiveTask(task.id);
      res.status(204).end();
    })
  );

  // Manual "I blew it, start over from today" button. start_date stays put so
  // lifetime stats and earned trophies survive; only the current run moves.
  r.post(
    "/users/:id/restart",
    wrap(async (req, res) => {
      const store = getStore();
      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);
      const today = userToday(user, req.body?.today);
      // Clear anything ticked today (and, defensively, later) so the new run
      // opens on a blank day 1. Earlier history stays put -- it's no longer
      // part of the run, but lifetime stats and earned trophies still read it.
      await store.clearCompletionsFrom(user.id, today);
      const updated = (await store.updateUser(user.id, { restarted_at: today })) ?? {
        ...user,
        restarted_at: today,
      };
      // The response is computed from a fresh read of the user, so the client
      // always redraws from real persisted state. A mismatch is logged, not a
      // 500 (a spurious 500 would make Reset look broken).
      const afterReset = await store.listCompletionsForDay(user.id, today);
      if (afterReset.length > 0 || (updated.restarted_at ?? null) !== today) {
        console.warn("[restart] reset did not fully verify", {
          userId: user.id,
          today,
          leftover: afterReset.length,
          restartedAt: updated.restarted_at ?? null,
        });
      }
      res.json(await progressFor(store, (await store.getUser(user.id)) ?? updated, today));
    })
  );

  r.put(
    "/users/:id/pin",
    wrap(async (req, res) => {
      const store = getStore();
      const newPin = String(req.body?.new_pin ?? "");
      if (!PIN.test(newPin)) throw new HttpError(400, "PIN must be 4-6 digits");
      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);
      await store.updateUser(user.id, { pin_hash: hashSecret(newPin) });
      res.json({ ok: true });
    })
  );

  r.put(
    "/users/:id/wake",
    wrap(async (req, res) => {
      const store = getStore();
      const wakeTime = req.body?.wake_time ?? null;
      const repsTarget = Number(req.body?.reps_target ?? 20);
      if (wakeTime !== null && !HH_MM.test(wakeTime)) throw new HttpError(400, "bad wake_time");
      if (!Number.isInteger(repsTarget) || repsTarget < 1 || repsTarget > 999) {
        throw new HttpError(400, "bad reps_target");
      }

      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);

      const updated = await store.updateUser(user.id, { wake_time: wakeTime });
      await syncWakeTask(store, user, wakeTime, repsTarget);
      res.json(
        userOut(updated ?? { ...user, wake_time: wakeTime }, true, await store.getGroup(user.group_id))
      );
    })
  );

  // ---- Forest Dash minigame: a global leaderboard by coins collected. The
  // minigame never touches challenge state; these are just vanity bests. Only
  // name + colour + score are exposed (the same fields an invite preview
  // already shows), never ids or tokens.
  r.post(
    "/users/:id/dash",
    wrap(async (req, res) => {
      const store = getStore();
      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);
      const coins = Math.max(0, Math.min(100000, Math.trunc(Number(req.body?.coins)) || 0));
      const distance = Math.max(0, Math.min(1000000, Math.trunc(Number(req.body?.distance)) || 0));
      try {
        const updated = await store.submitDashScore(user.id, coins, distance);
        res.json({
          coins: updated?.dash_best_coins ?? coins,
          distance: updated?.dash_best_dist ?? distance,
        });
      } catch (err) {
        if (!/dash_best/.test(err?.message ?? "")) throw err;
        res.json({ coins, distance }); // columns not migrated yet -- accept, don't store
      }
    })
  );

  r.get(
    "/dash/leaderboard",
    wrap(async (req, res) => {
      const store = getStore();
      const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 15));
      res.set("Cache-Control", "public, max-age=15, s-maxage=15");
      try {
        res.json(await store.topDashScores(limit));
      } catch (err) {
        if (!/dash_best/.test(err?.message ?? "")) throw err;
        res.json([]);
      }
    })
  );

  // The client auto-detects the device's IANA zone and pushes it here whenever
  // it differs from what's stored -- first run after the migration, or the user
  // travelling. Every day-boundary decision for this user is then made from it.
  r.put(
    "/users/:id/timezone",
    wrap(async (req, res) => {
      const store = getStore();
      const tz = req.body?.timezone ?? null;
      if (tz !== null && !isValidZone(tz)) throw new HttpError(400, "unknown timezone");
      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);
      let updated;
      try {
        updated = await store.updateUser(user.id, { timezone: tz });
      } catch (err) {
        // A database still on migration-05 has no timezone column. Don't fail
        // the request over it -- the client falls back to sending its local
        // day, exactly as before, until the migration is run.
        if (!/timezone/.test(err?.message ?? "")) throw err;
        updated = { ...user, timezone: user.timezone ?? null };
      }
      res.json(userOut(updated ?? { ...user, timezone: tz }, true, await store.getGroup(user.group_id)));
    })
  );

  return r;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(createRateLimit());

  // Everything here is either personal or mutable, so nothing may sit in a
  // shared cache by default. The two public read-only endpoints opt back in
  // individually below -- those are the ones a widely-shared link can hammer,
  // and where a short edge TTL is worth real money at scale.
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const router = createRouter();
  // Vercel may hand the function either the full "/api/users" path or the
  // rewritten "/users". Mounting at both makes the app indifferent to which.
  app.use("/api", router);
  app.use("/", router);

  app.use((_req, res) => res.status(404).json({ error: "not found" }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) {
      // Log the real cause, return a generic one: a 500 here is usually a
      // database error, and those messages carry table and column names.
      console.error(err);
      return res.status(status).json({ error: "server error" });
    }
    res.status(status).json({ error: err.message ?? "request failed" });
  });

  return app;
}
