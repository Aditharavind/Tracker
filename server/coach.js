/**
 * The intelligence layer -- a habit coach that reads how the user has actually
 * been doing and hands back a short persona read, what they're slipping on, and
 * a concrete plan.
 *
 * Same rule as the rest of the engine: the numbers are the source of truth.
 * `buildSignals` counts everything deterministically from real completion rows;
 * the model only ever gets that snapshot and its job is to phrase and
 * prioritise, never to invent a fact. When there's no API key -- or the call
 * fails, times out, or comes back malformed -- `fallbackReport` produces the
 * same shape from rules alone, so the feature always works.
 */
import { addDays, diffDays } from "./engine.js";
import { neglectedTasks } from "./insights.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const HISTORY_DAYS = 30;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dayOf = (ts) => String(ts).slice(0, 10);
const maxDay = (a, b) => (a > b ? a : b);
const pct = (n) => Math.round(n * 100);
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * A compact, fully deterministic snapshot of the last ~30 days -- the only
 * thing the model is ever given. Every field is counted from real rows.
 *
 * @param {{user:object, tasks:object[], completions:{task_id:number,day:string}[], progress:object}} data
 * @param {string} today ISO day this user is currently living in.
 */
export function buildSignals({ user, tasks, completions, progress }, today) {
  const floor =
    user.restarted_at && user.restarted_at > user.start_date ? user.restarted_at : user.start_date;
  const yesterday = addDays(today, -1);
  const windowStart = maxDay(floor, addDays(today, -HISTORY_DAYS));

  const active = tasks.filter((t) => !t.archived);
  const doneByTask = new Map();
  for (const c of completions) {
    if (!doneByTask.has(c.task_id)) doneByTask.set(c.task_id, new Set());
    doneByTask.get(c.task_id).add(c.day);
  }

  const startOf = (task) => maxDay(windowStart, dayOf(task.created_at ?? floor));

  // Per-weekday completion rate across the window, every task pooled.
  const byWeekday = Array.from({ length: 7 }, () => ({ done: 0, slots: 0 }));
  for (let d = windowStart; diffDays(d, yesterday) <= 0; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    for (const t of active) {
      if (diffDays(d, startOf(t)) < 0) continue;
      byWeekday[wd].slots += 1;
      if (doneByTask.get(t.id)?.has(d)) byWeekday[wd].done += 1;
    }
  }
  const weekdayRates = byWeekday
    .map((w, i) => ({ day: WEEKDAYS[i], rate: w.slots ? round2(w.done / w.slots) : null, slots: w.slots }))
    .filter((w) => w.slots >= 2 && w.rate != null)
    .sort((a, b) => a.rate - b.rate);
  const weakestDays = weekdayRates.slice(0, 2).map((w) => w.day);
  const strongestDays = weekdayRates.slice(-2).reverse().map((w) => w.day);

  // Per-task summary over the same window.
  const taskStats = active.map((t) => {
    const days = doneByTask.get(t.id) ?? new Set();
    const start = startOf(t);
    const slots = Math.max(0, diffDays(yesterday, start) + 1);
    let doneInWindow = 0;
    for (let d = start; diffDays(d, yesterday) <= 0; d = addDays(d, 1)) if (days.has(d)) doneInWindow += 1;
    let missStreak = 0;
    for (let d = yesterday; diffDays(d, start) >= 0; d = addDays(d, -1)) {
      if (days.has(d)) break;
      missStreak += 1;
    }
    const lastDone = [...days].filter((d) => diffDays(d, yesterday) <= 0).sort().pop() ?? null;
    return {
      title: t.title,
      kind: t.is_core ? "core" : "bonus",
      rate: slots ? round2(doneInWindow / slots) : null,
      missStreak,
      lastDone,
    };
  });

  const rated = taskStats.filter((t) => t.rate != null);
  const overallRate = rated.length
    ? round2(rated.reduce((s, t) => s + t.rate, 0) / rated.length)
    : null;

  const neglected = neglectedTasks({ user, tasks, completions }, today).map((n) => ({
    title: n.title,
    kind: n.isCore ? "core" : "bonus",
    missStreak: n.missStreak,
    rate: n.rate,
  }));

  return {
    dayNumber: progress.day_number,
    challengeLength: 75,
    streak: progress.streak,
    bestStreak: progress.best_streak,
    resets: progress.resets,
    level: progress.level_name,
    windowDays: Math.max(0, diffDays(yesterday, windowStart) + 1),
    overallRate,
    completedToday: progress.completed_today,
    coreToday: progress.core_today,
    tasks: taskStats,
    neglected,
    weakestDays,
    strongestDays,
  };
}

const SYSTEM_PROMPT = [
  "You are a calm, sharp habit coach inside a 75-day challenge game.",
  "You are given a JSON snapshot of ONE user's real completion stats for the last few weeks.",
  "Every number in it was counted from what they actually ticked off.",
  "",
  "Return ONLY a JSON object with this exact shape:",
  '{ "persona": string, "focus": string[], "plan": [{ "title": string, "detail": string }] }',
  "- persona: 1-3 sentences, second person, describing their pattern (when they show up, when they slip). <= 280 chars.",
  "- focus: 1-4 short phrases naming exactly what is slipping, each grounded in a number from the data. <= 120 chars each.",
  "- plan: 2-4 concrete, doable steps. title <= 80 chars, detail <= 200 chars. Each step should attach a slipping habit to something already working.",
  "",
  "Rules:",
  "- Only reference habits and numbers that appear in the data. Never invent a task name, a streak, or a percentage.",
  "- Encouraging and specific. Never shaming, never clinical, no medical or mental-health advice.",
  "- If nothing is slipping, say so plainly and keep the plan about holding the line.",
].join("\n");

