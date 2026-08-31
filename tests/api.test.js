/**
 * Drives the real Express app over HTTP against the in-memory store, so every
 * route, status code, PIN check and group boundary is exercised without
 * needing Supabase.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createApp } from "../server/app.js";
import { createMemoryStore } from "../server/store/memory.js";
import { setStore } from "../server/store/index.js";
import { todayISO } from "./helpers.js";

let base;
let server;

before(async () => {
  setStore(createMemoryStore());
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server.close());

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const TODAY = todayISO();
const PIN = "4821";

// filled in by the first test and reused throughout
let adith;
let rahul;
let stranger;

test("signing up creates an isolated board and seeds the seven rules", async () => {
  const made = await call("POST", "/users", { name: "Adith", color: "#e8734a", pin: PIN });
  assert.equal(made.status, 201);
  adith = made.body;

  assert.equal(adith.has_pin, true);
  assert.ok(adith.share_token, "you get your own share link");
  assert.equal("pin_hash" in adith, false, "the hash never leaves the server");

  const tasks = await call("GET", `/users/${adith.id}/tasks`);
  assert.equal(tasks.body.length, 7);
  assert.equal(tasks.body.every((t) => t.is_core), true);
});

test("a PIN is required, and must be 4-6 digits", async () => {
  assert.equal((await call("POST", "/users", { name: "NoPin" })).status, 400);
  assert.equal((await call("POST", "/users", { name: "Short", pin: "12" })).status, 400);
  assert.equal((await call("POST", "/users", { name: "Wordy", pin: "abcd" })).status, 400);
});

test("names clash only with people who can see you", async () => {
  // same name, its own board -> fine, these two can never see each other
  const elsewhere = await call("POST", "/users", { name: "Adith", pin: "7777" });
  assert.equal(elsewhere.status, 201);

  // same name on the *same* board -> rejected
  const sameBoard = await call("POST", "/users", {
    name: "Adith",
    pin: "7777",
    invited_by: adith.id,
  });
  assert.equal(sameBoard.status, 409);
});

test("an invite joins the host's board; no invite starts a separate one", async () => {
  rahul = (
    await call("POST", "/users", { name: "Rahul", pin: "1111", invited_by: adith.id })
  ).body;
  stranger = (await call("POST", "/users", { name: "Stranger", pin: "2222" })).body;

  const mine = await call("GET", `/users?as=${adith.id}`);
  assert.deepEqual(mine.body.map((u) => u.name), ["Adith", "Rahul"]);

  const theirs = await call("GET", `/users?as=${stranger.id}`);
  assert.deepEqual(theirs.body.map((u) => u.name), ["Stranger"]);
});

test("a browser with no user sees nothing rather than everyone", async () => {
  assert.deepEqual((await call("GET", "/users")).body, []);
  assert.deepEqual((await call("GET", "/board")).body, []);
});

test("board is scoped to your own group", async () => {
  const { body } = await call("GET", `/board?as=${adith.id}&today=${TODAY}`);
  assert.deepEqual(body.map((p) => p.name), ["Adith", "Rahul"]);
  assert.equal(body[0].calendar.length, 75);
});

test("group-mates never see each other's share links", async () => {
  const { body } = await call("GET", `/users?as=${adith.id}`);
  const me = body.find((u) => u.id === adith.id);
  const them = body.find((u) => u.id === rahul.id);
  assert.ok(me.share_token, "your own link comes back");
  assert.equal(them.share_token, undefined, "your friend's does not");
});

test("a share link is public, read-only progress", async () => {
  const ok = await call("GET", `/share/${adith.share_token}?today=${TODAY}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, "Adith");
  assert.equal(ok.body.calendar.length, 75);
  assert.equal(ok.body.tasks, undefined, "no task detail is exposed");

  assert.equal((await call("GET", "/share/not-a-real-token")).status, 404);
});

/**
 * Per-request PIN checks are deliberately off -- see requirePin in
 * server/app.js. The client sends no PIN and has no prompt UI, so enforcing
 * here meant an undismissable "wrong PIN" on every task tick. This pins the
 * decision so it can't be reverted by accident on one side only.
 */
