import type { DayCell } from "../types";
import { WORLDS } from "./adventure/content";

// The week-unlock map (skill: WeekMap) gates Story Mode's worlds by real
// weekly consistency instead of Adventure's own day-number ceiling (see
// content.ts's storyWorldUnlockDay) -- completing every day of week W is
// always reached on or after that world's day-based ceiling, so this is
// strictly the harder of the two gates and Adventure's own gate never has
// to change. One week stone per world: this is not an independent length.
export const WEEK_COUNT = WORLDS.length;

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
