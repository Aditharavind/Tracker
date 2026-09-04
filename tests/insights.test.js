/**
 * Neglected-task detection is pure arithmetic over completions rows -- these
 * assertions hand-verify the miss-streak and rate maths the same way
 * engine.test.js hand-verifies the streak/XP maths.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { addDays } from "../server/engine.js";
import { neglectedTasks } from "../server/insights.js";

const TODAY = "2026-07-29";
const ago = (n) => addDays(TODAY, -n);

const user = { id: 1, start_date: ago(60), restarted_at: null };

const task = (id, overrides = {}) => ({
  id,
  title: `Task ${id}`,
  is_core: true,
  archived: false,
  created_at: ago(60),
  ...overrides,
});

const tick = (taskId, day) => ({ task_id: taskId, day });

test("a task completed every day is never flagged", () => {
  const t = task(1);
  const completions = [];
  for (let i = 1; i <= 20; i++) completions.push(tick(1, ago(i)));
  const out = neglectedTasks({ user, tasks: [t], completions }, TODAY);
  assert.deepEqual(out, []);
});

test("a run of misses right up to yesterday flags a miss-streak", () => {
  const t = task(1);
  const completions = [];
  // done days 20..7 ago, missed the last 6 days (6..1 ago)
  for (let i = 20; i >= 7; i--) completions.push(tick(1, ago(i)));
  const out = neglectedTasks({ user, tasks: [t], completions }, TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].taskId, 1);
  assert.equal(out[0].missStreak, 6);
  assert.equal(out[0].lastDone, ago(7));
  assert.equal("flagged" in out[0], false, "internal flag is not exposed");
});

test("a brand-new task never flags, even with zero completions", () => {
  const t = task(1, { created_at: ago(2) });
  const out = neglectedTasks({ user, tasks: [t], completions: [] }, TODAY);
  assert.deepEqual(out, []);
});

test("a miss from before a manual restart does not count", () => {
  const t = task(1, { created_at: ago(60) });
  const restarted = { ...user, restarted_at: ago(3) };
  // never completed at all, but the run only started 3 days ago
  const out = neglectedTasks({ user: restarted, tasks: [t], completions: [] }, TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].missStreak, 3, "only counts days since the restart, not the whole history");
});

test("a low completion rate flags even with a short current streak", () => {
  const t = task(1);
  const completions = [
    tick(1, ago(1)), // done yesterday -- streak is 0
    tick(1, ago(8)),
  ];
  // 2 done out of 14 eligible days ending yesterday -> rate ~0.14
  const out = neglectedTasks({ user, tasks: [t], completions }, TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].missStreak, 0);
  assert.ok(out[0].rate < 0.3, `expected a low rate, got ${out[0].rate}`);
});

test("archived tasks are never surfaced", () => {
  const t = task(1, { archived: true });
  const out = neglectedTasks({ user, tasks: [t], completions: [] }, TODAY);
  assert.deepEqual(out, []);
});

test("worst offenders sort first", () => {
  const tasks = [task(1), task(2)];
  const completions = [];
  for (let i = 20; i >= 6; i--) completions.push(tick(1, ago(i))); // task 1: 5-day miss streak (at the threshold)
  for (let i = 20; i >= 9; i--) completions.push(tick(2, ago(i))); // task 2: 8-day miss streak (worse)
  const out = neglectedTasks({ user, tasks, completions }, TODAY);
  assert.deepEqual(out.map((r) => r.taskId), [2, 1]);
});