test("mutations go through without a PIN, and a wrong one is not rejected either", async () => {
  const { body: tasks } = await call("GET", `/users/${adith.id}/tasks`);
  const t = tasks[0].id;

  const missing = await call("POST", `/users/${adith.id}/toggle`, {
    task_id: t, day: TODAY, done: true, today: TODAY,
  });
  assert.equal(missing.status, 200, "no PIN supplied is fine");

  const wrong = await call("POST", `/users/${adith.id}/toggle`, {
    task_id: t, day: TODAY, done: false, today: TODAY, pin: "0000",
  });
  assert.equal(wrong.status, 200, "a wrong PIN is ignored rather than refused");

  assert.equal(
    (await call("PUT", `/users/${adith.id}/note`, { day: TODAY, text: "x", today: TODAY })).status,
    200
  );
  assert.equal(
    (await call("PUT", `/users/${adith.id}/note`, { day: TODAY, text: "", today: TODAY })).status,
    200
  );
});

test("signing in is still gated -- that is what stops someone taking your board", async () => {
  assert.equal((await call("POST", "/login", { name: "Adith", pin: "0000" })).status, 403);
  const ok = await call("POST", "/login", { name: "Adith", pin: PIN });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.id, adith.id);
});

test("ticking every core task banks the day", async () => {
  const { body: tasks } = await call("GET", `/users/${adith.id}/tasks`);
  for (const t of tasks) {
    await call("POST", `/users/${adith.id}/toggle`, {
      task_id: t.id, day: TODAY, done: true, today: TODAY, pin: PIN,
    });
  }
  const { body: p } = await call("GET", `/users/${adith.id}/progress?today=${TODAY}`);
  assert.equal(p.perfect_today, true);
  assert.equal(p.streak, 1);
  assert.equal(p.xp, 7 * 10 + 40);
});

test("re-ticking is idempotent; unticking un-banks the day", async () => {
  const { body: tasks } = await call("GET", `/users/${adith.id}/tasks`);
  const before = (await call("GET", `/users/${adith.id}/progress?today=${TODAY}`)).body.xp;
  for (let i = 0; i < 3; i += 1) {
    await call("POST", `/users/${adith.id}/toggle`, {
      task_id: tasks[0].id, day: TODAY, done: true, today: TODAY, pin: PIN,
    });
  }
  assert.equal((await call("GET", `/users/${adith.id}/progress?today=${TODAY}`)).body.xp, before);

  const off = await call("POST", `/users/${adith.id}/toggle`, {
    task_id: tasks[2].id, day: TODAY, done: false, today: TODAY, pin: PIN,
  });
  assert.equal(off.body.progress.perfect_today, false);
  assert.equal(off.body.day.pending.length, 1);

  await call("POST", `/users/${adith.id}/toggle`, {
    task_id: tasks[2].id, day: TODAY, done: true, today: TODAY, pin: PIN,
  });
});

test("one user cannot touch another's task, even with their own PIN", async () => {
  const { body: mine } = await call("GET", `/users/${adith.id}/tasks`);
  const res = await call("POST", `/users/${rahul.id}/toggle`, {
    task_id: mine[0].id, day: TODAY, done: true, today: TODAY, pin: "1111",
  });
  assert.equal(res.status, 404);
  assert.equal(
    (await call("DELETE", `/users/${rahul.id}/tasks/${mine[0].id}`, { pin: "1111" })).status,
    404
  );
});

test("refuses future days and malformed dates", async () => {
  const { body: tasks } = await call("GET", `/users/${adith.id}/tasks`);
  assert.equal(
    (await call("POST", `/users/${adith.id}/toggle`, {
      task_id: tasks[0].id, day: "2099-01-01", done: true, today: TODAY, pin: PIN,
    })).status,
    400
  );
  assert.equal((await call("GET", `/users/${adith.id}/day/nope`)).status, 400);
  assert.equal(
    (await call("PUT", `/users/${adith.id}/note`, { day: "29-07-2026", text: "x", pin: PIN })).status,
    400
  );
});

