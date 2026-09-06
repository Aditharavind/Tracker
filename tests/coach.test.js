/**
 * The coach's inputs are pure arithmetic over completion rows, and its
 * fallback is pure rules -- both hand-verified here, same as engine.test.js.
 * The model path is exercised with a stub fetch so no network (or key) is
 * needed.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { addDays } from "../server/engine.js";
import { buildSignals, coachReport, coachFingerprint, fallbackReport } from "../server/coach.js";

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
const progress = (over = {}) => ({
  day_number: 12,
  streak: 5,
  best_streak: 9,
  resets: 1,
  completed_today: 2,
  core_today: 4,
  level_name: "Grinder",
  ...over,
});

test("buildSignals counts per-task rate and miss streak from real rows", () => {
  const kept = task(1);
  const dropped = task(2, { title: "Meditate" });
  const completions = [];
  for (let i = 1; i <= 35; i++) completions.push(tick(1, ago(i))); // task 1: every day, whole window
  for (let i = 20; i >= 7; i--) completions.push(tick(2, ago(i))); // task 2: nothing in last 6 days

  const s = buildSignals(
    { user, tasks: [kept, dropped], completions, progress: progress() },
    TODAY
  );

  const t1 = s.tasks.find((t) => t.title === "Task 1");
  const t2 = s.tasks.find((t) => t.title === "Meditate");
  assert.equal(t1.missStreak, 0);
  assert.equal(t1.rate, 1);
  assert.equal(t2.missStreak, 6);
  assert.ok(t2.rate < 1);
  assert.equal(s.dayNumber, 12);
  assert.equal(s.streak, 5);
  // the 6-day gap on a core task lands it in the neglected list too
  assert.equal(s.neglected[0].title, "Meditate");
});

test("buildSignals ignores archived tasks and days before a restart", () => {
  const s = buildSignals(
    {
      user: { ...user, restarted_at: ago(3) },
      tasks: [task(1), task(2, { archived: true })],
      completions: [],
      progress: progress(),
    },
    TODAY
  );
  assert.equal(s.tasks.length, 1, "archived task dropped");
  // window floored at the restart: at most 3 eligible days (yesterday..restart)
  assert.ok(s.windowDays <= 3);
});

test("fallbackReport turns the neglected list into focus lines and a plan", () => {
  const completions = [];
  for (let i = 1; i <= 20; i++) completions.push(tick(1, ago(i))); // strong anchor habit
  for (let i = 20; i >= 8; i--) completions.push(tick(2, ago(i))); // 7-day gap
  const s = buildSignals(
    { user, tasks: [task(1, { title: "Workout" }), task(2, { title: "Read" })], completions, progress: progress() },
    TODAY
  );

  const report = fallbackReport(s);
  assert.equal(report.source, "rule");
  assert.ok(report.persona.length > 0);
  assert.ok(report.focus.some((f) => f.includes("Read")), "names the slipping habit");
  assert.ok(report.plan.length >= 2 && report.plan.length <= 4);
  assert.ok(report.plan.every((p) => typeof p.title === "string" && typeof p.detail === "string"));
});

test("coachReport falls back to rules when no API key is set", async () => {
  const s = buildSignals({ user, tasks: [task(1)], completions: [], progress: progress() }, TODAY);
  const report = await coachReport(s, { apiKey: "" });
  assert.equal(report.source, "rule");
});

test("coachReport uses the model's JSON when the call succeeds", async () => {
  const s = buildSignals({ user, tasks: [task(1)], completions: [], progress: progress() }, TODAY);
  const stub = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              persona: "You show up on weekdays and fade on weekends.",
              focus: ["Weekend consistency"],
              plan: [{ title: "Sat morning block", detail: "Do all habits before 10am." }],
            }),
          },
        },
      ],
    }),
  });
  const report = await coachReport(s, { apiKey: "sk-test", fetchImpl: stub });
  assert.equal(report.source, "ai");
  assert.equal(report.persona, "You show up on weekdays and fade on weekends.");
  assert.equal(report.plan[0].title, "Sat morning block");
});

test("coachReport falls back when the model returns unusable JSON", async () => {
  const s = buildSignals({ user, tasks: [task(1)], completions: [], progress: progress() }, TODAY);
  const stub = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
  });
  const report = await coachReport(s, { apiKey: "sk-test", fetchImpl: stub });
  assert.equal(report.source, "rule");
});

test("coachFingerprint changes with the day and with the stats", () => {
  const s1 = buildSignals({ user, tasks: [task(1)], completions: [], progress: progress() }, TODAY);
  const s2 = buildSignals(
    { user, tasks: [task(1)], completions: [tick(1, ago(1))], progress: progress() },
    TODAY
  );
  assert.notEqual(coachFingerprint(1, TODAY, s1), coachFingerprint(1, ago(1), s1));
  assert.notEqual(coachFingerprint(1, TODAY, s1), coachFingerprint(1, TODAY, s2));
});
