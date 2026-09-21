import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, Settings as SettingsIcon } from "lucide-react";
import { api, deviceTimezone, isPermanentFailure, shiftISO, todayISO } from "./api";
import * as outbox from "./outbox";
import type { CoachReport, DayDetail, Progress, TaskItem, User } from "./types";
import { LAST_USER_KEY } from "./constants";
import Onboard from "./components/Onboard";
import LoadingPage from "./components/LoadingPage";
import Checklist from "./components/Checklist";
import LevelRing from "./components/LevelRing";
import type { AvatarId } from "./components/Runner";
import ForestScene from "./components/forest/ForestScene";
// The Phaser migration's first slice (see src/game/'s PhaserGame.ts) -- only
// the Forest Entrance environment so far, gated behind ?engine=phaser and
// lazy-loaded so the ~1MB Phaser runtime never reaches anyone who hasn't
// opted in.
const PhaserForestScene = lazy(() => import("./components/forest/PhaserForestScene"));
const CoachChat = lazy(() => import("./components/CoachChat"));
const Minigames = lazy(() => import("./components/Minigames"));
const WeekMap = lazy(() => import("./components/forest/WeekMap"));
const Calendar75 = lazy(() => import("./components/Calendar75"));
const Badges = lazy(() => import("./components/Badges"));
const Rivals = lazy(() => import("./components/Rivals"));
const DashLeaderboard = lazy(() => import("./components/DashLeaderboard"));
const Coach = lazy(() => import("./components/Coach"));
const CharacterSelect = lazy(() => import("./components/CharacterSelect"));
const DayCompleteOverlay = lazy(() => import("./components/forest/DayCompleteOverlay"));
const DayStartBanner = lazy(() => import("./components/forest/DayStartBanner"));
const WorldsScreen = lazy(() => import("./components/WorldsScreen"));
const StoryLauncher = lazy(() => import("./components/forest/StoryLauncher"));
const WorldUnlockOverlay = lazy(() => import("./components/forest/WorldUnlockOverlay"));
import LivesHUD from "./components/forest/LivesHUD";
import DayCountdown from "./components/forest/DayCountdown";
import { CoinIcon } from "./components/forest/Coin";
import { getJourneyStage, type StageMeta } from "./game/stageSystem";
import { journeyProgress, worldPuzzlePieces } from "./game/weekSystem";
import { WORLDS } from "./game/adventure/content";
import { isAlarmDue, toMinutes } from "./game/alarm";
import { isStandalone, useInstallPrompt } from "./installPrompt";
import { CHARACTERS, isCharacterId, type CharacterId } from "./game/characters";
import CharacterCarousel from "./components/CharacterCarousel";
import FailureBanner from "./components/forest/FailureBanner";
import SnoozePanda from "./components/SnoozePanda";
import { playAlarmSiren, primeAudio } from "./discoSound";
import { isMuted, playPomodoroChime, primeJump, toggleMuted } from "./sound";
import {
  isRunning as pomodoroIsRunning,
  loadPomodoro,
  pause as pomodoroPause,
  remainingMs as pomodoroRemainingMs,
  resolvePomodoro,
  savePomodoro,
  startOrResume as pomodoroStartOrResume,
  stop as pomodoroStop,
  type PomodoroState,
} from "./game/pomodoro";
import { maybeRemind, shouldOfferPrompt } from "./notifications";
import PandaPeekPrompt from "./components/PandaPeekPrompt";

const LAST_USER = LAST_USER_KEY;
const AVATAR_KEY = "75hard.avatar";
const CHARACTER_KEY = "75hard.character";
// Same artwork as the first-run character-select gate (CharacterSelect.tsx)
// -- Profile's "choose your character" hero reuses it so re-picking a
// character reads as the same screen, not a second, differently-dressed one.
const PROFILE_CHARACTER_SCENE = "/assets/character_selection/character_selection-wide.jpg";
const SNOOZE_KEY = "75hard.snooze";
// Set on sign-out. Without it the same-IP suggestion in the bootstrap effect
// below signs you straight back in on the next load, which makes signing out
// look broken. Cleared as soon as any user is chosen again.
const SIGNED_OUT_KEY = "75hard.signedout";
const SNOOZE_MIN = 5;

/**
 * Snooze and dismiss are the same mechanism: a per-user deadline before which
 * the alarm stays quiet. Snooze sets one a few minutes out, dismiss sets one at
 * the end of the local day. It has to survive a reload -- the phone goes back
 * on the nightstand during a snooze, and a browser that reaps the tab and
 * restores it shouldn't be a way to get the siren back.
 */
const storedSnooze = (): Record<number, number> => {
  try {
    const raw = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
};

const SNAPSHOT_KEY = "75hard.snapshot.v1";

type Snapshot = {
  userId: number;
  day: string;
  users: User[];
  board: Progress[];
  detail: DayDetail;
};

/**
 * Last known board, kept on the device so a return visit paints real content
 * on the first frame instead of a loading skeleton.
 *
 * The service worker already caches the code, but the *data* needed four
 * chained API calls before anything could render -- suggest, then users and
 * board, then the day. On a phone that is most of the wait: the app was
 * sitting there fully loaded, waiting on round trips. This is the stale half
 * of stale-while-revalidate; the fetches still run and replace it.
 */
const readSnapshot = (): Snapshot | null => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot | null;
    if (!s || !s.users?.length || !s.detail) return null;
    // A snapshot from another day is worse than none: day number, streak and
    // the calendar are all computed against "today", so yesterday's would be
    // visibly wrong for as long as it took the refetch to land.
    if (s.day !== todayISO()) return null;
    // Only for whoever this device is signed in as.
    if (s.userId !== (Number(localStorage.getItem(LAST_USER)) || null)) return null;
    return s;
  } catch {
    return null;
  }
};

/**
 * Who this device last signed in as, read synchronously at boot.
 *
 * The bootstrap effect below already reads this key to decide which board to
 * ask for, but `meId` itself was only ever seeded from the snapshot -- so on
 * any load without a same-day snapshot (a new day, cleared storage, a fresh
 * device) the day fetch could not start until /users came back and told it
 * whose day to ask for. That serialised two round trips which have no reason
 * to be ordered: the id was sitting in localStorage the whole time.
 *
 * Measured cold on a throttled phone, /day did not leave the device until
 * 2799ms and landed at 4342ms, entirely behind /users.
 *
 * signOut removes this key, so a signed-out device seeds nothing and still
 * lands on onboarding.
 */
const storedUserId = (): number | null => {
  try {
    return Number(localStorage.getItem(LAST_USER)) || null;
  } catch {
    return null;
  }
};

/** Local midnight tonight, so a dismiss lasts exactly until tomorrow's alarm. */
const msUntilTomorrow = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime() - Date.now();
};

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M14 2 2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="18" height="17" viewBox="0 0 18 17" fill="none" aria-hidden="true">
      <path
        d="M2 8 9 1.5 16 8v7.5a1 1 0 0 1-1 1h-3.5V11h-5v5.5H3a1 1 0 0 1-1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStats() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="9" width="3.4" height="5.5" rx="0.8" fill="currentColor" />
      <rect x="6.3" y="4.5" width="3.4" height="10" rx="0.8" fill="currentColor" />
      <rect x="11.1" y="1.5" width="3.4" height="13" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.2" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.8 14.5c0.9-3.4 3.7-5 6.2-5s5.3 1.6 6.2 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <path d="M4.5 2h8v4.2a4 4 0 0 1-8 0Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path
        d="M4.5 3H2.2a1 1 0 0 0-1 1.2c0.4 2 1.7 3.3 3.3 3.6M12.5 3h2.3a1 1 0 0 1 1 1.2c-0.4 2-1.7 3.3-3.3 3.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M8.5 10.2V13M6 15h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconSoundOn() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <path d="M3 6h2.5L9 3v11L5.5 11H3Z" fill="currentColor" />
      <path d="M11.4 5.6a4 4 0 0 1 0 5.8M13.2 3.6a6.6 6.6 0 0 1 0 9.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSoundOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <path d="M3 6h2.5L9 3v11L5.5 11H3Z" fill="currentColor" />
      <path d="M11.5 6.5 15 10M15 6.5 11.5 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <path d="M8.5 1.8v8.4M5.4 7.1l3.1 3.1 3.1-3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.2 12v1.6a1.4 1.4 0 0 0 1.4 1.4h9.8a1.4 1.4 0 0 0 1.4-1.4V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRestart() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M11.5 7a4.5 4.5 0 1 1-1.7-3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M11.6 1.4V4H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 1.8v12.4l10-6.2Z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="3.4" height="12" rx="0.8" fill="currentColor" />
      <rect x="9.6" y="2" width="3.4" height="12" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function IconTimer() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M7 1.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 3.3V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 7.3V10.5L11.3 12.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCoach() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 1.5 10.2 5.8 14.5 7 10.2 8.2 9 12.5 7.8 8.2 3.5 7 7.8 5.8Z"
        fill="currentColor"
      />
      <path d="M14.5 11.5 15.1 13.4 17 14 15.1 14.6 14.5 16.5 13.9 14.6 12 14 13.9 13.4Z" fill="currentColor" />
    </svg>
  );
}

