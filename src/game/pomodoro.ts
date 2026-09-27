// Per-user Pomodoro focus timer -- a standalone utility bolted onto the
// day-clock badge (CLAUDE.md's "coins/animations must never drive challenge
// state" applies here too: this never reads or writes challenge/task/day
// state, it's just a focus timer). 25min work / 5min break, repeating
// indefinitely until the user hits Stop.
//
// State is derived from a persisted end timestamp (phaseEndAt), the same
// technique DayCountdown.tsx uses for "time left today" -- never a stored
// countdown number that would need per-second writes. That's what makes
// resume-after-reload/tab-close correct: elapsed real time, not frames.

export type PomodoroPhase = "work" | "break";

export type PomodoroState = {
  phase: PomodoroPhase;
  cycle: number; // 1-based count of work phases started this session
  /** ms timestamp the current phase ends at, or null if paused/stopped. */
  phaseEndAt: number | null;
  /** remaining ms in the current phase, only meaningful while paused. */
  pausedRemainingMs: number;
  /** local day (see localDayKey) that completedToday is counted against. */
  completedDay: string;
  /** finished work phases ("study sessions") on completedDay. Unlike
   *  `cycle`, this survives Stop/Reset -- it's a history stat, not part of
   *  the current run -- and rolls over to 0 at local midnight rather than
   *  accumulating forever. */
  completedToday: number;
};

export const WORK_MS = 25 * 60 * 1000;
export const BREAK_MS = 5 * 60 * 1000;

/** Mirrors api.ts's todayISO, but off an explicit timestamp rather than
 * `new Date()` -- resolvePomodoro must stay a pure function of (state, now)
 * so catch-up after a closed tab (and tests) can fast-forward it. */
function localDayKey(ms: number): string {
  const d = new Date(ms);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

/** completedToday only means anything for "today" -- if the stored day has
 * rolled past (including across a Stop, not just a running timer), it
 * resets to 0 instead of carrying yesterday's count forward. */
function carryCompletedCount(state: Pick<PomodoroState, "completedDay" | "completedToday">, now: number) {
  const day = localDayKey(now);
  return day === state.completedDay ? { completedDay: state.completedDay, completedToday: state.completedToday } : { completedDay: day, completedToday: 0 };
}

export const initialPomodoro = (now = Date.now()): PomodoroState => ({
  phase: "work",
  cycle: 1,
  phaseEndAt: null,
  pausedRemainingMs: WORK_MS,
  completedDay: localDayKey(now),
  completedToday: 0,
});

const phaseDuration = (phase: PomodoroPhase) => (phase === "work" ? WORK_MS : BREAK_MS);

/**
 * Fast-forwards a running state through however many phases finished while
 * the tab was closed/backgrounded, so the returned state's phaseEndAt (if
 * still running) is always in the future relative to `now`. A bounded loop
 * -- one iteration per elapsed phase, so even a week away is a few hundred
 * iterations at most.
 *
 * Also normalises completedToday for `now`'s local day -- every work phase
 * that finishes here (including several caught up at once after days away)
 * increments it, keyed to the day it actually finished on, and it's rolled
 * over even when paused/stopped (no loop to run) so reopening the app on a
 * new day doesn't keep showing yesterday's count.
 */
export function resolvePomodoro(state: PomodoroState, now: number): PomodoroState {
  let { completedDay, completedToday } = carryCompletedCount(state, now);
  if (state.phaseEndAt == null) return { ...state, completedDay, completedToday };
  let { phase, cycle, phaseEndAt } = state;
  while (now >= phaseEndAt) {
    if (phase === "work") {
      phase = "break";
      const finishedDay = localDayKey(phaseEndAt);
      if (finishedDay !== completedDay) {
        completedDay = finishedDay;
        completedToday = 0;
      }
      completedToday += 1;
    } else {
      phase = "work";
      cycle += 1;
    }
    phaseEndAt += phaseDuration(phase);
  }
  return { phase, cycle, phaseEndAt, pausedRemainingMs: state.pausedRemainingMs, completedDay, completedToday };
}

export const remainingMs = (state: PomodoroState, now: number): number =>
  state.phaseEndAt == null ? state.pausedRemainingMs : Math.max(0, state.phaseEndAt - now);

export const isRunning = (state: PomodoroState): boolean => state.phaseEndAt != null;

export function startOrResume(state: PomodoroState, now: number): PomodoroState {
  if (state.phaseEndAt != null) return state; // already running
  const remaining = state.pausedRemainingMs > 0 ? state.pausedRemainingMs : phaseDuration(state.phase);
  return { ...state, phaseEndAt: now + remaining };
}

export function pause(state: PomodoroState, now: number): PomodoroState {
  if (state.phaseEndAt == null) return state; // already paused
  return { ...state, phaseEndAt: null, pausedRemainingMs: Math.max(0, state.phaseEndAt - now) };
}

/** Resets the running timer (phase/cycle/pausedRemainingMs) but keeps
 * today's completed-session count -- Reset discards the current run, not
 * the history of sessions already finished today. */
export function stop(state: PomodoroState, now = Date.now()): PomodoroState {
  return { ...initialPomodoro(now), ...carryCompletedCount(state, now) };
}

// ---------------------------------------------------------------- storage

const STORAGE_KEY = "75hard.pomodoro";

type PersistedById = Record<number, PomodoroState>;

function readAll(): PersistedById {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function loadPomodoro(userId: number, now = Date.now()): PomodoroState {
  const raw = readAll()[userId];
  if (!raw) return initialPomodoro(now);
  return resolvePomodoro(raw, now);
}

export function savePomodoro(userId: number, state: PomodoroState): void {
  try {
    const all = readAll();
    all[userId] = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}
