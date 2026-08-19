/**
 * Scoring brain -- a direct port of the original Python engine.
 *
 * Everything here is *derived* from the completions rows. Nothing about a
 * streak, a reset or an XP total is stored. That is deliberate: backfilling
 * yesterday morning heals a run that looked broken, and recomputing can never
 * drift out of sync with the checkboxes people actually ticked.
 *
 * Days are plain 'YYYY-MM-DD' strings and all arithmetic goes through UTC, so
 * daylight-saving transitions can't shift a day boundary underneath us.
 */

export const CHALLENGE_LENGTH = 75;
export const TASK_XP = 10;
export const PERFECT_DAY_XP = 40;

export const DAY_BADGES = [
  [3, "Ignition", "Three days deep. The hard part is behind you."],
  [7, "One Week", "A full week without a miss."],
  [14, "Fortnight", "Two weeks. This is a routine now."],
  [21, "Habit Formed", "Twenty-one days -- it stops being a decision."],
  [30, "Thirty Strong", "A month of showing up."],
  [50, "Golden Fifty", "Two thirds. Nobody quits from here."],
  [60, "Home Stretch", "Sixty days. Fifteen to go."],
  [CHALLENGE_LENGTH, "75 HARD", "Finished. You did the whole thing."],
];

// Tuned so a full clean 75 days lands right around Legend (~9.5k XP) instead
// of topping out somewhere in the forties.
export const LEVELS = [
  [0, "Rookie"],
  [400, "Grinder"],
  [1000, "Relentless"],
  [1900, "Iron"],
  [3200, "Savage"],
  [5000, "Unbreakable"],
  [7500, "Legend"],
];

const DAY_MS = 86_400_000;

const toUTC = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso, n) => fromUTC(toUTC(iso) + n * DAY_MS);

/** Whole days from `b` to `a`; negative when `a` is earlier. */
export const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / DAY_MS);

export function levelFor(xp) {
  let idx = 0;
  LEVELS.forEach(([floor], i) => {
    if (xp >= floor) idx = i;
  });
  const [floor, name] = LEVELS[idx];
  const ceiling = idx + 1 < LEVELS.length ? LEVELS[idx + 1][0] : null;
  return { level: idx + 1, name, floor, ceiling };
}

/**
 * @param {{user: object, tasks: object[], completions: {task_id: number, day: string}[]}} data
 * @param {string} today  ISO day the caller considers "now"
 */
export function compute({ user, tasks, completions }, today) {
  const coreIds = new Set(tasks.filter((t) => t.is_core).map((t) => t.id));

  const doneByDay = new Map();
  for (const c of completions) {
    if (!doneByDay.has(c.day)) doneByDay.set(c.day, new Set());
    doneByDay.get(c.day).add(c.task_id);
  }

  const dayStats = (day) => {
    const done = doneByDay.get(day) ?? new Set();
    let coreDone = 0;
    for (const id of coreIds) if (done.has(id)) coreDone += 1;
    return {
      done: coreDone,
      total: coreIds.size,
      perfect: coreIds.size > 0 && coreDone === coreIds.size,
    };
  };

  // Walk every day since the user joined. Two things are tracked at once:
  //
  //  * lifetime stats (best streak, perfect days, XP) over the whole history,
  //    so trophies you have already earned can never be taken back;
  //  * the current run, which additionally cannot start before restarted_at --
  //    the "I blew it, start over" button moves that forward without
  //    pretending the earlier days never happened.
  const floor =
    user.restarted_at && user.restarted_at > user.start_date
      ? user.restarted_at
      : user.start_date;

  let runStart = floor;
  let bestStreak = 0;
  let resets = 0;
  let perfectDaysEver = 0;
  let lifetimeRun = 0;
  let currentRun = 0;

  for (let day = user.start_date; diffDays(day, today) < 0; day = addDays(day, 1)) {
    const { perfect } = dayStats(day);

    if (perfect) {
      lifetimeRun += 1;
      perfectDaysEver += 1;
      bestStreak = Math.max(bestStreak, lifetimeRun);
    } else {
      // A run of zero means we're already inside a dead patch -- only the day
      // that actually broke a live streak counts as a reset.
      if (lifetimeRun > 0) resets += 1;
      lifetimeRun = 0;
    }

    if (diffDays(day, floor) < 0) continue; // before the current run began

    if (perfect) {
      currentRun += 1;
    } else {
      currentRun = 0;
      runStart = addDays(day, 1);
    }
  }

  const todayStats = dayStats(today);
  if (todayStats.perfect) {
    perfectDaysEver += 1;
    bestStreak = Math.max(bestStreak, currentRun + 1);
  }

  const streak = currentRun + (todayStats.perfect ? 1 : 0);
  const dayNumber = diffDays(today, runStart) + 1;

  let totalCompletions = 0;
  for (const set of doneByDay.values()) totalCompletions += set.size;

  let xp = totalCompletions * TASK_XP + perfectDaysEver * PERFECT_DAY_XP;
  for (const [threshold] of DAY_BADGES) {
    if (bestStreak >= threshold) xp += threshold * 5;
  }

  const lvl = levelFor(xp);

  const badges = DAY_BADGES.map(([day, name, blurb]) => ({
    day,
    name,
    blurb,
    earned: bestStreak >= day,
  }));

  const calendar = [];
  for (let i = 0; i < CHALLENGE_LENGTH; i += 1) {
    const day = addDays(runStart, i);
    const { done, total, perfect } = dayStats(day);
    // Only three states are reachable here: any past day that wasn't perfect
    // would have moved runStart past it, so every in-run day before today is
    // perfect by construction.
    let status;
    if (diffDays(day, today) > 0) status = "future";
    else if (day === today) status = perfect ? "done" : "today";
    else status = "done";
    calendar.push({ day, index: i + 1, status, done, total });
  }

  return {
    user_id: user.id,
    name: user.name,
    color: user.color,
    run_start: runStart,
    day_number: Math.min(dayNumber, CHALLENGE_LENGTH),
    streak,
    best_streak: bestStreak,
    resets,
    completed_today: todayStats.done,
    core_today: todayStats.total,
    perfect_today: todayStats.perfect,
    xp,
    level: lvl.level,
    level_name: lvl.name,
    level_floor: lvl.floor,
    level_ceiling: lvl.ceiling,
    perfect_days_ever: perfectDaysEver,
    badges,
    next_badge: badges.find((b) => !b.earned) ?? null,
    calendar,
  };
}

export function dayDetail({ tasks, doneIds, note }, day) {
  const items = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    emoji: t.emoji,
    is_core: t.is_core,
    locked: Boolean(t.locked),
    reps_target: t.reps_target ?? null,
    done: doneIds.has(t.id),
  }));
  return {
    day,
    tasks: items,
    pending: items.filter((i) => !i.done),
    note: note ?? "",
  };
}