/** Trim + clamp whatever the model returned into the report shape, or null. */
function normalizeReport(raw) {
  if (!raw || typeof raw !== "object") return null;
  const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const persona = str(raw.persona, 400);
  if (!persona) return null;
  const focus = Array.isArray(raw.focus)
    ? raw.focus.map((f) => str(f, 160)).filter(Boolean).slice(0, 4)
    : [];
  const plan = Array.isArray(raw.plan)
    ? raw.plan
        .map((p) => ({ title: str(p?.title, 100), detail: str(p?.detail, 260) }))
        .filter((p) => p.title || p.detail)
        .slice(0, 4)
    : [];
  return { persona, focus, plan };
}

/**
 * Deterministic coach -- used whenever the model isn't available. Draws only on
 * the signals: the neglected list becomes the focus, the weekday split and the
 * strongest habit drive the plan.
 */
export function fallbackReport(signals) {
  const persona = describePersona(signals);

  const focus = [];
  for (const n of signals.neglected.slice(0, 3)) {
    focus.push(
      n.missStreak >= 5
        ? `${n.title}: skipped ${n.missStreak} days in a row`
        : `${n.title}: done only ${pct(n.rate)}% of the last two weeks`
    );
  }
  if (!focus.length && signals.weakestDays.length) {
    focus.push(`${signals.weakestDays.join(" and ")} are your weakest days`);
  }
  if (!focus.length) focus.push("Nothing is slipping right now -- you're holding every habit.");

  return {
    persona,
    focus,
    plan: buildPlan(signals),
    source: "rule",
    generatedAt: new Date().toISOString(),
  };
}

function describePersona(s) {
  const bits = [];
  if (s.streak >= 3) bits.push(`You're on a ${s.streak}-day streak`);
  else if (s.bestStreak >= 5) bits.push(`Your best run was ${s.bestStreak} days, but the current streak has cooled`);
  else bits.push("You're still finding your rhythm");

  if (s.strongestDays.length && s.weakestDays.length) {
    bits.push(`${s.strongestDays[0]}s are your strongest day and ${s.weakestDays[0]}s are where it tends to slip`);
  } else if (s.overallRate != null) {
    bits.push(`you're clearing about ${pct(s.overallRate)}% of your habits over the last few weeks`);
  }
  if (s.resets > 0) bits.push(`you've restarted ${s.resets} time${s.resets > 1 ? "s" : ""} and kept coming back`);
  return `${bits.join(", ")}.`;
}

function buildPlan(s) {
  const plan = [];
  const strongest = [...s.tasks].filter((t) => t.rate != null).sort((a, b) => b.rate - a.rate)[0];
  const worst = s.neglected[0];

  if (worst && strongest && worst.title !== strongest.title) {
    plan.push({
      title: `Anchor "${worst.title}" to "${strongest.title}"`,
      detail: `You almost never miss "${strongest.title}". Do "${worst.title}" immediately before or after it, same time every day, so it rides on a habit that already sticks.`,
    });
  } else if (worst) {
    plan.push({
      title: `Shrink "${worst.title}" until it's automatic`,
      detail: `Cut it to the smallest version you can't say no to for the next week. Rebuild the streak first, scale it back up after.`,
    });
  }

  if (s.weakestDays.length) {
    plan.push({
      title: `Plan ${s.weakestDays.join(" and ")} the night before`,
      detail: `Those are the days you slip. Each evening before one, write down exactly when each habit happens the next day.`,
    });
  }

  plan.push({
    title: "Do the hardest habit first",
    detail: "Tick your most-skipped task before anything optional. Momentum from an early win carries the rest of the day.",
  });

  if (s.resets > 0) {
    plan.push({
      title: "Protect the streak, don't chase perfection",
      detail: "On a bad day, do the bare-minimum version of every core task. A 40% day keeps the run alive; a zero day is what forces a restart.",
    });
  }

  return plan.slice(0, 4);
}

/**
 * @param {object} signals from buildSignals
 * @param {{apiKey?:string, model?:string, fetchImpl?:Function, timeoutMs?:number}} [opts]
 * @returns {Promise<{persona:string, focus:string[], plan:{title:string,detail:string}[], source:"ai"|"rule", generatedAt:string}>}
 */
export async function coachReport(signals, opts = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL || DEFAULT_MODEL,
    fetchImpl = fetch,
    timeoutMs = 12_000,
  } = opts;

  if (!apiKey) return fallbackReport(signals);

  try {
    const res = await fetchImpl(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(signals) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return fallbackReport(signals);
    const body = await res.json();
    const report = normalizeReport(JSON.parse(body?.choices?.[0]?.message?.content ?? "null"));
    if (!report) return fallbackReport(signals);
    return { ...report, source: "ai", generatedAt: new Date().toISOString() };
  } catch {
    return fallbackReport(signals);
  }
}

/**
 * Stable per-user, per-day fingerprint of the inputs, so the cached report is
 * reused until either the day rolls over or the underlying stats actually move.
 */
export function coachFingerprint(userId, today, signals) {
  const shape = JSON.stringify(signals);
  let h = 5381;
  for (let i = 0; i < shape.length; i++) h = ((h << 5) + h + shape.charCodeAt(i)) | 0;
  return `${userId}:${today}:${h >>> 0}`;
}
