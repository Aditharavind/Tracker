/**
 * /board is the endpoint every client hits on load and again after every task
 * tick, for every member of a group. It used to read each member's whole
 * lifetime completion history in its own query, so the work grew with members
 * *and* with how far into the run they were -- the shape that stops scaling
 * first.
 *
 * These tests pin the fix by counting store reads rather than timing anything,
 * so they stay meaningful on any machine.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../server/app.js";
import { createMemoryStore } from "../server/store/memory.js";
import { setStore } from "../server/store/index.js";
import { compute } from "../server/engine.js";
import { todayISO } from "./helpers.js";

/** Wraps a store so every method call is tallied. */
function counting(store) {
  const calls = {};
  const proxy = {};
  for (const key of Object.keys(store)) {
    const value = store[key];
    if (typeof value !== "function") {
      proxy[key] = value;
      continue;
    }
    proxy[key] = (...args) => {
      calls[key] = (calls[key] ?? 0) + 1;
      return value.apply(store, args);
    };
  }
  return { proxy, calls, inner: store };
}

async function boardWith(memberCount, daysOfHistory) {
  const inner = createMemoryStore();
  const { proxy, calls } = counting(inner);
  setStore(proxy);

  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (p, b) =>
    fetch(base + p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    }).then((r) => r.json());

  const host = await post("/users", { name: "Host", pin: "1111" });
  for (let i = 1; i < memberCount; i++) {
    await post("/users", { name: `M${i}`, pin: "1111", invited_by: host.id });
  }

  const hostRow = await inner.getUser(host.id);
  const members = await inner.listUsersInGroup(hostRow.group_id);
  for (const u of members) {
    const tasks = await inner.listTasks(u.id);
    for (let d = 0; d < daysOfHistory; d++) {
      const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      for (const t of tasks) await inner.addCompletion({ user_id: u.id, task_id: t.id, day });
    }
  }

  for (const k of Object.keys(calls)) delete calls[k]; // only count the board read
  const board = await (await fetch(`${base}/board?today=${todayISO()}&as=${host.id}`)).json();
  server.close();
  return { board, calls, members, inner };
}

test("a board read costs the same number of queries whatever the group size", async () => {
  const small = await boardWith(2, 5);
  const large = await boardWith(8, 5);

  assert.equal(small.board.length, 2);
  assert.equal(large.board.length, 8);

  const reads = (calls) => (calls.listTasksForUsers ?? 0) + (calls.listCompletionsForUsers ?? 0);
  assert.equal(reads(small.calls), reads(large.calls), "query count must not grow with members");

  // and it must not have fallen back to the per-user path
  assert.equal(large.calls.listTasks ?? 0, 0, "no per-member task query");
  assert.equal(large.calls.listCompletions ?? 0, 0, "no per-member completions query");
});

test("the batched board returns exactly what per-member computation would", async () => {
  const { board, members, inner } = await boardWith(5, 30);
  const day = todayISO();

  const perMember = [];
  for (const u of members) {
    const [tasks, completions] = await Promise.all([
      inner.listTasks(u.id),
      inner.listCompletions(u.id),
    ]);
    perMember.push(compute({ user: u, tasks, completions }, day));
  }

  assert.equal(JSON.stringify(board), JSON.stringify(perMember));
});

test("an empty group short-circuits instead of querying", async () => {
  const inner = createMemoryStore();
  const { proxy, calls } = counting(inner);
  setStore(proxy);
  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const board = await (await fetch(`${base}/board?today=${todayISO()}`)).json();
  server.close();

  assert.deepEqual(board, []);
  assert.equal(calls.listTasksForUsers ?? 0, 0);
  assert.equal(calls.listCompletionsForUsers ?? 0, 0);
});

/**
 * An invite link is a URL -- nothing stops one being posted publicly and a
 * board growing without bound. /board computes a full progress history per
 * member it returns, so an unbounded group is enough to exhaust one function
 * invocation regardless of how many users exist overall.
 */
test("a board read is capped, and reports how much it left out", async () => {
  const inner = createMemoryStore();
  setStore(inner);
  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (p, b) =>
    fetch(base + p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    }).then((r) => r.json());

  const host = await post("/users", { name: "Host", pin: "1111" });
  for (let i = 1; i < 60; i++) {
    await post("/users", { name: `M${i}`, pin: "1111", invited_by: host.id });
  }

  const res = await fetch(`${base}/board?today=${todayISO()}&as=${host.id}`);
  const board = await res.json();
  assert.equal(board.length, 50, "the default page bounds the work");
  assert.equal(res.headers.get("x-total-count"), "60", "but the true size is reported");
  assert.equal(res.headers.get("x-has-more"), "1");

  const rest = await fetch(`${base}/board?today=${todayISO()}&as=${host.id}&limit=50&offset=50`);
  assert.equal((await rest.json()).length, 10, "the remainder is reachable");
  assert.equal(rest.headers.get("x-has-more"), null, "and the last page says so");

  // A caller cannot lift the ceiling by asking for more.
  const greedy = await fetch(`${base}/board?today=${todayISO()}&as=${host.id}&limit=100000`);
  assert.ok((await greedy.json()).length <= 200, "limit is clamped to the maximum");

  // Nonsense paging values must not produce an empty or crashing response.
  for (const q of ["limit=0", "limit=-5", "offset=-1", "limit=abc&offset=abc"]) {
    const odd = await fetch(`${base}/board?today=${todayISO()}&as=${host.id}&${q}`);
    assert.equal(odd.status, 200, q);
    assert.ok((await odd.json()).length > 0, `${q} still returns a usable page`);
  }

  // The public invite preview must not become a way to enumerate a board.
  const group = await inner.getUser(host.id);
  const g = await inner.getGroup(group.group_id);
  const preview = await (await fetch(`${base}/invite/${g.invite_token}`)).json();
  assert.equal(preview.members.length, 12, "preview shows a handful");
  assert.equal(preview.total, 60, "and states the real size");

  server.close();
});

