import type { DayCell } from "../types";
import { WORLDS } from "./adventure/content";

// Five environments make up the daily journey. Completing required daily goals
// for 15 consecutive challenge days opens the next world. Story levels and
// elapsed calendar time do not advance this progress.
export const ARC_DAYS = 15;
export const JOURNEY_DAYS = 75;
export const ARC_COUNT = Math.ceil(JOURNEY_DAYS / ARC_DAYS);
export const STORY_ARC_LIMIT = Math.min(WORLDS.length, ARC_COUNT);

export type JourneyProgress = {
  worldIndex: number;
  completedDays: number;
  worldCompletedDays: number;
  dayInWorld: number;
  complete: boolean;
  nextWorldIndex: number | null;
};

/** Derive progress from saved daily goals, including immediately after reload. */
export function journeyProgress(calendar: DayCell[]): JourneyProgress {
  let completedDays = 0;
  while (completedDays < JOURNEY_DAYS && calendar[completedDays]?.status === "done") completedDays++;
  const worldIndex = Math.min(Math.floor(completedDays / ARC_DAYS), STORY_ARC_LIMIT - 1);
  const worldCompletedDays = completedDays - worldIndex * ARC_DAYS;
  return {
    worldIndex,
    completedDays,
    worldCompletedDays,
    dayInWorld: Math.min(worldCompletedDays + 1, ARC_DAYS),
    complete: completedDays === JOURNEY_DAYS,
    nextWorldIndex: worldIndex < STORY_ARC_LIMIT - 1 ? worldIndex + 1 : null,
  };
}

/** 1-indexed arc -> the inclusive [start, end] 1-indexed day numbers it covers. */
export function arcDayRange(arc: number): { start: number; end: number } {
  const clamped = Math.max(1, Math.min(ARC_COUNT, Math.round(arc)));
  return { start: (clamped - 1) * ARC_DAYS + 1, end: Math.min(JOURNEY_DAYS, clamped * ARC_DAYS) };
}

/** A block is complete only when all its required daily goals are banked. */
export function isArcConsistent(calendar: DayCell[], arc: number): boolean {
  const { start, end } = arcDayRange(arc);
  for (let day = start; day <= end; day++) {
    if (calendar[day - 1]?.status !== "done") return false;
  }
  return true;
}

/** World one is available immediately; later worlds require completed blocks. */
export function unlockedArcCount(calendar: DayCell[]): number {
  return journeyProgress(calendar).worldIndex + 1;
}

/** The next daily goal stone, capped at the final day after completion. */
export function unlockedDayCount(calendar: DayCell[]): number {
  return Math.min(journeyProgress(calendar).completedDays + 1, JOURNEY_DAYS);
}

/** Shared environment for every page, earned through required daily goals. */
export function currentWorldIndex(calendar: DayCell[]): number {
  return journeyProgress(calendar).worldIndex;
}

/**
 * Which of a world's 15 day-slots (0-indexed) have ever been marked done,
 * regardless of gaps from missed days elsewhere in the calendar.
 *
 * Deliberately different from journeyProgress's worldCompletedDays, which
 * counts a *consecutive* streak from Day 1 -- that's the intended difficulty
 * gate for unlocking the next world (missing a day should slow you down).
 * A world puzzle piece is a reward for a day you already did, though, and
 * CLAUDE.md's life/penalty rules never let a failure retroactively undo a
 * prior completion -- so once a day's status is "done" its piece must stay
 * revealed even if a *different* day in the same world later gets missed.
 */
export function worldPuzzlePieces(calendar: DayCell[], worldIndex: number): number[] {
  const start = worldIndex * ARC_DAYS;
  const pieces: number[] = [];
  for (let i = 0; i < ARC_DAYS; i++) {
    if (calendar[start + i]?.status === "done") pieces.push(i);
  }
  return pieces;
}
