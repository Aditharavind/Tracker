/**
 * Neglected-task detection -- deterministic, derived entirely from the same
 * `completions` rows engine.js already walks. No model, no stored state:
 * recomputed on every request so it can never drift from what was actually
 * ticked (same principle as compute() -- nothing here is a source of truth
 * that could disagree with the real data).
 *
 * "Neglected" is intentionally two independent signals, either one enough:
 *   - a long unbroken run of misses right now (missStreak), or
 *   - a low completion rate over the last two weeks (rate), once there is
 *     enough history to make that number mean anything.
 * A brand-new task (or one that predates the account by only a day or two)
 * never qualifies for either -- see `startDay` / the eligibleDays gate.
 */
import { addDays, diffDays } from "./engine.js";

const MISS_STREAK_THRESHOLD = 5;
const RATE_WINDOW_DAYS = 14;
const RATE_MIN_ELIGIBLE_DAYS = 7;
const RATE_THRESHOLD = 0.3;

const maxDay = (a, b) => (a > b ? a : b);
const dayOf = (isoTimestamp) => String(isoTimestamp).slice(0, 10);

function taskInsight(task, doneDays, floor, today) {
  const startDay = maxDay(floor, dayOf(task.created_at ?? floor));
  const yesterday = addDays(today, -1);

  let missStreak = 0;
  for (let day = yesterday; diffDays(day, startDay) >= 0; day = addDays(day, -1)) {
    if (doneDays.has(day)) break;
    missStreak++;
  }

  const windowStart = maxDay(startDay, addDays(today, -RATE_WINDOW_DAYS));
  const eligibleDays = Math.max(0, diffDays(yesterday, windowStart) + 1);
  let doneInWindow = 0;
  if (eligibleDays > 0) {
    for (let day = windowStart; diffDays(day, yesterday) <= 0; day = addDays(day, 1)) {
      if (doneDays.has(day)) doneInWindow++;
    }
  }
  const rate = eligibleDays > 0 ? doneInWindow / eligibleDays : 1;

  const lastDone = [...doneDays].filter((d) => diffDays(d, yesterday) <= 0).sort().pop() ?? null;

  const flagged =
    missStreak >= MISS_STREAK_THRESHOLD ||
    (eligibleDays >= RATE_MIN_ELIGIBLE_DAYS && rate < RATE_THRESHOLD);

  return {
    taskId: task.id,
    title: task.title,
    isCore: Boolean(task.is_core),
    missStreak,
    rate: Math.round(rate * 100) / 100,
    lastDone,
    flagged,
  };
}

/**
 * @param {{user: object, tasks: object[], completions: {task_id:number, day:string}[]}} data
 * @param {string} today ISO day the caller considers "today" -- never itself
 *   judged (the task can still be done later today).
 * @returns {object[]} flagged tasks, worst first (longest miss streak, then
 *   lowest rate) -- title/isCore/missStreak/rate/lastDone only, no `flagged`.
 */
export function neglectedTasks({ user, tasks, completions }, today) {
  const floor =
    user.restarted_at && user.restarted_at > user.start_date ? user.restarted_at : user.start_date;

  const doneByTask = new Map();
  for (const c of completions) {
    if (!doneByTask.has(c.task_id)) doneByTask.set(c.task_id, new Set());
    doneByTask.get(c.task_id).add(c.day);
  }

  return tasks
    .filter((t) => !t.archived)
    .map((t) => taskInsight(t, doneByTask.get(t.id) ?? new Set(), floor, today))
    .filter((r) => r.flagged)
    .sort((a, b) => b.missStreak - a.missStreak || a.rate - b.rate)
    .map(({ flagged: _flagged, ...rest }) => rest);
}