test("bonus tasks add and archive; notes round-trip", async () => {
  const made = await call("POST", `/users/${adith.id}/tasks`, {
    title: "Journal 5 min", is_core: false, pin: PIN,
  });
  assert.equal(made.status, 201);
  assert.equal(made.body.is_core, false);

  const { body: p } = await call("GET", `/users/${adith.id}/progress?today=${TODAY}`);
  assert.equal(p.perfect_today, true, "an untouched bonus task can't break the day");
  assert.equal(p.core_today, 7);

  assert.equal(
    (await call("DELETE", `/users/${adith.id}/tasks/${made.body.id}`, { pin: PIN })).status,
    204
  );

  await call("PUT", `/users/${adith.id}/note`, { day: TODAY, text: "owe a run", pin: PIN, today: TODAY });
  assert.equal((await call("GET", `/users/${adith.id}/day/${TODAY}`)).body.note, "owe a run");
});

test("wake time adds a locked task that cannot be deleted", async () => {
  const set = await call("PUT", `/users/${adith.id}/wake`, {
    wake_time: "05:30", reps_target: 25, pin: PIN,
  });
  assert.equal(set.status, 200);
  assert.equal(set.body.wake_time, "05:30");

  const { body: tasks } = await call("GET", `/users/${adith.id}/tasks`);
  const locked = tasks.find((t) => t.locked);
  assert.ok(locked, "a locked wake-up task appears");
  assert.equal(locked.title, "25 reps to wake up");
  assert.equal(locked.reps_target, 25);

  const del = await call("DELETE", `/users/${adith.id}/tasks/${locked.id}`, { pin: PIN });
  assert.equal(del.status, 409, "the bare minimum can't be removed");

  // changing the target renames the existing task rather than adding a second
  await call("PUT", `/users/${adith.id}/wake`, { wake_time: "06:00", reps_target: 40, pin: PIN });
  const { body: after } = await call("GET", `/users/${adith.id}/tasks`);
  assert.equal(after.filter((t) => t.locked).length, 1);
  assert.equal(after.find((t) => t.locked).title, "40 reps to wake up");

  assert.equal(
    (await call("PUT", `/users/${adith.id}/wake`, { wake_time: "25:00", pin: PIN })).status,
    400
  );
});

test("signing up with a wake time seeds the locked task straight away", async () => {
  const early = (
    await call("POST", "/users", {
      name: "EarlyBird", pin: "3333", wake_time: "04:45", reps_target: 30, invited_by: adith.id,
    })
  ).body;
  const { body: tasks } = await call("GET", `/users/${early.id}/tasks`);
  assert.equal(tasks.length, 8, "seven rules plus the wake-up task");
  assert.equal(tasks.find((t) => t.locked).title, "30 reps to wake up");
});

test("a new PIN still has to be well-formed, and it is what login then accepts", async () => {
  // The old PIN is no longer required to set a new one (requirePin is a
  // no-op), but the *shape* of the new one is still validated -- otherwise a
  // one-digit PIN would sail through and weaken the one check that remains.
  assert.equal(
    (await call("PUT", `/users/${rahul.id}/pin`, { new_pin: "12", pin: "1111" })).status,
    400
  );
  assert.equal(
    (await call("PUT", `/users/${rahul.id}/pin`, { new_pin: "9999", pin: "1111" })).status,
    200
  );

  // Login follows the change: the new PIN works, the old one no longer does.
  assert.equal((await call("POST", "/login", { name: "Rahul", pin: "1111" })).status, 403);
  assert.equal((await call("POST", "/login", { name: "Rahul", pin: "9999" })).status, 200);
});

