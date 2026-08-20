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