const storedAvatars = (): Record<number, AvatarId> => {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

// Which forest character (panda/koala/red panda) each user has picked. Purely
// cosmetic and client-side, same shape and storage pattern as storedAvatars
// above -- an absent entry is what drives the mandatory character-select gate
// in App() (see `myCharacter`), not a fallback to a default character.
const storedCharacters = (): Record<number, CharacterId> => {
  try {
    const raw = localStorage.getItem(CHARACTER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<number, CharacterId> = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (isCharacterId(v)) out[Number(id)] = v;
    }
    return out;
  } catch {
    return {};
  }
};

function ShareDialog({
  name,
  url,
  kind,
  onClose,
}: {
  name: string;
  url: string;
  kind: "share" | "invite";
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const copy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => setCopied(true))
      .catch(() => inputRef.current?.select());
  };

  return (
    <div className="pin-backdrop" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{kind === "share" ? `Share ${name}'s progress` : "Invite to the lobby"}</h3>
        <p className="muted">
          {kind === "share"
            ? "Read only -- no PIN, no editing. Works for anyone who has the link."
            : "Anyone with this link can join your lobby as a real, editable member and start their own run."}
        </p>
        <input
          ref={inputRef}
          className="field"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button className="btn primary wide" onClick={copy}>
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button className="btn ghost wide" style={{ marginTop: 8 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/** In-game styled stand-in for window.confirm() -- a native browser popup
 * reads as a "web warning" (jarring chrome, no relation to the pixel-art
 * game around it) rather than part of the app. Same pin-backdrop overlay
 * as ShareDialog/PinModal so it matches the rest of the app's modals. */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="pin-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="muted">{message}</p>
        <button className={`btn wide${danger ? " danger" : " primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn ghost wide" style={{ marginTop: 8 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function MinigamePicker({
  onPickRunner,
  onPickAdventure,
  onCancel,
}: {
  onPickRunner: () => void;
  onPickAdventure: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="pin-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Choose a minigame</h3>
        <button className="btn wide primary" onClick={onPickRunner}>
          Forest Dash
        </button>
        <button className="btn wide primary" style={{ marginTop: 8 }} onClick={onPickAdventure}>
          Story Adventure
        </button>
        <button className="btn ghost wide" style={{ marginTop: 8 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const formatMMSS = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * A standalone focus timer opened from the day-clock badge -- 25min work /
 * 5min break, repeating until Stop. Per-user (keyed by `userId` in
 * game/pomodoro.ts's localStorage record) so switching players never shows
 * or clobbers someone else's running session. Deliberately outside the
 * 75-day challenge's own state: never touches tasks/lives/coins/streak (see
 * CLAUDE.md's "coins/animations must never drive challenge state" --
 * applies just as much to a feature that isn't coins/animation but still
 * isn't the challenge itself).
 *
 * Closing this panel (the X button) does NOT stop a running timer -- same
 * as DayCountdown, it just stops being shown. The state is re-derived from
 * the persisted phaseEndAt timestamp next time it's opened (or the app is
 * reloaded), catching up through however many phases elapsed while it was
 * closed (game/pomodoro.ts's resolvePomodoro).
 */
function PomodoroPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [state, setState] = useState<PomodoroState>(() => loadPomodoro(userId));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Prefer landscape for this panel on a mobile PWA -- the clock reads
  // better wide than tall, and this is the one screen in the app where
  // that's worth asking for. Scoped to just this panel (not the manifest's
  // app-wide orientation, which every other screen still ignores) via the
  // Screen Orientation API, which only works in an already-fullscreen/
  // standalone context -- so this no-ops for anyone browsing in a normal
  // mobile tab. It also has zero support on iOS Safari (Apple has never
  // implemented the lock() method), so there this is silently a no-op too:
  // the CSS's `@media (orientation: landscape)` layout below still kicks in
  // if the phone happens to already be held sideways, but nothing here can
  // force that to happen on iOS. Unlocked again on close so the rest of the
  // app goes back to rotating freely.
  useEffect(() => {
    if (!isStandalone()) return;
    const orientation = screen.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void })
      | undefined;
    if (!orientation?.lock) return;
    orientation.lock("landscape").catch(() => {
      /* unsupported context (not fullscreen, or a browser without lock()) -- fine, see comment above */
    });
    return () => {
      try {
        orientation.unlock?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Re-resolve every tick so a phase boundary crossed while this panel is
  // open (not just while it was closed) still advances phase/cycle, plays
  // the chime, and persists -- the same resolvePomodoro used for
  // resume-after-reload, just driven by the live clock instead of mount time.
  useEffect(() => {
    setState((prev) => {
      const resolved = resolvePomodoro(prev, now);
      if (resolved === prev) return prev;
      savePomodoro(userId, resolved);
      if (resolved.phaseEndAt != null) playPomodoroChime();
      return resolved;
    });
  }, [now, userId]);

  const remaining = pomodoroRemainingMs(state, now);
  const running = pomodoroIsRunning(state);
  const resuming = !running && state.pausedRemainingMs > 0 && state.pausedRemainingMs < (state.phase === "work" ? 25 * 60 * 1000 : 5 * 60 * 1000);

  const act = (next: PomodoroState) => {
    setState(next);
    savePomodoro(userId, next);
  };

  // Tapping the clock face itself toggles start/pause -- the primary
  // interaction is "touch the timer to run it", same as tapping a physical
  // kitchen timer, rather than a separate Start/Pause button competing for
  // attention with the clock it controls. Stop stays a distinct button
  // since discarding the session isn't a natural "tap the clock" gesture.
  const toggleRunning = () =>
    act(running ? pomodoroPause(state, Date.now()) : pomodoroStartOrResume(state, Date.now()));

  return (
    <div className="panel-drawer pomodoro-drawer">
      <div className="panel-drawer-head">
        <button className="panel-close" aria-label="Close" title="Close" onClick={onClose}>
          <IconClose />
        </button>
      </div>

      <div
        className="pomodoro-body"
        role="timer"
        aria-label={`${state.phase === "work" ? "Focus" : "Break"} phase, cycle ${state.cycle}, ${formatMMSS(remaining)} remaining, ${running ? "running" : "paused"}`}
      >
        <h2 className="pomodoro-title pixel-font" aria-hidden="true">
          Pomodoro
        </h2>

        <div className={`pomodoro-phase pixel-font ${state.phase}`} aria-hidden="true">
          {state.phase === "work" ? "FOCUS" : "BREAK"}
        </div>

        <button
          type="button"
          className="day-clock pomodoro-clock pomodoro-clock-btn"
          onClick={toggleRunning}
          aria-label={running ? "Pause the timer" : resuming ? "Resume the timer" : "Start the timer"}
          title={running ? "Pause the timer" : resuming ? "Resume the timer" : "Start the timer"}
        >
          <img className="day-clock-frame" src="/assets/day-clock-frame.webp" alt="" aria-hidden="true" />
          <div className="day-clock-readout" aria-hidden="true">
            <span className="day-clock-time pixel-font">{formatMMSS(remaining)}</span>
          </div>
        </button>
        <div className="pomodoro-tap-hint muted" aria-hidden="true">
          {running ? <IconPause /> : <IconPlay />}
          {running ? "TAP TO PAUSE" : resuming ? "TAP TO RESUME" : "TAP TO START"}
        </div>

        <div className="pomodoro-cycle muted" aria-hidden="true">
          Cycle {state.cycle}
        </div>

        <div className="pomodoro-controls">
          <button className="btn ghost" onClick={() => act(pomodoroStop())} title="Reset the timer">
            <IconRestart /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function AlarmOverlay({
  task,
  onDone,
  onSnooze,
  onDismiss,
}: {
  task: TaskItem;
  onDone: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const stop = playAlarmSiren();
    return stop;
  }, []);

  return (
    <div className="alarm-overlay">
      <div className="alarm-emoji">⏰</div>
      <h1>Time to get up</h1>
      <p>{task.title} -- and it only counts once you've actually done them.</p>
      <button className="btn primary wide alarm-btn" onClick={onDone}>
        Done -- {task.reps_target ?? 20} reps
      </button>
      <div className="alarm-secondary">
        <button className="btn ghost alarm-ghost" onClick={onSnooze}>
          Snooze {SNOOZE_MIN} min
        </button>
        <button className="btn ghost alarm-ghost" onClick={onDismiss}>
          Dismiss for today
        </button>
      </div>
    </div>
  );
}

/**
 * Mirrors the real game-shell layout's boxes so the page doesn't jump when
 * data lands -- shown while the first requests are in flight. Reuses the
 * actual layout classes (game-topbar/stage-area/day-card-float/bottomnav)
 * for correct positioning/sizing rather than a parallel set of skeleton-only
 * layout rules, so it can't drift out of sync with the real shell.
 */
function Skeleton() {
  return <LoadingPage label="Loading run" />;
}

export default function App() {
  // Read once, lazily, before any state that seeds from it.
  const [boot] = useState(readSnapshot);
  const [users, setUsers] = useState<User[] | null>(boot?.users ?? null);
  const [meId, setMeId] = useState<number | null>(boot?.userId ?? storedUserId());
  const [board, setBoard] = useState<Progress[]>(boot?.board ?? []);
  const [day, setDay] = useState(todayISO());
  const [detail, setDetail] = useState<DayDetail | null>(boot?.detail ?? null);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<string | null>(null);
  // Value unused since the Runner-avatar picker was removed; the setter still
  // persists the pick chosen during onboarding.
  const [, setAvatars] = useState<Record<number, AvatarId>>(storedAvatars);
  const [pendingAvatar, setPendingAvatar] = useState<AvatarId>("guy");
  const [characters, setCharacters] = useState<Record<number, CharacterId>>(storedCharacters);
  const [adding, setAdding] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [confirmRestartOpen, setConfirmRestartOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<null | "leaderboard" | "stats" | "habits" | "profile" | "pomodoro" | "coach">(
    null
  );
  const [habitDraft, setHabitDraft] = useState("");
  const [snoozed, setSnoozed] = useState<Record<number, number>>(storedSnooze);
  const [waving, setWaving] = useState(false);
  const [livesOpen, setLivesOpen] = useState(false);
  const [dayCompleteOpen, setDayCompleteOpen] = useState(false);
  const [worldUnlock, setWorldUnlock] = useState<StageMeta | null>(null);
  const [showPeek, setShowPeek] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  // Story introduces the current environment before returning to daily goals.
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyWorld, setStoryWorld] = useState<number | undefined>(undefined);
  const [storyStartsInAdventure, setStoryStartsInAdventure] = useState(false);
  // The world map is a stones-only readout of the current world's 15 days --
  // no story or minigame launches from it, see WeekMap.tsx. Now the app's
  // landing page (defaults open): every fresh load shows the trail first,
  // and tapping the current day's stone reveals the task/forest view
  // underneath (see the day-start banner this triggers, below).
  const [weekMapOpen, setWeekMapOpen] = useState(true);
  const [dayStartBannerOpen, setDayStartBannerOpen] = useState(false);
  const [worldsScreenOpen, setWorldsScreenOpen] = useState(false);
  // ▶ MINIGAME opens a choice between the two minigames instead of launching
  // Forest Dash directly, now that the Story Adventure (with its day-15
  // boss) no longer has any other entry point in the main UI.
  const [minigamePickerOpen, setMinigamePickerOpen] = useState(false);
  // Opt-in preview of the Phaser rebuild of the Forest Entrance environment
  // (?engine=phaser) -- read once; the rest of the app is unaffected either
  // way. See src/game/PhaserGame.ts for the migration this is the first
  // slice of.
  const [usePhaserEngine] = useState(() => new URLSearchParams(window.location.search).get("engine") === "phaser");
  const [muted, setMuted] = useState(isMuted);
  const installState = useInstallPrompt();
  // Wake-up alarm settings. Until now the only way to set these was the signup
  // form, whose checkbox defaults to off -- so anyone who skipped it could
  // never turn the alarm on afterwards, and anyone who took it could never
  // turn it off. api.setWake existed the whole time with nothing calling it.
  const [wakeOn, setWakeOn] = useState(false);
  const [wakeAt, setWakeAt] = useState("06:00");
  const [wakeReps, setWakeReps] = useState(20);
  const [wakeBusy, setWakeBusy] = useState(false);
  // Which user the form below has been filled in for, so a board refresh
  // doesn't overwrite what someone is halfway through typing.
  const wakeSeeded = useRef<number | null>(null);
  const [dashBoard, setDashBoard] = useState<
    { name: string; color: string; coins: number; distance: number }[]
  >([]);
  const [coach, setCoach] = useState<CoachReport | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  // WebLLM adds a multi-megabyte runtime to the page and its model is a much
  // larger first-use download. Keep that work behind its own explicit action;
  // opening the lightweight coaching report should stay fast.
  const [coachChatOpen, setCoachChatOpen] = useState(false);
  // Set whenever a write (tick / note / restart) is rejected, so the UI can
  // stop pretending the optimistic change was committed. Cleared by the next
  // clean write or a successful refetch.
  const [saveError, setSaveError] = useState<string | null>(null);
  const tzSynced = useRef(false);
  // True while the user is looking at "today" (not a deliberately-opened past
  // day). When true, a midnight / app-resume rollover moves `day` forward so a
  // PWA left open across midnight doesn't get stuck showing (and writing to)
  // yesterday.
  const followToday = useRef(true);
  const [, forceTick] = useState(0);
  const todayRef = useRef(todayISO());
  const minuteRef = useRef("");
  const noteTimer = useRef<number | undefined>(undefined);
  const waveTimer = useRef<number | undefined>(undefined);
  const pendingToggles = useRef<Set<number>>(new Set());
  const queuedToggles = useRef<Map<number, boolean>>(new Map());
  const intendedDone = useRef<Map<number, boolean>>(new Map());
  const runnerWasOpen = useRef(false);

  const me = board.find((p) => p.user_id === meId) ?? null;
  const journey = journeyProgress(me?.calendar ?? []);
  const journeyStage = getJourneyStage(me?.calendar ?? []);
  // Deliberately no `|| DEFAULT_CHARACTER` fallback -- undefined here is what
  // drives the mandatory character-select gate below (skill §0). Once set,
  // it never resets.
  const myCharacter: CharacterId | undefined = meId != null ? characters[meId] : undefined;

  // The toggle path runs across awaits and re-taps, so it must read the values
  // as they are when it runs, not as they were when the tap was handled.
  const latestDetail = useRef(detail);
  latestDetail.current = detail;
  const latestMe = useRef(me);
  latestMe.current = me;

  // Level-clear screen (skill §13): pops the moment every task for *today* is
  // ticked. Suppressed only for the rest of this session once dismissed (a
  // ref, not localStorage) -- so a reload after finishing shows it again, and
  // unchecking then re-completing a task re-triggers it. Celebratory only;
  // never gates day advancement (that stays date-driven).
  const dayCompleteDismissed = useRef<string | null>(null);
  useEffect(() => {
    if (!detail || meId == null || day !== todayISO()) return;
    const allDone = detail.tasks.length > 0 && detail.tasks.every((t) => t.done);
    // The overlay itself is now opened by ForestScene once the panda has run
    // the victory lane to the exit (onDayCleared below). This effect only
    // re-arms it: uncheck a task and the "stage clear" screen can fire again.
    if (!allDone && dayCompleteDismissed.current === day) {
      dayCompleteDismissed.current = null;
    }
  }, [detail, day, meId]);

  // Fired by ForestScene when the panda finishes the end-of-day run (jump down
  // -> victory lane -> exit). Celebratory only; day advancement stays date-driven.
  const handleDayCleared = useCallback(() => {
    if (meId == null || day !== todayISO()) return;
    if (dayCompleteDismissed.current === day) return;
    setDayCompleteOpen(true);
  }, [meId, day]);

  const closeDayComplete = () => {
    setDayCompleteOpen(false);
    dayCompleteDismissed.current = day;
    // The overlay's own "congrats" step already shows rank + standings now --
    // auto-opening the Leaderboard drawer on top of that was a third,
    // redundant screen (rank/standings twice, plus an invite prompt).
  };

  // Only saved daily goals unlock environments. Scope the announcement to
  // this run, so restarting the challenge can earn every chapter again.
  const journeyRun = me ? `${meId}:${me.run_start}:${me.resets}` : null;
  useEffect(() => {
    setWorldUnlock(null);
    if (!journeyRun || journeyStage.id <= 1) return;
    const key = `75hard.journey-world:${journeyRun}:${journeyStage.id}`;
    try {
      if (localStorage.getItem(key) === "1") return;
    } catch {
      /* private mode -- just show it */
    }
    dayCompleteDismissed.current = todayISO();
    setDayCompleteOpen(false);
    setStoryOpen(false);
    setWeekMapOpen(false);
    setWorldUnlock(journeyStage);
  }, [journeyRun, journeyStage]);

  const closeWorldUnlock = () => {
    const stage = worldUnlock;
    setWorldUnlock(null);
    try {
      if (stage && journeyRun) localStorage.setItem(`75hard.journey-world:${journeyRun}:${stage.id}`, "1");
    } catch {
      /* ignore */
    }
    if (stage) {
      setStoryWorld(stage.id - 1);
      setStoryStartsInAdventure(false);
      setStoryOpen(true);
      setOpenPanel(null);
    }
  };

  // PIN prompting removed by request -- every mutation used to stop and ask
  // for a PIN (even with the in-session cache, that meant once per reload),
  // which was pure friction for a device only its own owner uses. The
  // server no longer enforces PINs either (see backend's _require_pin /
  // server/app.js's requirePin, both now no-ops), so calling straight
  // through here still succeeds for accounts that have a pin_hash on file
  // from before this change.
  const runWithPin = (_userId: number, fn: (pin?: string) => Promise<void>) => {
    fn(undefined);
  };

  const setAvatarFor = (userId: number, a: AvatarId) => {
    setAvatars((prev) => {
      const next = { ...prev, [userId]: a };
      localStorage.setItem(AVATAR_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setCharacterFor = (userId: number, c: CharacterId) => {
    setCharacters((prev) => {
      const next = { ...prev, [userId]: c };
      localStorage.setItem(CHARACTER_KEY, JSON.stringify(next));
      return next;
    });
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  /**
   * Save the alarm. Turning it on creates the locked reps task, turning it off
   * archives it -- so `detail` has to be refetched either way or the task list
   * keeps showing a chore that no longer exists (or misses one that now does).
   */
  const saveWake = async () => {
    if (meId == null || wakeBusy) return;
    setWakeBusy(true);
    try {
      await api.setWake(meId, wakeOn ? wakeAt : null, wakeReps);
      const [, fresh] = await Promise.all([loadUsers(meId), api.day(meId, day)]);
      setDetail(fresh);
      // A new alarm should get a fair hearing: drop any leftover snooze or
      // "dismiss for today" so it can actually ring at the time just set.
      setSnoozed((prev) => {
        const next = { ...prev };
        delete next[meId];
        try {
          localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
        } catch {
          /* storage blocked -- the deadline is a nicety, not state */
        }
        return next;
      });
      flash(wakeOn ? `Alarm set for ${wakeAt}` : "Alarm off");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not save the alarm");
    } finally {
      setWakeBusy(false);
    }
  };

  // Expired deadlines are pruned on write so the record can't grow forever.
  const silenceAlarm = (ms: number) => {
    if (meId == null) return;
    setSnoozed((prev) => {
      const now = Date.now();
      const next: Record<number, number> = {};
      for (const [id, until] of Object.entries(prev)) {
        if (until > now) next[Number(id)] = until;
      }
      next[meId] = now + ms;
      localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Boards are scoped per group server-side -- `asUserId` tells the backend
  // whose group to look up. Omit it only for a browser with no local user
  // yet (a brand new, still-empty board).
  const loadUsers = useCallback(async (asUserId?: number) => {
    const list = await api.users(asUserId);
    setUsers(list);
    if (list.length) {
      const pick = list.find((u) => u.id === asUserId) ?? list[0];
      // Keep whoever is already selected, but only if the board actually
      // contains them. meId is now seeded from localStorage before any request
      // goes out, so it can name an account that has since been deleted or
      // belongs to another board -- and without this correction the shell would
      // wait forever for a user the board is never going to have.
      setMeId((cur) => (cur != null && list.some((u) => u.id === cur) ? cur : pick.id));
    }
    return list;
  }, []);

  const loadBoard = useCallback(async (asUserId?: number) => setBoard(await api.board(asUserId)), []);

  // The saved id is already in localStorage, so users/board don't need to
  // wait on each other -- chaining them cost a round trip before anything
  // could render. Only the no-saved-user case still has to resolve users
  // (or a same-IP suggestion) first, since board needs to know who to ask for.
  useEffect(() => {
    const storedId = Number(localStorage.getItem(LAST_USER)) || undefined;
    if (storedId) {
      Promise.all([loadUsers(storedId), loadBoard(storedId)])
        .then(() => setSaveError(null))
        .catch((e) =>
          setSaveError(e instanceof Error ? e.message : "Couldn't reach the server -- showing the last saved view")
        );
      return;
    }
    (async () => {
      // No saved local user (cleared storage, new device) -- ask whether
      // this IP was last seen as someone, so a returning player lands
      // pre-selected on their own tile instead of the onboarding screen.
      // Pure convenience: a wrong/missing suggestion just falls back to
      // today's behaviour, and editing still needs the right PIN either way.
      let saved: number | undefined;
      try {
        if (!localStorage.getItem(SIGNED_OUT_KEY)) {
          const suggestion = await api.suggestSession();
          if (suggestion.user_id != null) saved = suggestion.user_id;
        }
      } catch {
        // ignore -- fall through to the normal onboarding path
      }
      const list = await loadUsers(saved);
      if (list.length) await loadBoard(saved ?? list[0].id);
    })();
  }, [loadUsers, loadBoard]);

  useEffect(() => {
    if (meId == null) return;
    localStorage.setItem(LAST_USER, String(meId));
    localStorage.removeItem(SIGNED_OUT_KEY);
    api
      .day(meId, day)
      .then((d) => {
        setDetail(d);
        setNote(d.note);
        setNoteState("idle");
        setSaveError(null);
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Could not load this day"));
  }, [meId, day]);

  /**
   * Flush any tick that was shown to the user but never confirmed -- see
   * outbox.ts. Runs once the user is known, and again every time the device
   * comes back online, which is the moment that actually matters: the tap that
   * went missing was almost always made with no usable connection.
   */
  useEffect(() => {
    if (meId == null) return;
    let alive = true;

    const flush = async () => {
      const flushed = await outbox.replay(
        (e) => api.toggle(e.userId, e.taskId, e.day, e.done),
        {
          today: todayISO(),
          // Never race a write this session is already making -- the live
          // request carries a newer intent than anything parked here.
          skip: (e) =>
            e.userId !== meId ||
            pendingToggles.current.has(e.taskId) ||
            queuedToggles.current.has(e.taskId),
          isPermanentFailure,
        }
      );
      // Only repaint if something actually landed, and only when no write of
      // our own is in flight -- an in-flight toggle's own response is the
      // authority on its task, and clobbering it here is the exact race the
      // optimistic-value handling in sendToggle exists to prevent.
      if (!alive || flushed === 0 || pendingToggles.current.size > 0) return;
      const [freshDay, freshBoard] = await Promise.all([api.day(meId, day), api.board(meId)]);
      if (!alive || pendingToggles.current.size > 0) return;
      setDetail(freshDay);
      setBoard(freshBoard);
    };

    void flush().catch(() => {
      /* still offline, or the day moved on -- the next online event retries */
    });
    window.addEventListener("online", flush);
    return () => {
      alive = false;
      window.removeEventListener("online", flush);
    };
  }, [meId, day]);

  // Fill the alarm form from whatever the server has, once per user. Reps live
  // on the locked task rather than on the user, so they come from `detail`.
  useEffect(() => {
    if (meId == null || wakeSeeded.current === meId) return;
    const u = users?.find((x) => x.id === meId);
    if (!u) return;
    wakeSeeded.current = meId;
    setWakeOn(!!u.wake_time);
    // Postgres hands back 'HH:MM:SS'; <input type="time"> wants 'HH:MM'.
    if (toMinutes(u.wake_time) !== null) setWakeAt(u.wake_time!.slice(0, 5));
    const reps = detail?.tasks.find((t) => t.locked)?.reps_target;
    if (typeof reps === "number") setWakeReps(reps);
  }, [users, meId, detail]);

  // Keep the server's idea of this user's timezone in step with the device.
  // Runs once per session when they differ -- a fresh account created before
  // the timezone column, or the user having travelled. The server derives every
  // day boundary from this, so it must not drift.
  useEffect(() => {
    if (meId == null || tzSynced.current) return;
    const myUser = users?.find((u) => u.id === meId);
    if (!myUser) return;
    const tz = deviceTimezone();
    if (!tz || tz === myUser.timezone) {
      tzSynced.current = true;
      return;
    }
    tzSynced.current = true;
    api
      .setTimezone(meId, tz)
      .then(() => {
        loadUsers(meId);
        loadBoard(meId);
      })
      .catch(() => {
        /* best effort -- the client still sends its local day as a fallback */
      });
  }, [meId, users, loadUsers, loadBoard]);

  // The alarm condition (current time vs. wake_time) isn't itself reactive
  // state, so it needs a poll to notice the moment it's crossed. Polling every
  // second but only re-rendering when the wall-clock minute changes keeps the
  // alarm within a second of its set time without a re-render per tick --
  // wake_time is minute-resolution, so a minute is all the render granularity
  // that means anything.
  //
  // The same poll rolls `day` over at midnight. An alarm gets left running
  // overnight, and `day` was only ever read at mount: come morning the
  // `day === todayISO()` gate below was still comparing against yesterday, so
  // the alarm never fired at all. Only follow the rollover if the user is
  // actually looking at today -- don't yank them out of a past day they opened.
  useEffect(() => {
    const check = () => {
      const nowDay = todayISO();
      if (nowDay !== todayRef.current) {
        todayRef.current = nowDay;
        // Follow the rollover unless the user has deliberately opened a past day.
        if (followToday.current) {
          setDay(nowDay);
          setDayCompleteOpen(false);
          setOpenPanel((panel) => (panel === "leaderboard" ? null : panel));
        }
        if (meId != null) loadBoard(meId);
      } else if (followToday.current) {
        // Defensive: even without a detected date change, if we're meant to be
        // on today and `day` has drifted (stale mount / restored tab), snap it.
        setDay((d) => (d === nowDay ? d : nowDay));
      }
      const nowMin = new Date().toTimeString().slice(0, 5);
      if (nowMin !== minuteRef.current) {
        minuteRef.current = nowMin;
        forceTick((n) => n + 1);
      }
    };
    const id = window.setInterval(check, 1000);
    // Backgrounded tabs get their timers throttled hard (and a sleeping phone
    // stops them outright), so re-check the instant we're visible / focused.
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    check();
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [meId, loadBoard]);

  // Ring again the instant a snooze runs out, rather than waiting on the minute
  // tick above -- a 5 minute snooze should be 5 minutes, not 5:59.
  useEffect(() => {
    const until = meId != null ? snoozed[meId] : undefined;
    if (!until) return;
    const ms = until - Date.now();
    if (ms <= 0) return;
    const id = window.setTimeout(() => forceTick((n) => n + 1), ms);
    return () => window.clearTimeout(id);
  }, [snoozed, meId]);

  // Keep the on-device snapshot current. Debounced because the board object is
  // sizeable and localStorage writes are synchronous on the main thread -- doing
  // one per tick would trade the load time we just won for jank while tapping.
  useEffect(() => {
    if (meId == null || !users?.length || !detail || !board.length) return;
    if (day !== todayISO()) return; // only ever cache today; see readSnapshot
    const id = window.setTimeout(() => {
      try {
        const snap: Snapshot = { userId: meId, day, users, board, detail };
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
      } catch {
        // Out of quota, or storage blocked. The cache is an optimisation --
        // losing it costs a skeleton on next load, nothing more.
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [meId, users, board, detail, day]);

  // Web Audio refuses to start outside a user gesture, so an alarm firing on a
  // timer plays nothing unless the context was already unlocked. Grab the first
  // tap of the session to warm it up.
  useEffect(() => {
    const on = () => {
      primeAudio();
      primeJump();
    };
    window.addEventListener("pointerdown", on, { once: true });
    window.addEventListener("keydown", on, { once: true });
    return () => {
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
  }, []);

  const myUser = users?.find((u) => u.id === meId) ?? null;
  const lockedTask = detail?.tasks.find((t) => t.locked) ?? null;
  const silencedUntil = (meId != null ? snoozed[meId] : 0) ?? 0;
  // Recomputed every render; the minute poll above forces one each time the
  // wall-clock minute changes, which is what makes a Date-based condition
  // reactive at all.
  const alarmActive =
    day === todayISO() &&
    !!lockedTask &&
    !lockedTask.done &&
    Date.now() >= silencedUntil &&
    isAlarmDue(myUser?.wake_time, new Date());

  /**
   * One request per task at a time. Without this, a quick double-tap fires two
   * writes that disagree: the second reads `t.done` from the state the first
   * already flipped optimistically, so it posts the opposite value, and
   * whichever response lands last wins -- leaving the checkbox showing the
   * opposite of what the server stored. Held in a ref because this must be
   * true the instant the tap happens, not after a re-render.
   */
  const toggle = (t: TaskItem) => {
    if (meId == null || !detail) return;

    // Past days are sealed -- you resume on the next day, never backfill.
    if (day !== todayISO()) {
      flash("That day is locked. Come back tomorrow for the next one.");
      return;
    }

    // What the box is showing, right now, this instant. `t.done` is from the
    // render that built the handler, and even latestDetail only catches up on
    // the next render -- so two taps inside one frame would both read the same
    // value and compute the same flip. intendedDone is written synchronously,
    // so a burst of taps alternates the way the person tapping expects.
    const showing =
      intendedDone.current.get(t.id) ??
      latestDetail.current?.tasks.find((x) => x.id === t.id)?.done ??
      t.done;
    const next = !showing;
    intendedDone.current.set(t.id, next);

    // Every tap moves the box, always. Dropping taps that arrive while a
    // request is in flight is what made a slow connection look like the box
    // was rejecting the change: you tapped to uncheck, nothing moved, and it
    // read as having re-checked itself.
    setDetail((cur) =>
      cur ? { ...cur, tasks: cur.tasks.map((x) => (x.id === t.id ? { ...x, done: next } : x)) } : cur
    );

    // One request per task at a time, but never a lost intent: if one is
    // already out, park the new value and send it when that one settles.
    if (pendingToggles.current.has(t.id)) {
      queuedToggles.current.set(t.id, next);
      outbox.remember({ userId: meId, taskId: t.id, day, done: next, ts: Date.now() });
      return;
    }
    sendToggle(t.id, next);
  };

  /** Issues one toggle write, then drains whatever the user asked for meanwhile. */
  const sendToggle = (taskId: number, next: boolean) => {
    if (meId == null) return;
    pendingToggles.current.add(taskId);

    // Park the intent BEFORE the request, so a write that never lands (tab
    // closed mid-flight, phone off the network) is replayed on the next launch
    // instead of vanishing. Cleared the moment the server confirms it.
    outbox.remember({ userId: meId, taskId, day, done: next, ts: Date.now() });

    const wasPerfect = latestMe.current?.perfect_today ?? false;
    const curTasks = latestDetail.current?.tasks ?? [];
    const wasFullClear = curTasks.length > 0 && curTasks.every((x) => x.done);

    api
      .toggle(meId, taskId, day, next)
      .then((res) => {
        const queued = queuedToggles.current.get(taskId);
        const hasNewerIntent = queued !== undefined && queued !== next;

        // The write was accepted (a non-2xx would have thrown), so its value is
        // authoritative only if the user has not tapped again meanwhile. The
        // day payload that comes back with it is a convenience read, and a
        // convenience read is not worth overruling the user's newest action:
        // anything stale would show up as the box silently flipping back on its
        // own, which is precisely the fault being chased here. Take the rest of
        // the payload, keep the latest local value for this task, and keep the
        // optimistic value for any sibling whose own write is still in flight.
        if (res.day.tasks.find((x) => x.id === taskId)?.done !== next) {
          console.warn("[toggle] server echoed a different value than written", {
            taskId,
            wrote: next,
            echoed: res.day.tasks.find((x) => x.id === taskId)?.done,
          });
        }
        const mergeTasks = (currentTasks: TaskItem[] = []) =>
          res.day.tasks.map((x) => {
            if (x.id === taskId && hasNewerIntent) {
              return { ...x, done: currentTasks.find((c) => c.id === x.id)?.done ?? queued };
            }
            if (x.id === taskId) return { ...x, done: next };
            if (pendingToggles.current.has(x.id)) {
              return { ...x, done: currentTasks.find((c) => c.id === x.id)?.done ?? x.done };
            }
            return x;
          });
        const visibleTasks = mergeTasks(latestDetail.current?.tasks);
        setDetail((cur) => {
          if (!cur) return { ...res.day, tasks: visibleTasks };
          return {
            ...res.day,
            tasks: mergeTasks(cur.tasks),
          };
        });
        setBoard((b) => b.map((p) => (p.user_id === meId ? res.progress : p)));
        setSaveError(null);
        // Confirmed by the server unless the user already tapped again; in
        // that case the parked outbox value is newer and still needs replay.
        if (!hasNewerIntent) outbox.forget({ userId: meId, taskId, day });

        const nowFullClear = visibleTasks.length > 0 && visibleTasks.every((x) => x.done);
        const becameFullClear = day === todayISO() && !wasFullClear && nowFullClear;
        if (day === todayISO() && !wasPerfect && res.progress.perfect_today) {
          const hit = res.progress.badges.find((x) => x.day === res.progress.streak && x.earned);
          flash(hit ? `${hit.name} unlocked - day ${res.progress.streak}` : `Day ${res.progress.day_number} locked in`);
        } else if (becameFullClear) {
          flash("Full clear - nothing left today");
        }
      })
      .catch((e) => {
        // A refusal (4xx) is final -- the server will say the same thing next
        // time, so drop the parked intent and put the box back to what the
        // server believes. A delivery failure is not final: the intent stays in
        // the outbox and the optimistic tick STANDS, because it is going to be
        // replayed on the next launch or the next online event. Reverting it
        // there would show the user a false "didn't save" for a write that
        // does, in fact, still save.
        if (isPermanentFailure(e)) {
          const queued = queuedToggles.current.get(taskId);
          const hasNewerIntent = queued !== undefined && queued !== next;
          if (!hasNewerIntent) outbox.forget({ userId: meId, taskId, day });
          // Undo only this task, and only if the user has not since asked for
          // something else -- a queued intent is newer than this failure, so
          // reverting to the pre-request value would fight the person tapping.
          if (!hasNewerIntent) {
            setDetail((cur) =>
              cur
                ? { ...cur, tasks: cur.tasks.map((x) => (x.id === taskId ? { ...x, done: !next } : x)) }
                : cur
            );
          }
        }
        const msg = e instanceof Error ? e.message : "Could not update task";
        flash(msg);
        setSaveError(msg);
      })
      .finally(() => {
        pendingToggles.current.delete(taskId);
        const queued = queuedToggles.current.get(taskId);
        if (queued === undefined) {
          // Settled and nothing outstanding: hand authority back to server state.
          intendedDone.current.delete(taskId);
          return;
        }
        queuedToggles.current.delete(taskId);
        // Only worth a round trip if it actually differs from what we just wrote.
        if (queued !== next) sendToggle(taskId, queued);
        else intendedDone.current.delete(taskId);
      });
  };

  /** Ticks (or unticks) every one of today's tasks -- same single-task path as
   * `toggle`, just called once per task, so it gets the same optimistic
   * update, outbox replay, and in-flight queuing guarantees for free. */
  const setAllTasks = (done: boolean) => {
    if (day !== todayISO()) {
      flash("That day is locked. Come back tomorrow for the next one.");
      return;
    }
    detail?.tasks.forEach((t) => {
      if (t.done !== done) toggle(t);
    });
  };

  const addTask = (title: string) => {
    if (meId == null || adding) return;
    runWithPin(meId, async (pin) => {
      setAdding(true);
      try {
        await api.addTask(meId, title, "+", false, pin);
        setDetail(await api.day(meId, day));
        await loadBoard(meId);
      } finally {
        setAdding(false);
      }
    });
  };

  const removeTask = (t: TaskItem) => {
    if (meId == null) return;
    runWithPin(meId, async (pin) => {
      await api.removeTask(meId, t.id, pin);
      setDetail(await api.day(meId, day));
      await loadBoard(meId);
    });
  };

  const submitHabitDraft = () => {
    const title = habitDraft.trim();
    if (!title) return;
    addTask(title);
    setHabitDraft("");
  };

  const editNote = (text: string) => {
    setNote(text);
    if (day !== todayISO()) return; // past-day notes are locked server-side too
    setNoteState("saving");
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      if (meId == null) return;
      runWithPin(meId, async (pin) => {
        try {
          await api.saveNote(meId, day, text, pin);
          setNoteState("saved");
          setSaveError(null);
        } catch (e) {
          setNoteState("idle");
          setSaveError(e instanceof Error ? e.message : "Could not save your note");
        }
      });
    }, 600);
  };

  const restart = () => {
    if (meId == null) return;
    const id = meId;
    runWithPin(id, async (pin) => {
      try {
        await api.restart(id, pin);
        // Reload BOTH the board and today's tasks -- restart clears completions
        // server-side, so the checklist / forest must refetch or they keep
        // showing the old run's ticks.
        const [, fresh] = await Promise.all([loadBoard(id), api.day(id, todayISO())]);
        followToday.current = true;
        setDay(todayISO());
        setDetail(fresh);
        setNote(fresh.note);
        setNoteState("idle");
        setOpenPanel(null);
        setSaveError(null);
        flash("Back to day 1. Go.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Reset failed -- try again";
        flash(msg);
        setSaveError(msg);
      }
    });
  };

  const signOut = () => {
    if (!confirm("Sign out on this device? You'll need your name and PIN to get back in.")) return;
    localStorage.removeItem(LAST_USER);
    // Their board must not be sitting on this device for whoever signs in next.
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.setItem(SIGNED_OUT_KEY, "1");
    setMeId(null);
    setUsers([]);
    setBoard([]);
    setDetail(null);
    setOpenPanel(null);
  };

  /**
   * These two MUST stay above the early returns below.
   *
   * React counts hooks per render, so an effect declared after a `return` is
   * skipped entirely while any gate is on screen (loading skeleton, onboarding,
   * character gate) and then appears the moment the shell renders. That is
   * "rendered more hooks than during the previous render" -- React error #310,
   * which takes down the whole app and leaves a black screen.
   *
   * It only bit on a boot with no usable snapshot to paint from. With a
   * same-day snapshot the very first render already falls through to the shell,
   * so the hook count never changes and nothing goes wrong. Without one the
   * first render is a skeleton and the second is the shell -- and readSnapshot
   * rejects any snapshot from another day, so this fired on the FIRST LOAD OF
   * EACH NEW DAY (and on cleared storage, or a new device). That is what made
   * it look intermittent when it was really quite predictable.
   */
  // Esc closes whatever drawer / picker is open (the minigame handles its own).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenPanel(null);
      setShareUrl(null);
      setInviteUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Whether the game shell itself is what renders below, rather than one of the
  // gates. Only used to keep the leaderboard fetch on its original schedule now
  // that the effect runs from the first render instead of the first full one.
  const shellVisible =
    users !== null && users.length > 0 && !!me && !!detail && !!myCharacter;

  // The notification opt-in -- shown once the shell has actually settled
  // (not on the very first paint), and only when shouldOfferPrompt() says
  // it's worth asking (permission still undecided, not recently dismissed).
  useEffect(() => {
    if (!shellVisible) return;
    const timer = window.setTimeout(() => {
      if (shouldOfferPrompt()) setShowPeek(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [shellVisible]);

  // Once permission is granted, check periodically whether today's tasks
  // are still open past the reminder hour -- maybeRemind is idempotent per
  // real calendar day, so polling often is harmless.
  useEffect(() => {
    if (!shellVisible || !detail) return;
    const check = () => {
      const completed = detail.tasks.filter((t) => t.done).length;
      maybeRemind(todayISO(), completed, detail.tasks.length);
    };
    check();
    const timer = window.setInterval(check, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [shellVisible, detail]);

  // Global Forest Dash leaderboard -- pulled when the board opens or the
  // minigame closes (a fresh score may have landed).
  useEffect(() => {
    const runnerJustClosed = runnerWasOpen.current && !runnerOpen;
    runnerWasOpen.current = runnerOpen;
    if (!shellVisible || (openPanel !== "leaderboard" && !runnerJustClosed)) return;
    api.dashLeaderboard().then(setDashBoard).catch(() => setDashBoard([]));
  }, [openPanel, runnerOpen, shellVisible]);

  // The habit coach -- persona, what's slipping, and a plan, built server-side
  // from real completions (see server/coach.js). Cached per day on the server,
  // so opening the panel repeatedly is cheap; the refresh button forces a new
  // read. Only looks at days before today, so ticking today's boxes can't
  // change it -- no refetch on every tap.
  useEffect(() => {
    if (!shellVisible || openPanel !== "coach" || meId == null) return;
    let live = true;
    api
      .coach(meId)
      .then((r) => live && setCoach(r))
      .catch(() => live && setCoach(null));
    return () => {
      live = false;
    };
  }, [shellVisible, openPanel, meId]);

  const refreshCoach = useCallback(() => {
    if (meId == null || coachLoading) return;
    setCoachLoading(true);
    api
      .coach(meId, true)
      .then(setCoach)
      .catch(() => {})
      .finally(() => setCoachLoading(false));
  }, [meId, coachLoading]);

  if (users === null) return <Skeleton />;

  if (users.length === 0) {
    return (
      <Onboard
        avatar={pendingAvatar}
        onAvatar={setPendingAvatar}
        existing={[]}
        // The only reason this screen has an audience of exactly one signed-
        // out browser is a deliberate Sign Out -- open on the sign-in side,
        // not the create-a-new-account default, so a returning user typing
        // their real credentials doesn't land on the tab that rejects them.
        initialMode={localStorage.getItem(SIGNED_OUT_KEY) ? "back" : "new"}
        onSignIn={async (name, pin) => {
          const u = await api.login(name, pin);
          setMeId(u.id);
          await loadUsers(u.id);
          await loadBoard(u.id);
        }}
        onCreate={async (name, color, pin, wakeTime, reps) => {
          const u = await api.createUser(name, color, pin, wakeTime, reps);
          setAvatarFor(u.id, pendingAvatar);
          setMeId(u.id);
          await loadUsers(u.id);
          await loadBoard(u.id);
        }}
      />
    );
  }

  if (!me || !detail) return <Skeleton />;

  // Mandatory first-run gate (skill §0): blocks the game shell entirely
  // until a character is chosen and persisted for this user. Fires once per
  // user id, then never again -- changing it later is Profile's "Your
  // character" turntable instead of a HUD entry point into this component.
  if (!myCharacter) {
    return <Suspense fallback={<Skeleton />}><CharacterSelect mode="gate" onSelect={(c) => setCharacterFor(meId!, c)} /></Suspense>;
  }

  const isToday = day === todayISO();
  const allTasksDone = detail.tasks.length > 0 && detail.tasks.every((t) => t.done);
  const tasksCompletedToday = detail.tasks.filter((t) => t.done).length;
  const totalTasksToday = detail.tasks.length;
  const bankedDays = me.calendar.filter((c) => c.status === "done").length;
  const overallProgressPct = Math.round((bankedDays / 75) * 100);
  // Derived, never stored -- a pure readout of already-persisted task
  // completion (CLAUDE.md §8: coin count is never the source of truth).
  // One coin per completed task, plus the "+5" bonus coin (shown on the
  // second-to-last platform) which lands only on a fully-cleared day -- so a
  // perfect day is worth its tasks + 4 extra on top of the per-task coin.
  const coinsEarned = me.calendar.reduce(
    (sum, c) => sum + c.done + (c.total > 0 && c.done === c.total ? 4 : 0),
    0
  );

  const togglePanel = (p: "leaderboard" | "stats" | "habits" | "profile" | "pomodoro" | "coach") =>
    setOpenPanel((cur) => (cur === p ? null : p));
  const openGoals = () => {
    setStoryOpen(false);
    setStoryWorld(undefined);
    setStoryStartsInAdventure(false);
    setWeekMapOpen(false);
    setOpenPanel(null);
    followToday.current = true;
    setDay(todayISO());
  };
  const openStory = (startInAdventure = false) => {
    setStoryWorld(journey.worldIndex);
    setStoryStartsInAdventure(startInAdventure);
    setStoryOpen(true);
  };

  return (
    <div
      className="game-shell world-theme"
      data-world={journey.worldIndex}
      data-panel-open={openPanel !== null || undefined}
      style={{ ["--u" as string]: me.color }}
    >
      {waving && <SnoozePanda minutes={SNOOZE_MIN} />}
      {alarmActive && lockedTask && (
        <AlarmOverlay
          task={lockedTask}
          onDone={() => toggle(lockedTask)}
          onSnooze={() => {
            silenceAlarm(SNOOZE_MIN * 60_000);
            // The panda carries the "back in N minutes" line, so no toast --
            // two of them saying the same thing would just stack.
            setWaving(true);
            window.clearTimeout(waveTimer.current);
            waveTimer.current = window.setTimeout(() => setWaving(false), 3400);
          }}
          onDismiss={() => {
            if (!confirm("Kill the alarm until tomorrow? The reps stay unticked, so today won't be a full clear.")) {
              return;
            }
            silenceAlarm(msUntilTomorrow());
            flash("Alarm off until tomorrow. The reps are still waiting.");
          }}
        />
      )}
      {shareUrl && <ShareDialog name={me.name} url={shareUrl} kind="share" onClose={() => setShareUrl(null)} />}
      {inviteUrl && <ShareDialog name={me.name} url={inviteUrl} kind="invite" onClose={() => setInviteUrl(null)} />}
      {confirmRestartOpen && (
        <ConfirmDialog
          title="Reset run?"
          message="Wipe the current run and start again from day 1 today?"
          confirmLabel="Wipe & restart"
          danger
          onConfirm={() => {
            setConfirmRestartOpen(false);
            restart();
          }}
          onCancel={() => setConfirmRestartOpen(false)}
        />
      )}
      {dayCompleteOpen && (
        <Suspense fallback={null}>
          <DayCompleteOverlay
            dayNumber={me.day_number}
            tasksCompleted={detail.tasks.filter((t) => t.done).length}
            totalTasks={detail.tasks.length}
            coins={coinsEarned}
            streak={me.streak}
            character={myCharacter}
            board={board}
            meId={meId!}
            onClose={closeDayComplete}
            onPlayRunner={() => {
              setDayCompleteOpen(false);
              dayCompleteDismissed.current = day;
              setRunnerOpen(true);
            }}
          />
        </Suspense>
      )}
      {worldUnlock && (
        <Suspense fallback={null}>
          <WorldUnlockOverlay stage={worldUnlock} character={myCharacter} onClose={closeWorldUnlock} />
        </Suspense>
      )}
      {showPeek && <PandaPeekPrompt onDone={() => setShowPeek(false)} />}
      {minigamePickerOpen && (
        <MinigamePicker
          onPickRunner={() => {
            setMinigamePickerOpen(false);
            setRunnerOpen(true);
          }}
          onPickAdventure={() => {
            setMinigamePickerOpen(false);
            openStory();
          }}
          onCancel={() => setMinigamePickerOpen(false)}
        />
      )}
      {runnerOpen && myCharacter && (
        <Suspense fallback={null}>
          <Minigames
            key={meId}
            character={myCharacter}
            userId={meId}
            calendar={me.calendar}
            onClose={() => setRunnerOpen(false)}
          />
        </Suspense>
      )}
      {dayStartBannerOpen && (
        <Suspense fallback={null}>
          <DayStartBanner dayNumber={me.day_number} onDismiss={() => setDayStartBannerOpen(false)} />
        </Suspense>
      )}
      {worldsScreenOpen && (
        <Suspense fallback={<div className="worlds-screen" aria-busy="true" />}>
          <WorldsScreen calendar={me.calendar} onClose={() => setWorldsScreenOpen(false)} />
        </Suspense>
      )}
      {weekMapOpen && myCharacter && (
        <Suspense fallback={<div className="weekmap-screen" aria-busy="true" />}>
          <WeekMap
            character={myCharacter}
            calendar={me.calendar}
            onClose={() => {
              setWeekMapOpen(false);
              setDayStartBannerOpen(true);
            }}
          />
        </Suspense>
      )}
      {storyOpen && myCharacter && (
        <Suspense fallback={<div className="pin-backdrop" role="status"><div className="confirm-modal"><p>Opening your story…</p></div></div>}>
          <StoryLauncher
            key={`${journeyRun}:${storyWorld ?? journey.worldIndex}:${journey.worldIndex}:${storyStartsInAdventure ? "play" : "intro"}`}
            character={myCharacter}
            userId={meId}
            dayNumber={me.day_number}
            calendar={me.calendar}
            initialWorld={storyWorld}
            startInAdventure={storyStartsInAdventure}
            onOpenGoals={openGoals}
            onOpenMap={() => {
              setStoryOpen(false);
              setStoryWorld(undefined);
              setWeekMapOpen(true);
            }}
            onClose={() => {
              setStoryOpen(false);
              setStoryWorld(undefined);
              setStoryStartsInAdventure(false);
            }}
          />
        </Suspense>
      )}

      <div className="game-shell-inner">
        {/* The whole topbar -- world label, day clock, lives, coins, mute,
            minigame launch -- is the "dashboard/home" HUD. It floats with no
            background of its own (see .game-topbar), so with a panel drawer
            open behind it (Profile, Stats, Leaderboard...) it used to just
            keep sitting there as a transparent bar on top of that panel's
            own content. Not rendered at all once any panel is open; it's
            back the moment you return to the dashboard. */}
        {openPanel === null && (
        <header className="game-topbar">
          {/* No hamburger -- PROFILE in the bottom nav already opens the same
              panel (togglePanel("profile")), so a second menu entry point
              here was redundant. Character switching is also Profile's job
              now (its own "Choose your character" hero) -- this slot used to
              duplicate it with its own 2D carousel picker, so it's a plain
              world label instead, tapping into the worlds grid. Layout is
              now: world label (left), the day clock (centre), lives + coins
              (right). */}
          <button
            type="button"
            className="topbar-world pixel-font"
            onClick={() => setWorldsScreenOpen(true)}
            title="See all worlds"
          >
            WORLD {journey.worldIndex + 1} · {WORLDS[journey.worldIndex].name.toUpperCase()}
          </button>
          <DayCountdown compact zoomable />
          {/* One flex item on the right (instead of four loose ones) so
              justify-content:space-between balances it against the single
              character chip on the left, holding the clock closer to true
              centre than six unevenly-sized siblings would. */}
          <div className="topbar-right">
            <div
              className={`topbar-lives${livesOpen ? " open" : ""}`}
              onMouseLeave={() => setLivesOpen(false)}
            >
              <LivesHUD
                lives={me.lives}
                initialLives={me.initial_lives}
                resets={me.resets}
                completedToday={tasksCompletedToday}
                totalToday={totalTasksToday}
                expanded={livesOpen}
                onToggle={() => setLivesOpen((v) => !v)}
              />
              <div className="failure-banner-float" role="tooltip">
                <FailureBanner resets={me.resets} />
              </div>
            </div>
            <div className="topbar-coins" data-coin-target aria-label={`${coinsEarned} coins earned`}>
              <CoinIcon size={18} />
              <span className="topbar-coins-count pixel-font">×{String(coinsEarned).padStart(2, "0")}</span>
            </div>
            <button
              type="button"
              className="mute-toggle"
              aria-pressed={muted}
              aria-label={muted ? "Unmute sound" : "Mute sound"}
              title={muted ? "Sound off — tap to unmute" : "Sound on — tap to mute"}
              onClick={() => {
                toggleMuted();
                setMuted((m) => !m);
              }}
            >
              {muted ? <IconSoundOff /> : <IconSoundOn />}
            </button>
            {!runnerOpen && !storyOpen && !weekMapOpen && !minigamePickerOpen && (
              <button
                type="button"
                className="dash-launch pixel-font"
                onClick={() => setMinigamePickerOpen(true)}
                title="Play a minigame"
              >
                ▶ MINIGAME
              </button>
            )}
          </div>
        </header>
        )}

        <div className="stage-area">
          {usePhaserEngine && journey.worldIndex === 0 ? (
            <Suspense fallback={<div className="phaser-forest-container" aria-busy="true" />}>
              <PhaserForestScene
                detail={detail}
                dayNumber={me.day_number}
                seed={`${meId}:${day}`}
                character={myCharacter}
              />
            </Suspense>
          ) : (
          <ForestScene
            detail={detail}
            dayNumber={me.day_number}
            stage={journeyStage}
            seed={`${meId}:${day}`}
            resets={me.resets}
            character={myCharacter}
            onDayCleared={day === todayISO() ? handleDayCleared : undefined}
            puzzleWorldIndex={day === todayISO() ? journey.worldIndex : undefined}
            puzzlePieceIds={day === todayISO() ? worldPuzzlePieces(me.calendar, journey.worldIndex) : undefined}
            returnToStart={
              detail.tasks.length > 0 &&
              detail.tasks.every((t) => t.done) &&
              openPanel === null &&
              !runnerOpen &&
              !storyOpen &&
              !weekMapOpen &&
              !minigamePickerOpen &&
              !confirmRestartOpen &&
              !dayCompleteOpen
            }
          />
          )}


          <div className="day-card-float">
            <button
              type="button"
              className={`daycard-reset daycard-iconbtn box-style${allTasksDone ? " done" : ""}`}
              onClick={() => setAllTasks(!allTasksDone)}
              title={allTasksDone ? "Untick all of today's tasks" : "Tick all of today's tasks"}
              aria-label={allTasksDone ? "Untick all tasks" : "Tick all tasks"}
              disabled={!detail.tasks.length}
            >
              <CheckCheck size={13} strokeWidth={2.4} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="daycard-edit daycard-iconbtn"
              onClick={() => togglePanel("habits")}
              title="Settings — add, edit, or remove tasks"
              aria-label="Settings"
            >
              <SettingsIcon size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <Checklist
              detail={detail}
              day={day}
              dayNumber={me.day_number}
              stage={journeyStage}
              onShift={(delta) => {
                const next = shiftISO(day, delta);
                if (next <= todayISO()) {
                  followToday.current = next === todayISO();
                  setDay(next);
                }
              }}
              onToggle={toggle}
              onAdd={addTask}
              onRemove={removeTask}
              hideAddRow
              locked={day !== todayISO()}
            />
          </div>

          <div className="side-rail" role="group" aria-label="Quick access">
            <button
              className={`rail-btn${openPanel === "leaderboard" ? " on" : ""}`}
              onClick={() => togglePanel("leaderboard")}
              aria-label="Leaderboard"
              aria-pressed={openPanel === "leaderboard"}
              title="Leaderboard"
            >
              <IconTrophy />
            </button>
            <button
              className={`rail-btn${openPanel === "coach" ? " on" : ""}`}
              onClick={() => togglePanel("coach")}
              aria-label="Coach"
              aria-pressed={openPanel === "coach"}
              title="Coach"
            >
              <IconCoach />
            </button>
            {/* Stats used to have a rail icon here too, duplicating the
                bottom nav's STATS tab -- same panel, two entry points for
                no reason. Removed; the bottom tab is the only way in now. */}
            {/* Settings is already one tap away on the bottom PROFILE tab --
                this slot used to duplicate that with a gear icon. Now it's
                the app install shortcut instead, and only shows up when
                there's actually something to install (skill's install-prompt
                contract mirrors the same condition in the Profile drawer's
                own "Install the app" card). */}
            {(installState.kind === "promptable" || installState.kind === "ios-manual") && (
              <button
                className="rail-btn"
                onClick={async () => {
                  if (installState.kind === "promptable") {
                    const accepted = await installState.install();
                    flash(accepted ? "Installed -- check your home screen" : "Maybe next time");
                  } else {
                    togglePanel("profile");
                  }
                }}
                aria-label="Download the app"
                title="Download the app"
              >
                <IconDownload />
              </button>
            )}
          </div>

          {openPanel === "leaderboard" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head">
                <h2>Leaderboard</h2>
                <button className="panel-close" aria-label="Close" title="Close" onClick={() => setOpenPanel(null)}>
                  <IconClose />
                </button>
              </div>
              {users.length < 4 && (
                <button
                  type="button"
                  className="btn primary wide invite-in-leaderboard"
                  title="Get a link that lets a friend join your lobby"
                  onClick={() => {
                    const token = users.find((u) => u.id === meId)?.invite_token;
                    if (!token) return;
                    setInviteUrl(`${location.origin}${location.pathname}?join=${token}`);
                  }}
                >
                  Invite a player
                </button>
              )}

              <Suspense fallback={<div className="card panel-section muted">Loading standings…</div>}>
                <Rivals board={board} meId={me.user_id} />
              </Suspense>

              {dashBoard.length > 0 && (
                <div className="card panel-section dash-board-card">
                  <div className="card-head">
                    <h2>Forest Dash — global</h2>
                  </div>
                  <Suspense fallback={<p className="muted">Loading Forest Dash scores…</p>}>
                    <DashLeaderboard rows={dashBoard} meName={me.name} />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {openPanel === "stats" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head">
                <h2>Stats</h2>
                <button className="panel-close" aria-label="Close" title="Close" onClick={() => setOpenPanel(null)}>
                  <IconClose />
                </button>
              </div>
              <div className="profile-stat-grid">
                <div className="profile-stat">
                  <div className="n num">{me.day_number}/75</div>
                  <div className="l">Day</div>
                </div>
                <div className="profile-stat">
                  <div className="n num">{overallProgressPct}%</div>
                  <div className="l">Overall progress</div>
                </div>
                <div className="profile-stat">
                  <div className="n num">{me.streak}</div>
                  <div className="l">Current streak</div>
                </div>
                <div className="profile-stat">
                  <div className="n num">{me.best_streak}</div>
                  <div className="l">Best streak</div>
                </div>
                <div className="profile-stat">
                  <div className="n num">{me.perfect_days_ever}</div>
                  <div className="l">Perfect days</div>
                </div>
                <div className="profile-stat">
                  <div className="n num">{me.resets}</div>
                  <div className="l">Setbacks</div>
                </div>
                <div className="profile-stat">
                  <div className="n num">{me.calendar.filter((c) => c.status === "missed").length}</div>
                  <div className="l">Missed days</div>
                </div>
                <div className="profile-stat">
                  {/* One setback == a 7-day penalty (server/engine.js PENALTY_DAYS). */}
                  <div className="n num">{me.resets * 7}</div>
                  <div className="l">Penalty days</div>
                </div>
              </div>

              <div className="panel-section" style={{ display: "flex", justifyContent: "center" }}>
                <LevelRing p={me} />
              </div>
              <div className="panel-section">
                <Suspense fallback={<div className="card muted">Loading badges…</div>}>
                  <Badges p={me} />
                </Suspense>
              </div>
              <div className="panel-section">
                <Suspense fallback={<div className="card muted">Loading calendar…</div>}>
                  <Calendar75
                    cells={me.calendar}
                    onPick={(iso) => {
                      followToday.current = iso === todayISO();
                      setDay(iso);
                      setOpenPanel(null);
                    }}
                  />
                </Suspense>
              </div>
            </div>
          )}

          {openPanel === "pomodoro" && <PomodoroPanel key={meId} userId={meId!} onClose={() => setOpenPanel(null)} />}

          {openPanel === "coach" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head">
                <h2>Coach</h2>
                <button className="panel-close" aria-label="Close" title="Close" onClick={() => setOpenPanel(null)}>
                  <IconClose />
                </button>
              </div>
              <Suspense fallback={<div className="card panel-section muted">Loading your report…</div>}>
                <Coach report={coach} onRefresh={refreshCoach} refreshing={coachLoading} />
              </Suspense>
              {meId != null && (coachChatOpen ? (
                <Suspense fallback={<div className="card panel-section muted">Loading coach chat…</div>}>
                  <CoachChat key={meId} userId={meId} report={coach} />
                </Suspense>
              ) : (
                <div className="card panel-section coach-chat-opt-in">
                  <div className="card-head"><h2>Ask the coach</h2></div>
                  {"gpu" in navigator ? <>
                    <p className="muted">Chat is optional. Its on-device AI model downloads when you send your first question and can use 1–2 GB.</p>
                    <button className="btn wide" type="button" onClick={() => setCoachChatOpen(true)}>Open coach chat</button>
                  </> : <p className="muted">Coach chat needs WebGPU. Use a recent Chrome or Edge browser to enable it.</p>}
                </div>
              ))}
            </div>
          )}

          {openPanel === "habits" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head">
                <h2>Habits</h2>
                <button className="panel-close" aria-label="Close" title="Close" onClick={() => setOpenPanel(null)}>
                  <IconClose />
                </button>
              </div>
              <div className="card panel-section">
                <div className="card-head">
                  <h2>Manage tasks</h2>
                </div>
                {detail.tasks.map((t) => (
                  <div className="habit-row" key={t.id}>
                    <span className="emoji">{t.emoji}</span>
                    <span className="title">{t.title}</span>
                    {!t.is_core && <span className="tag">bonus</span>}
                    {t.locked && <span className="tag locked">locked</span>}
                    {!t.locked && (
                      <button className="kill" onClick={() => removeTask(t)} aria-label={`delete ${t.title}`} title={`Delete "${t.title}"`}>
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <div className="addrow">
                  <input
                    placeholder="add a bonus habit..."
                    value={habitDraft}
                    maxLength={80}
                    onChange={(e) => setHabitDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitHabitDraft()}
                  />
                  <button className="btn" onClick={submitHabitDraft}>
                    Add
                  </button>
                </div>
              </div>

              <div className="card panel-section">
                <div className="card-head">
                  <h2>{isToday ? "Still pending" : "That day"}</h2>
                  <span className="saved">
                    {noteState === "saving" ? "saving..." : noteState === "saved" ? "saved" : ""}
                  </span>
                </div>
                {detail.pending.length > 0 ? (
                  <p className="muted" style={{ margin: "0 0 12px" }}>
                    {detail.pending.map((t) => t.title).join(" · ")}
                  </p>
                ) : (
                  <p className="muted" style={{ margin: "0 0 12px", color: "var(--good)" }}>
                    Everything ticked off. Clean day.
                  </p>
                )}
                <textarea
                  className="note"
                  placeholder="what's left, what went wrong, what you owe tomorrow..."
                  value={note}
                  onChange={(e) => editNote(e.target.value)}
                />
              </div>
            </div>
          )}

          {openPanel === "profile" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head panel-drawer-head-sticky">
                <h2>Profile</h2>
                <button className="panel-close" aria-label="Close profile" title="Close" onClick={() => setOpenPanel(null)}>
                  <IconClose />
                </button>
              </div>

              <div
                className="profile-character-hero"
                style={{ ["--character-select-scene" as string]: `url(${PROFILE_CHARACTER_SCENE})` }}
              >
                <h1 className="pixel-font character-select-title character-select-title-huge">
                  CHOOSE YOUR
                  <br />
                  CHARACTER
                </h1>
                <CharacterCarousel
                  index={Math.max(0, CHARACTERS.findIndex((c) => c.id === myCharacter))}
                  onStep={(delta) => {
                    if (meId == null) return;
                    const i = Math.max(0, CHARACTERS.findIndex((c) => c.id === myCharacter));
                    const next = CHARACTERS[(i + delta + CHARACTERS.length) % CHARACTERS.length];
                    setCharacterFor(meId, next.id);
                  }}
                />
              </div>

              <div className="card panel-section">
                <div className="card-head">
                  <h2>Wake-up alarm</h2>
                </div>
                <label className="wake-toggle">
                  <input
                    type="checkbox"
                    checked={wakeOn}
                    onChange={(e) => setWakeOn(e.target.checked)}
                  />
                  Wake-up alarm (won't stop until you confirm your reps)
                </label>
                {wakeOn && (
                  <div className="wake-fields">
                    <input
                      className="field"
                      type="time"
                      aria-label="Alarm time"
                      value={wakeAt}
                      onChange={(e) => setWakeAt(e.target.value)}
                    />
                    <input
                      className="field"
                      type="number"
                      min={1}
                      max={200}
                      aria-label="Reps to wake up"
                      value={wakeReps}
                      onChange={(e) => setWakeReps(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                )}
                <button
                  className="btn wide"
                  style={{ marginTop: 10 }}
                  onClick={saveWake}
                  disabled={wakeBusy}
                >
                  {wakeBusy ? "..." : wakeOn ? "Save alarm" : "Turn alarm off"}
                </button>
              </div>

              <div className="card panel-section">
                <div className="card-head">
                  <h2>Players</h2>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      className={`pill${u.id === meId ? " on" : ""}`}
                      style={{ ["--u" as string]: u.color, color: u.id === meId ? u.color : undefined }}
                      onClick={() => setMeId(u.id)}
                    >
                      <i className="dot" />
                      {u.name}
                    </button>
                  ))}
                  {users.length < 4 && (
                    <button
                      className="pill"
                      onClick={async () => {
                        const name = prompt("Friend's name?");
                        if (!name?.trim()) return;
                        const pin = prompt("Pick a 4-6 digit PIN for editing their own progress:");
                        if (!pin?.trim()) return;
                        const palette = ["#4a9ee8", "#5cbd7e", "#b76ae8", "#e8c14a"];
                        try {
                          await api.createUser(
                            name.trim(),
                            palette[users.length % palette.length],
                            pin.trim(),
                            null,
                            20,
                            meId ?? undefined
                          );
                          await loadUsers(meId ?? undefined);
                          await loadBoard(meId ?? undefined);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : "could not add");
                        }
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    className="btn"
                    title="Get a read-only link to your progress -- no PIN, no editing"
                    onClick={() => {
                      const token = users.find((u) => u.id === meId)?.share_token;
                      if (!token) return;
                      setShareUrl(`${location.origin}${location.pathname}?share=${token}`);
                    }}
                  >
                    Share
                  </button>
                </div>
              </div>

              {(installState.kind === "promptable" || installState.kind === "ios-manual") && (
                <div className="card panel-section">
                  <div className="card-head">
                    <h2>Install the app</h2>
                  </div>
                  <p className="install-note">
                    Add 75 Hard to your home screen -- opens full-screen, no browser bar, just like
                    any other app.
                  </p>
                  {installState.kind === "promptable" ? (
                    <button
                      className="btn wide"
                      onClick={async () => {
                        const accepted = await installState.install();
                        flash(accepted ? "Installed -- check your home screen" : "Maybe next time");
                      }}
                    >
                      Add to Home Screen
                    </button>
                  ) : (
                    // iOS has no install API at all -- Safari's Share sheet is
                    // the only way in, and nothing on the page can open it.
                    <p className="install-note">
                      In Safari, tap the Share button, then "Add to Home Screen".
                    </p>
                  )}
                </div>
              )}

              <div className="card panel-section">
                <div className="card-head">
                  <h2>Reset run</h2>
                </div>
                <p className="muted">Wipe this run and start again from day 1 today. Your tasks stay put.</p>
                <button className="btn danger wide" onClick={() => setConfirmRestartOpen(true)}>
                  <IconRestart /> Reset run
                </button>
              </div>

              <div
                className="card panel-section"
                style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}
              >
                <button className="btn ghost" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* A second, more discoverable install entry point than the rail
            icon above -- pinned to the bottom of the page, right above the
            nav. Same gate as the Profile drawer's own card: gone once
            installed, so it never lingers for someone who already has it. */}
        {(installState.kind === "promptable" || installState.kind === "ios-manual") && (
          <div className="install-bar">
            <span className="install-bar-text">
              <IconDownload />
              Get the 75 Hard app
            </span>
            {installState.kind === "promptable" ? (
              <button
                type="button"
                className="install-bar-btn"
                onClick={async () => {
                  const accepted = await installState.install();
                  flash(accepted ? "Installed — check your home screen" : "Maybe next time");
                }}
              >
                Install
              </button>
            ) : (
              <span className="install-bar-hint">Share ▸ Add to Home Screen</span>
            )}
          </div>
        )}

        <nav className="game-bottomnav" role="tablist" aria-label="Sections">
          <button
            className={`nav-btn${openPanel === null ? " on" : ""}`}
            role="tab"
            aria-selected={openPanel === null}
            onClick={() => setOpenPanel(null)}
            title="Home"
          >
            <IconHome />
            HOME
          </button>
          <button
            className={`nav-btn${openPanel === "stats" ? " on" : ""}`}
            role="tab"
            aria-selected={openPanel === "stats"}
            onClick={() => togglePanel("stats")}
            title="Stats"
          >
            <IconStats />
            STATS
          </button>
          <button
            className={`nav-btn${openPanel === "profile" ? " on" : ""}`}
            role="tab"
            aria-selected={openPanel === "profile"}
            onClick={() => togglePanel("profile")}
            title="Profile"
          >
            <IconProfile />
            PROFILE
          </button>
          <button
            className={`nav-btn${openPanel === "pomodoro" ? " on" : ""}`}
            role="tab"
            aria-selected={openPanel === "pomodoro"}
            onClick={() => togglePanel("pomodoro")}
            title="Focus timer"
          >
            <IconTimer />
            FOCUS
          </button>
        </nav>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {saveError && (
        <div className="save-error-banner" role="alert">
          <span>⚠ Not saved — {saveError}</span>
          <button
            type="button"
            onClick={() => {
              if (meId == null) return;
              Promise.all([loadBoard(meId), api.day(meId, day)])
                .then(([, d]) => {
                  setDetail(d);
                  setSaveError(null);
                })
                .catch(() => flash("Still can't reach the server"));
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
