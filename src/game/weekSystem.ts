import type { DayCell } from "../types";
import { WORLDS } from "./adventure/content";

// The week-unlock map (skill: WeekMap) gates Story Mode's worlds by real
// weekly consistency instead of Adventure's own day-number ceiling (see
// content.ts's storyWorldUnlockDay) -- completing every day of week W is
// always reached on or after that world's day-based ceiling, so this is
// strictly the harder of the two gates and Adventure's own gate never has
// to change.
//
// WEEK_COUNT tracks the challenge's own calendar (75 days / 7 -- an 11th,
// partial week of 5 days still counts as a week), independent of how many
// Story worlds exist. STORY_WEEK_LIMIT is how many of those weeks actually
// have a world behind them right now (one per world, in order) -- weeks
// past that still unlock and count as real milestones, they just don't open
// a Story world yet.
export const WEEK_COUNT = Math.ceil(75 / 7);
export const STORY_WEEK_LIMIT = WORLDS.length;

/** 1-indexed week -> the inclusive [start, end] 1-indexed day numbers it covers. */
export function weekDayRange(week: number): { start: number; end: number } {
  const clamped = Math.max(1, Math.min(WEEK_COUNT, Math.round(week)));
  return { start: (clamped - 1) * 7 + 1, end: clamped * 7 };
}

/**
 * A week is "consistent" only when every one of its 7 days is actually
 * banked as done -- a day still pending (today, or not yet reached) does
 * NOT count, and neither does a partial day. `calendar` is the same
 * DayCell[] the rest of the app already treats as the source of truth
 * (skill's Progress.calendar), 0-indexed by day number - 1.
 */
export function isWeekConsistent(calendar: DayCell[], week: number): boolean {
  const { start, end } = weekDayRange(week);
  for (let day = start; day <= end; day++) {
    if (calendar[day - 1]?.status !== "done") return false;
  }
  return true;
}

/**
 * How many week-stones are unlocked, counting from week 1. Week 1 is always
 * open (mirrors Adventure's own "World 1 on Day 1" decision -- there should
 * be something to reach for immediately). Week w+1 unlocks only once week w
 * itself was fully consistent, so a stretch of missed days simply stops the
 * count there rather than skipping ahead once the days pass.
 */
export function unlockedWeekCount(calendar: DayCell[]): number {
  let unlocked = 1;
  while (unlocked < WEEK_COUNT && isWeekConsistent(calendar, unlocked)) unlocked++;
  return unlocked;
}

/**
 * Which Story world's environment the rest of the game (Forest Dash, and
 * eventually the daily climb itself) should currently be painted in --
 * shared across surfaces so progressing a week visibly changes more than
 * just the trail map. Week 1 maps to world 0 ("The Sleeping Forest"), which
 * is deliberately the same forest look the game already opens in -- nothing
 * changes until real progress actually earns a new one. Clamped to
 * STORY_WEEK_LIMIT since weeks past that don't have a world yet.
 */
export function currentWorldIndex(calendar: DayCell[]): number {
  return Math.min(unlockedWeekCount(calendar), STORY_WEEK_LIMIT) - 1;
}
