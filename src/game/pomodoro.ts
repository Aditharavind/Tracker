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
};

export const WORK_MS = 25 * 60 * 1000;
export const BREAK_MS = 5 * 60 * 1000;

export const initialPomodoro = (): PomodoroState => ({
  phase: "work",
  cycle: 1,
  phaseEndAt: null,
  pausedRemainingMs: WORK_MS,
});

const phaseDuration = (phase: PomodoroPhase) => (phase === "work" ? WORK_MS : BREAK_MS);

/**
 * Fast-forwards a running state through however many phases finished while
 * the tab was closed/backgrounded, so the returned state's phaseEndAt (if
 * still running) is always in the future relative to `now`. A bounded loop
 * -- one iteration per elapsed phase, so even a week away is a few hundred
 * iterations at most.
 */
export function resolvePomodoro(state: PomodoroState, now: number): PomodoroState {
  if (state.phaseEndAt == null) return state;
  let { phase, cycle, phaseEndAt } = state;
  while (now >= phaseEndAt) {
    if (phase === "work") {
      phase = "break";
    } else {
      phase = "work";
      cycle += 1;
    }
    phaseEndAt += phaseDuration(phase);
  }
  return { phase, cycle, phaseEndAt, pausedRemainingMs: state.pausedRemainingMs };
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

export const stop = (): PomodoroState => initialPomodoro();

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
  if (!raw) return initialPomodoro();
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
