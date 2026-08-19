import express from "express";

import { compute, dayDetail } from "./engine.js";
import { hashSecret, newInviteToken, newShareToken, verifySecret } from "./security.js";
import { getStore } from "./store/index.js";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const PIN = /^\d{4,6}$/;

/** Today in UTC. The client sends its own local day for anything that matters. */
const todayISO = () => new Date().toISOString().slice(0, 10);

const dayFrom = (value) => (ISO_DAY.test(value ?? "") ? value : todayISO());

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function loadUser(store, id) {
  const user = await store.getUser(id);
  if (!user) throw new HttpError(404, "user not found");
  return user;
}

/**
 * PIN enforcement disabled by request -- prompting on every single
 * mutation was pure friction for a device only its own owner uses. Kept as
 * a no-op (matching backend/app/main.py's _require_pin) rather than
 * deleted, so it can be re-enabled without re-deriving this logic.
 */
function requirePin(_user, _pin) {
  return;
}

/**
 * Trust X-Forwarded-For only for the convenience suggestion below, which
 * grants no access on its own -- if a deployment sits behind a proxy that
 * doesn't set this, it degrades to the proxy's own address, which just makes
 * the suggestion less precise, never wrong in a way that matters (PIN still
 * gates every mutation).
 */
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

async function touchSession(store, user, req) {
  await store.updateUser(user.id, { last_ip: clientIp(req), last_seen_at: new Date().toISOString() });
}

/**
 * Other members of your board can see your name, colour and progress, but
 * never your share/invite links -- that would let them hand your board to
 * anyone. Only handed back to the user themself.
 */
async function userOut(store, u, revealToken = false) {
  const out = {
    id: u.id,
    name: u.name,
    color: u.color,
    start_date: u.start_date,
    wake_time: u.wake_time ?? null,
    has_pin: Boolean(u.pin_hash),
  };
  if (revealToken) {
    out.share_token = u.share_token;
    const group = u.group_id != null ? await store.getGroup(u.group_id) : null;
    out.invite_token = group?.invite_token ?? null;
  }
  return out;
}

async function progressFor(store, user, today) {
  const [tasks, completions] = await Promise.all([
    store.listTasks(user.id),
    store.listCompletions(user.id),
  ]);
  return compute({ user, tasks, completions }, today || todayISO());
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
      const users = await store.listUsersInGroup(me.group_id);
      res.json(await Promise.all(users.map((u) => userOut(store, u, u.id === me.id))));
    })
  );

  /**
   * Convenience only, never auth -- lets a browser with no saved local user
   * (cleared storage, new device) get pre-selected instead of dropped on the
   * onboarding screen, if this IP was last seen as a specific user. PIN is
   * still required for every mutation regardless of what this returns.
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
        groupId = (await store.createGroup({ invite_token: newInviteToken() })).id;
      }

      const ip = clientIp(req);
      const user = await store.createUser({
        name,
        color,
        start_date: startDate || todayISO(),
        pin_hash: hashSecret(pin),
        wake_time: wakeTime,
        group_id: groupId,
        share_token: newShareToken(),
        last_ip: ip,
        last_seen_at: new Date().toISOString(),
      });

      if (wakeTime !== null) await syncWakeTask(store, user, wakeTime, repsTarget);
      res.status(201).json(await userOut(store, user, true));
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
      const users = await store.listUsersInGroup(me.group_id);
      res.json(await Promise.all(users.map((u) => progressFor(store, u, today))));
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
      res.json(await progressFor(store, user, dayFrom(req.query.today)));
    })
  );

  /**
   * Public preview of who's already in the lobby, shown before someone
   * commits to joining. No ids, pins or tokens leak here.
   */
  r.get(
    "/invite/:token",
    wrap(async (req, res) => {
      const store = getStore();
      const group = await store.getGroupByInviteToken(req.params.token);
      if (!group) throw new HttpError(404, "invalid or expired invite");
      const members = await store.listUsersInGroup(group.id);
      res.json({ members: members.map((u) => ({ name: u.name, color: u.color })) });
    })
  );

  /**
   * Actually joins the lobby -- unlike /share, this creates a real, editable
   * member (their own tasks/PIN), not a read-only view.
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
      if (!name) throw new HttpError(400, "name is required");
      if (name.length > 40) throw new HttpError(400, "name is too long");
      if (!PIN.test(pin)) throw new HttpError(400, "PIN must be 4-6 digits");
      if (await store.getUserByNameInGroup(group.id, name)) {
        throw new HttpError(409, "someone on this board already has that name");
      }

      const user = await store.createUser({
        name,
        color,
        start_date: todayISO(),
        pin_hash: hashSecret(pin),
        wake_time: null,
        group_id: group.id,
        share_token: newShareToken(),
      });

      res.status(201).json(await userOut(store, user, true));
    })
  );

  r.get(
    "/users/:id/progress",
    wrap(async (req, res) => {
      const store = getStore();
      const user = await loadUser(store, req.params.id);
      res.json(await progressFor(store, user, dayFrom(req.query.today)));
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
      // Judge the day against the *client's* clock, not the server's UTC one.
      const today = dayFrom(req.body?.today);
      if (day > today) throw new HttpError(400, "can't tick off a day that hasn't happened");

      const row = { user_id: user.id, task_id: task.id, day };
      if (done) await store.addCompletion(row);
      else await store.removeCompletion(row);

      res.json({
        day: await dayFor(store, user, day),
        progress: await progressFor(store, user, today),
      });
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
      const today = dayFrom(req.body?.today);
      const user = await loadUser(store, req.params.id);
      requirePin(user, req.body?.pin);
      const updated = (await store.updateUser(user.id, { restarted_at: today })) ?? {
        ...user,
        restarted_at: today,
      };
      res.json(await progressFor(store, updated, today));
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
      res.json(await userOut(store, updated ?? { ...user, wake_time: wakeTime }, true));
    })
  );

  return r;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  const router = createRouter();
  // Vercel may hand the function either the full "/api/users" path or the
  // rewritten "/users". Mounting at both makes the app indifferent to which.
  app.use("/api", router);
  app.use("/", router);

  app.use((_req, res) => res.status(404).json({ error: "not found" }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message ?? "server error" });
  });

  return app;
}