test("restart returns to day 1, clears today, and keeps earned trophies", async () => {
  // tick something today so there's a completion for the reset to clear
  const { body: tasks } = await call("GET", `/users/${adith.id}/tasks`);
  await call("POST", `/users/${adith.id}/toggle`, {
    task_id: tasks[0].id, day: TODAY, done: true, pin: PIN, today: TODAY,
  });

  const before = (await call("GET", `/users/${adith.id}/progress?today=${TODAY}`)).body;
  const { body } = await call("POST", `/users/${adith.id}/restart`, { pin: PIN, today: TODAY });
  assert.equal(body.day_number, 1);
  assert.equal(body.run_start, TODAY);
  assert.equal(body.best_streak, before.best_streak, "earned trophies survive a reset");
  assert.deepEqual(body.badges, before.badges, "badges survive a reset");

  // the fresh run's day 1 opens blank -- nothing ticked carries over
  const { body: day } = await call("GET", `/users/${adith.id}/day/${TODAY}`);
  assert.equal(day.tasks.some((t) => t.done), false, "today starts clean after a reset");
});

test("past days are locked -- you can only update today", async () => {
  const { body: tasks } = await call("GET", `/users/${adith.id}/tasks`);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const past = await call("POST", `/users/${adith.id}/toggle`, {
    task_id: tasks[0].id, day: yesterday, done: true, today: TODAY,
  });
  assert.equal(past.status, 409, "yesterday is sealed");

  const now = await call("POST", `/users/${adith.id}/toggle`, {
    task_id: tasks[0].id, day: TODAY, done: true, today: TODAY,
  });
  assert.equal(now.status, 200, "today is still editable");

  const pastNote = await call("PUT", `/users/${adith.id}/note`, {
    day: yesterday, text: "late", today: TODAY,
  });
  assert.equal(pastNote.status, 409, "past notes are locked too");
});

test("a stored timezone decides the user's day, not the caller's clock", async () => {
  // Two brand-new users, same instant, opposite sides of the date line.
  const east = (
    await call("POST", "/users", { name: "Kiri", pin: "1212", timezone: "Pacific/Kiritimati" })
  ).body;
  const west = (
    await call("POST", "/users", { name: "Midway", pin: "1212", timezone: "Pacific/Midway" })
  ).body;
  assert.equal(east.timezone, "Pacific/Kiritimati");

  // No ?today -- the server must fall back to each user's own zone. Kiritimati
  // (UTC+14) and Midway (UTC-11) are 25h apart, so at any instant they sit on
  // different calendar days -> the day counter differs.
  const eastN = (await call("GET", `/users/${east.id}/progress`)).body.day_number;
  const westN = (await call("GET", `/users/${west.id}/progress`)).body.day_number;
  assert.notEqual(eastN, westN, "a 25h zone spread puts them on different challenge days");

  const bad = await call("POST", "/users", { name: "Nowhere", pin: "1212", timezone: "Mars/Olympus" });
  assert.equal(bad.body.timezone, null, "an unknown zone is dropped, not stored");
});

test("health check reports the store and its schema", async () => {
  const { status, body } = await call("GET", "/health");
  assert.equal(status, 200);
  assert.equal(body.store, "memory");
  assert.equal(body.ok, true);
});

test("Forest Dash keeps a global best and ranks players by coins", async () => {
  const empty = await call("GET", "/dash/leaderboard");
  assert.equal(empty.status, 200);
  assert.equal(Array.isArray(empty.body), true);

  await call("POST", `/users/${adith.id}/dash`, { coins: 12, distance: 300 });
  await call("POST", `/users/${rahul.id}/dash`, { coins: 40, distance: 120 });
  // a worse run must not lower the stored best
  const worse = await call("POST", `/users/${adith.id}/dash`, { coins: 3, distance: 50 });
  assert.equal(worse.body.coins, 12, "best coins are kept, not overwritten by a worse run");

  const { body: board } = await call("GET", "/dash/leaderboard");
  const names = board.map((r) => r.name);
  assert.equal(names[0], "Rahul", "most coins ranks first");
  assert.equal(names.includes("Adith"), true);
  assert.equal("id" in board[0], false, "no ids leak onto the public board");
});

test("missing things 404 rather than 500", async () => {
  assert.equal((await call("GET", "/users/9999/progress")).status, 404);
  assert.equal((await call("GET", `/users/9999/day/${TODAY}`)).status, 404);
  assert.equal((await call("GET", "/nope")).status, 404);
  assert.equal(
    (await call("POST", "/users", { name: "Ghost", pin: "5555", invited_by: 9999 })).status,
    404
  );
});

