import type { DayCell } from "../types";
import { WORLDS } from "./adventure/content";

// The stone-path map (skill: WeekMap) gates Story Mode's worlds by real
// day-by-day consistency instead of Adventure's own day-number ceiling (see
// content.ts's storyWorldUnlockDay) -- completing every day of a 15-day arc
// is always reached on or after that world's day-based ceiling, so this is
// strictly the harder of the two gates and Adventure's own gate never has
// to change.
//
// ARC_DAYS is the Candy-Crush-style stone count per arc -- 15 stones, the
// 15th a "wormhole" into the next world. ARC_COUNT tracks the challenge's
// own calendar (75 days / 15 -- exact, no partial arc). STORY_ARC_LIMIT is
// how many arcs actually have a world behind them right now (one per world,
// in order): with 5 arcs in a single 75-day run and 8 worlds authored, only
// the first 5 are reachable in one run -- worlds 6-8 wait for a longer/
// future run rather than being renumbered or dropped.
export const ARC_DAYS = 15;
export const ARC_COUNT = Math.ceil(75 / ARC_DAYS);
export const STORY_ARC_LIMIT = Math.min(WORLDS.length, ARC_COUNT);

/** 1-indexed arc -> the inclusive [start, end] 1-indexed day numbers it covers. */
export function arcDayRange(arc: number): { start: number; end: number } {
  const clamped = Math.max(1, Math.min(ARC_COUNT, Math.round(arc)));
  return { start: (clamped - 1) * ARC_DAYS + 1, end: Math.min(75, clamped * ARC_DAYS) };
}

/**
 * An arc's wormhole is open only when every one of its ARC_DAYS days is
 * actually banked as done -- a day still pending (today, or not yet
 * reached) does NOT count, and neither does a partial day. `calendar` is the
 * same DayCell[] the rest of the app already treats as the source of truth
 * (skill's Progress.calendar), 0-indexed by day number - 1.
 */
export function isArcConsistent(calendar: DayCell[], arc: number): boolean {
  const { start, end } = arcDayRange(arc);
  for (let day = start; day <= end; day++) {
    if (calendar[day - 1]?.status !== "done") return false;
  }
  return true;
}

/**
 * How many arc-stones are unlocked, counting from arc 1. Arc 1 is always
 * open (mirrors Adventure's own "World 1 on Day 1" decision -- there should
 * be something to reach for immediately). Arc a+1 unlocks only once arc a
 * itself was fully consistent, so a stretch of missed days simply stops the
 * count there rather than skipping ahead once the days pass.
 */
export function unlockedArcCount(calendar: DayCell[]): number {
  let unlocked = 1;
  while (unlocked < ARC_COUNT && isArcConsistent(calendar, unlocked)) unlocked++;
  return unlocked;
}

/**
 * How many day-stones the panda has actually walked to, on the 15-per-arc
 * trail map -- consecutive "done" days counted from day 1 (so a gap stops
 * the count there, same shape as unlockedArcCount, just at day instead of
 * arc granularity). This is NOT gated by arc completeness: the panda can
 * walk day by day through an arc that isn't done yet, it just can't step
 * through a wormhole (see isArcConsistent) until every day behind it is.
 * In practice a day can't go "done" out of order anyway (the challenge's
 * own day-progression is sequential), so this loop is defensive rather than
 * load-bearing, same as unlockedArcCount's.
 */
export function unlockedDayCount(calendar: DayCell[]): number {
  let day = 1;
  while (day < 75 && calendar[day - 1]?.status === "done") day++;
  return day;
}

/**
 * Which Story world's environment the rest of the game (Forest Dash, and
 * eventually the daily climb itself) should currently be painted in --
 * shared across surfaces so progressing an arc visibly changes more than
 * just the trail map. Arc 1 maps to world 0 ("The Sleeping Forest"), which
 * is deliberately the same forest look the game already opens in -- nothing
 * changes until real progress actually earns a new one. Clamped to
 * STORY_ARC_LIMIT since arcs past that don't have a world yet.
 */
export function currentWorldIndex(calendar: DayCell[]): number {
  return Math.min(unlockedArcCount(calendar), STORY_ARC_LIMIT) - 1;
}