test("a 500 does not leak database detail to the caller", async (t) => {
  const broken = createMemoryStore();
  // /board now reads the members and their total in one call -- see
  // listUsersInGroupPaged. Stub both names so this keeps exercising the error
  // path rather than silently passing through a working store.
  broken.listUsersInGroupPaged = async () => {
    throw new Error('relation "public.users" does not exist');
  };
  broken.listUsersInGroup = broken.listUsersInGroupPaged;
  setStore(broken);
  const server = createApp().listen(0);
  // Closed via t.after rather than at the end of the body: a failing assertion
  // would otherwise skip the close, leave the port listening, and hang the
  // whole run instead of reporting the failure.
  t.after(() => server.close());
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const seeded = createMemoryStore();
  const user = await seeded.createUser({ name: "X", group_id: 1, share_token: "t" });
  broken.getUser = async () => user;

  const res = await fetch(`${base}/board?as=${user.id}`);
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: "server error" });
});

/**
 * Servers here are closed via t.after rather than at the end of the body: a
 * failing assertion would otherwise skip the close, leave the port listening
 * and hang the whole run instead of reporting the failure.
 */
async function appOn(t) {
  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}/api`;
}

test("a runaway client is throttled, and told when to come back", async (t) => {
  process.env.RATE_LIMIT_PER_MIN = "5";
  t.after(() => delete process.env.RATE_LIMIT_PER_MIN);
  setStore(createMemoryStore());
  const base = await appOn(t);

  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await fetch(`${base}/session/suggest`)).status);

  assert.deepEqual(codes.slice(0, 5), [200, 200, 200, 200, 200], "normal use is untouched");
  assert.ok(
    codes.slice(5).every((c) => c === 429),
    "past the ceiling it refuses rather than passing the load to the database"
  );

  const blocked = await fetch(`${base}/session/suggest`);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0, "and says how long to wait");
});

test("last_seen_at is not rewritten on every single board load", async (t) => {
  // Regression: touchSession wrote one UPDATE per /users call, i.e. per page
  // load per visitor, on the read path. It now writes only when the row is
  // genuinely stale or the address changed.
  const store = createMemoryStore();
  let writes = 0;
  const realUpdate = store.updateUser.bind(store);
  store.updateUser = async (id, patch) => {
    if ("last_seen_at" in patch) writes += 1;
    return realUpdate(id, patch);
  };
  setStore(store);
  const base = await appOn(t);

  const user = await (
    await fetch(`${base}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Toucher", pin: "1234" }),
    })
  ).json();

  writes = 0;
  for (let i = 0; i < 6; i++) await fetch(`${base}/users?as=${user.id}`);
  assert.equal(writes, 1, "first load records the session, the rest ride on it");

  // A different address is the signal /session/suggest actually reads, so that
  // must still be written through immediately.
  await fetch(`${base}/users?as=${user.id}`, { headers: { "x-forwarded-for": "203.0.113.9" } });
  assert.equal(writes, 2, "a change of address is written straight away");
});

test("writes get a tighter budget than reads", async (t) => {
  // Writes are unauthenticated (requirePin is a no-op), hit the database
  // harder and leave rows behind, so they are rationed separately -- a read
  // ceiling generous enough for a whole office behind one NAT address would be
  // far too loose to apply to writes.
  process.env.RATE_LIMIT_PER_MIN = "50";
  process.env.RATE_LIMIT_WRITES_PER_MIN = "2";
  t.after(() => {
    delete process.env.RATE_LIMIT_PER_MIN;
    delete process.env.RATE_LIMIT_WRITES_PER_MIN;
  });
  setStore(createMemoryStore());
  const base = await appOn(t);

  const writes = [];
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${base}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `W${i}`, pin: "1234" }),
    });
    writes.push(r.status);
  }
  assert.ok(writes[0] < 429 && writes[1] < 429, "the first writes go through");
  assert.deepEqual(writes.slice(2), [429, 429], "past the write ceiling they are refused");

  // ...and the read budget is untouched by that, since it is counted apart.
  const read = await fetch(`${base}/session/suggest`);
  assert.equal(read.status, 200, "reads keep their own, larger budget");
});

test("each instance starts with a clean rate budget", async (t) => {
  // Regression: the counter was module-level, so every app built in one process
  // shared a budget. In production that tied the ceiling to instance lifetime
  // rather than to the window; here it made tests bleed into each other.
  process.env.RATE_LIMIT_PER_MIN = "3";
  t.after(() => delete process.env.RATE_LIMIT_PER_MIN);
  setStore(createMemoryStore());

  for (let round = 0; round < 2; round++) {
    const base = await appOn(t);
    const first = await fetch(`${base}/session/suggest`);
    assert.equal(first.status, 200, `round ${round} must not inherit the previous budget`);
  }
});

test("personal data is marked uncacheable, public links are not", async (t) => {
  setStore(createMemoryStore());
  const base = await appOn(t);
  const user = await (
    await fetch(`${base}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cacheable", pin: "1111" }),
    })
  ).json();

  const board = await fetch(`${base}/board?as=${user.id}&today=${todayISO()}`);
  assert.match(board.headers.get("cache-control"), /no-store/, "a board is personal");

  const shared = await fetch(`${base}/share/${user.share_token}?today=${todayISO()}`);
  assert.equal(shared.status, 200);
  assert.match(
    shared.headers.get("cache-control"),
    /public/,
    "a share link is identical for every viewer, so it can sit at the edge"
  );
});