test("routes also answer without the /api prefix (Vercel rewrite safety)", async () => {
  const res = await fetch(`${base.replace("/api", "")}/users?as=${adith.id}`);
  assert.equal(res.status, 200);
  const names = (await res.json()).map((u) => u.name);
  assert.deepEqual(names, ["Adith", "Rahul", "EarlyBird"]);
});

test("you can sign back in with your name and PIN", async () => {
  const ok = await call("POST", "/login", { name: "Rahul", pin: "9999" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.id, rahul.id);
  assert.ok(ok.body.share_token, "signing in hands back your own link");

  assert.equal((await call("POST", "/login", { name: "Rahul", pin: "0000" })).status, 403);
  assert.equal((await call("POST", "/login", { name: "Nobody", pin: "9999" })).status, 403);
  assert.equal((await call("POST", "/login", { name: "Rahul" })).status, 400);
});

test("an ambiguous name+PIN is refused rather than guessed", async () => {
  // two boards, same name, same PIN -- nothing can tell them apart
  await call("POST", "/users", { name: "Twin", pin: "5150" });
  await call("POST", "/users", { name: "Twin", pin: "5150" });
  const res = await call("POST", "/login", { name: "Twin", pin: "5150" });
  assert.equal(res.status, 403, "must not silently pick one");
});

/**
 * Invite links and the session suggestion were ported from the FastAPI backend
 * when the Python service was dropped -- these pin the behaviour the frontend
 * (JoinLobby, and App's cleared-storage path) relies on.
 */
test("a founder gets an invite link and someone can join the board through it", async () => {
  const host = await (
    await fetch(`${base}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invite Host", color: "#e8734a", pin: "1234", start_date: todayISO() }),
    })
  ).json();
  assert.ok(host.invite_token, "the founder is handed an invite token");

  const preview = await (await fetch(`${base}/invite/${host.invite_token}`)).json();
  assert.deepEqual(
    preview.members,
    [{ name: "Invite Host", color: "#e8734a" }],
    "the preview lists who is already in the lobby, and nothing else"
  );

  const joined = await (
    await fetch(`${base}/invite/${host.invite_token}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invitee", color: "#4a9ee8", pin: "5678", start_date: todayISO() }),
    })
  ).json();
  assert.equal(joined.invite_token, host.invite_token, "the joiner lands in the same group");

  const board = await (await fetch(`${base}/board?today=${todayISO()}&as=${host.id}`)).json();
  const names = board.map((p) => p.name);
  assert.ok(names.includes("Invite Host") && names.includes("Invitee"), "both share one board");
});

test("an unknown invite token is refused rather than silently making a group", async () => {
  const res = await fetch(`${base}/invite/definitely-not-a-token`);
  assert.equal(res.status, 404);
  const join = await fetch(`${base}/invite/definitely-not-a-token/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Nobody", color: "#000000", pin: "1111" }),
  });
  assert.equal(join.status, 404);
});

test("the preview never leaks ids, PINs or share links", async () => {
  const host = await (
    await fetch(`${base}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Leak Check", color: "#5cbd7e", pin: "4321", start_date: todayISO() }),
    })
  ).json();
  const preview = await (await fetch(`${base}/invite/${host.invite_token}`)).json();
  for (const m of preview.members) {
    assert.deepEqual(Object.keys(m).sort(), ["color", "name"]);
  }
});

test("session/suggest offers the last user seen from this address, and nothing when unseen", async () => {
  const user = await (
    await fetch(`${base}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Suggest Me", color: "#b76ae8", pin: "2468", start_date: todayISO() }),
    })
  ).json();

  // The address is only recorded once the board is actually loaded.
  await fetch(`${base}/users?as=${user.id}`);
  const hit = await (await fetch(`${base}/session/suggest`)).json();
  assert.equal(hit.user_id, user.id);
  assert.equal(hit.name, "Suggest Me");
  assert.ok(!("pin_hash" in hit) && !("share_token" in hit), "it is a hint, not a credential");
});
