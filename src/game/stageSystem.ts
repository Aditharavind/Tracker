import type { DayCell } from "../types";
import { WORLDS } from "./adventure/content";
import { ARC_DAYS, currentWorldIndex, JOURNEY_DAYS } from "./weekSystem";

export type StageId = 1 | 2 | 3 | 4 | 5;

export type StageMeta = {
  id: StageId;
  theme: string;
  name: string;
  minDay: number;
  maxDay: number;
};

export const STAGES: StageMeta[] = [
  { id: 1, theme: "entrance", name: WORLDS[0].name, minDay: 1, maxDay: 15 },
  { id: 2, theme: "caves", name: WORLDS[1].name, minDay: 16, maxDay: 30 },
  { id: 3, theme: "grove", name: WORLDS[2].name, minDay: 31, maxDay: 45 },
  { id: 4, theme: "mountains", name: WORLDS[3].name, minDay: 46, maxDay: 60 },
  { id: 5, theme: "valley", name: WORLDS[4].name, minDay: 61, maxDay: 75 },
];

/** Day labels use the same 15-day world boundaries as daily goal progress. */
export function getStage(day: number): StageMeta {
  const clamped = Number.isFinite(day) ? Math.min(JOURNEY_DAYS, Math.max(1, Math.round(day))) : 1;
  return STAGES[Math.floor((clamped - 1) / ARC_DAYS)];
}

/** Active environments follow completed goals, not the number of days elapsed. */
export function getJourneyStage(calendar: DayCell[]): StageMeta {
  return STAGES[currentWorldIndex(calendar)];
}
