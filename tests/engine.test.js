/**
 * The same assertions the original Python engine passed, run against the JS
 * port. If the streak maths ever drifts, this is what catches it.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { addDays, compute, diffDays, levelFor } from "../server/engine.js";
import { CORE_TASKS } from "../server/core-tasks.js";

const TODAY = "2026-07-29";

const tasks = CORE_TASKS.map(([title, emoji], i) => ({
  id: i + 1,
  title,
  emoji,
  is_core: true,
  sort: i,
}));

const ago = (n) => addDays(TODAY, -n);

/** completions for a whole day, or just the first `n` tasks of it */
const tick = (day, n = tasks.length) =>
  tasks.slice(0, n).map((t) => ({ task_id: t.id, day }));

const run = (startOffset, completions) =>
  compute(
    { user: { id: 1, name: "t", color: "#000", start_date: ago(startOffset) }, tasks, completions },
    TODAY
  );

test("date helpers survive a DST boundary", () => {
  // Europe/London springs forward on 2026-03-29
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(diffDays("2026-03-30", "2026-03-28"), 2);
  assert.equal(diffDays("2026-01-01", "2026-12-31"), -364);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("clean 10-day run, today untouched", () => {
  const c = [];
  for (let i = 10; i > 0; i -= 1) c.push(...tick(ago(i)));
  const p = run(10, c);
  assert.equal(p.day_number, 11);
  assert.equal(p.streak, 10);
  assert.equal(p.best_streak, 10);
  assert.equal(p.resets, 0);
  assert.equal(p.perfect_today, false);
  assert.equal(p.perfect_days_ever, 10);
});

test("same run, today finished", () => {
  const c = [];
  for (let i = 10; i > 0; i -= 1) c.push(...tick(ago(i)));
  c.push(...tick(TODAY));
  const p = run(10, c);
  assert.equal(p.streak, 11);
  assert.equal(p.perfect_today, true);
  assert.equal(p.day_number, 11);
});

test("a partial day still breaks the run", () => {
  const c = [];
  for (let i = 10; i > 0; i -= 1) c.push(...(i === 6 ? tick(ago(i), 3) : tick(ago(i))));
  const p = run(10, c);
  assert.equal(p.run_start, ago(5));
  assert.equal(p.day_number, 6);
  assert.equal(p.streak, 5);
  assert.equal(p.best_streak, 5); // the 5-day run after the miss
  assert.equal(p.resets, 1);
});

test("backfilling the missed day heals the run", () => {
  const c = [];
  for (let i = 10; i > 0; i -= 1) c.push(...(i === 6 ? tick(ago(i), 3) : tick(ago(i))));
  // fill in the rest of that day, as if ticking it off the next morning
  c.push(...tasks.slice(3).map((t) => ({ task_id: t.id, day: ago(6) })));
  const p = run(10, c);
  assert.equal(p.streak, 10);
  assert.equal(p.resets, 0);
});

test("brand new user, nothing done", () => {
  const p = run(0, []);
  assert.equal(p.day_number, 1);
  assert.equal(p.streak, 0);
  assert.equal(p.xp, 0);
  assert.equal(p.level_name, "Rookie");
  assert.equal(p.next_badge.day, 3);
  assert.equal(p.calendar.length, 75);
  assert.equal(p.calendar[0].status, "today");
  assert.equal(p.calendar[1].status, "future");
});

test("xp and badge maths at 7 days", () => {
  const c = [];
  for (let i = 7; i > 0; i -= 1) c.push(...tick(ago(i)));
  const p = run(7, c);
  // 7 days x 7 tasks x 10xp + 7 perfect x 40 + badge bonuses for days 3 and 7
  assert.equal(p.xp, 7 * 7 * 10 + 7 * 40 + 15 + 35);
  assert.deepEqual(
    p.badges.filter((b) => b.earned).map((b) => b.name),
    ["Ignition", "One Week"]
  );
  assert.equal(p.level_name, "Grinder");
});

test("a long gap counts as one reset, not one per dead day", () => {
  const c = [];
  for (let i = 20; i > 15; i -= 1) c.push(...tick(ago(i)));
  const p = run(20, c);
  assert.equal(p.resets, 1);
  assert.equal(p.streak, 0);
  assert.equal(p.day_number, 1);
  assert.equal(p.best_streak, 5);
});

test("bonus tasks earn xp but cannot break a streak", () => {
  const withBonus = [...tasks, { id: 99, title: "Journal", emoji: "+", is_core: false, sort: 9 }];
  const completions = [];
  for (let i = 3; i > 0; i -= 1) completions.push(...tick(ago(i)));
  const p = compute(
    { user: { id: 1, name: "t", color: "#000", start_date: ago(3) }, tasks: withBonus, completions },
    TODAY
  );
  assert.equal(p.streak, 3, "the untouched bonus task must not break the run");
  assert.equal(p.core_today, 7, "only core tasks count toward the day");

  // ticking it adds xp without changing the streak
  const p2 = compute(
    {
      user: { id: 1, name: "t", color: "#000", start_date: ago(3) },
      tasks: withBonus,
      completions: [...completions, { task_id: 99, day: ago(1) }],
    },
    TODAY
  );
  assert.equal(p2.streak, 3);
  assert.equal(p2.xp, p.xp + 10);
});

test("levels span the whole challenge", () => {
  assert.equal(levelFor(0).name, "Rookie");
  assert.equal(levelFor(399).name, "Rookie");
  assert.equal(levelFor(400).name, "Grinder");
  assert.equal(levelFor(820).name, "Grinder");
  assert.equal(levelFor(999_999).name, "Legend");
  assert.equal(levelFor(999_999).ceiling, null, "top level has no ceiling");

  // a flawless 75 should land on the last level, not cap out weeks early
  const c = [];
  for (let i = 75; i > 0; i -= 1) c.push(...tick(ago(i)));
  const p = run(75, c);
  assert.equal(p.streak, 75);
  assert.equal(p.level_name, "Legend");
  assert.equal(p.badges.every((b) => b.earned), true);
  assert.equal(p.next_badge, null);
});

test("the calendar only ever shows the current run", () => {
  // messy history: perfect, partial, empty, perfect, and today perfect
  const c = [...tick(ago(4)), ...tick(ago(3), 2), ...tick(ago(1)), ...tick(TODAY)];
  const p = run(4, c);

  assert.equal(p.run_start, ago(1), "the run restarts after the last failed day");
  assert.equal(p.streak, 2);
  assert.equal(p.resets, 1);

  // Invariant: a failed past day always moves run_start beyond itself, so no
  // in-run day before today can be anything but done. If this ever fails the
  // calendar needs real partial/missed states again.
  const statuses = new Set(p.calendar.map((x) => x.status));
  assert.deepEqual([...statuses].sort(), ["done", "future"]);

  const byDay = Object.fromEntries(p.calendar.map((x) => [x.day, x.status]));
  assert.equal(byDay[ago(3)], undefined, "days before the run are not shown");
  assert.equal(byDay[TODAY], "done");
  assert.equal(byDay[addDays(TODAY, 1)], "future");
});

test("today shows as 'today' until every core task is ticked", () => {
  const p = run(1, [...tick(ago(1)), ...tick(TODAY, 6)]);
  assert.equal(p.calendar[0].status, "done", "yesterday");
  assert.equal(p.calendar[1].status, "today", "six of seven is not a banked day");
  assert.equal(p.perfect_today, false);
});

test("a manual restart moves the run without erasing history", () => {
  // ten clean days, then "Reset my run" pressed today
  const c = [];
  for (let i = 10; i > 0; i -= 1) c.push(...tick(ago(i)));
  const before = run(10, c);
  assert.equal(before.streak, 10);
  assert.equal(before.best_streak, 10);

  const after = compute(
    {
      user: { id: 1, name: "t", color: "#000", start_date: ago(10), restarted_at: TODAY },
      tasks,
      completions: c,
    },
    TODAY
  );

  assert.equal(after.day_number, 1, "current run starts over");
  assert.equal(after.streak, 0);
  assert.equal(after.run_start, TODAY);

  // ...but the trophies and lifetime numbers are untouched
  assert.equal(after.best_streak, 10, "a restart must not take back a trophy");
  assert.equal(after.perfect_days_ever, 10);
  assert.equal(after.xp, before.xp);
  assert.deepEqual(
    after.badges.filter((b) => b.earned).map((b) => b.name),
    ["Ignition", "One Week"]
  );
});

test("a restart part-way through still counts days after it", () => {
  const c = [];
  for (let i = 10; i > 0; i -= 1) c.push(...tick(ago(i)));
  const p = compute(
    {
      user: { id: 1, name: "t", color: "#000", start_date: ago(10), restarted_at: ago(3) },
      tasks,
      completions: c,
    },
    TODAY
  );
  assert.equal(p.run_start, ago(3));
  assert.equal(p.streak, 3, "the three clean days since the restart");
  assert.equal(p.best_streak, 10, "lifetime best is still the original run");
});
