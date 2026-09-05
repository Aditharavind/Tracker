import { useCallback, useEffect, useRef, useState } from "react";
import { api, deviceTimezone, isPermanentFailure, shiftISO, todayISO } from "./api";
import * as outbox from "./outbox";
import type { DayDetail, NeglectedTask, Progress, TaskItem, User } from "./types";
import { LAST_USER_KEY } from "./constants";
import Onboard from "./components/Onboard";
import Checklist from "./components/Checklist";
import Calendar75 from "./components/Calendar75";
import Badges from "./components/Badges";
import Rivals from "./components/Rivals";
import DashLeaderboard from "./components/DashLeaderboard";
import NeglectedTasks from "./components/NeglectedTasks";
import type { AvatarId } from "./components/Runner";
import ForestScene from "./components/forest/ForestScene";
import LivesHUD from "./components/forest/LivesHUD";
import DayCompleteOverlay from "./components/forest/DayCompleteOverlay";
import PandaRunner from "./components/forest/PandaRunner";
import WorldUnlockOverlay from "./components/forest/WorldUnlockOverlay";
import CharacterTurntable from "./components/forest/CharacterTurntable";
import { getStage, type StageMeta } from "./game/stageSystem";
import { isAlarmDue, toMinutes } from "./game/alarm";
import CharacterSelect from "./components/CharacterSelect";
import { CHARACTER_SPRITE, isCharacterId, type CharacterId } from "./game/characters";
import FailureBanner from "./components/forest/FailureBanner";
import ThemePicker, { THEMES, type ThemeId } from "./components/ThemePicker";
import SnoozePanda from "./components/SnoozePanda";
import { playAlarmSiren, primeAudio } from "./discoSound";
import { isMuted, primeJump, toggleMuted } from "./sound";

const LAST_USER = LAST_USER_KEY;
const THEME_KEY = "75hard.theme";
const AVATAR_KEY = "75hard.avatar";
const CHARACTER_KEY = "75hard.character";
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

const storedTheme = (): ThemeId => {
  const saved = localStorage.getItem(THEME_KEY) as ThemeId | null;
  return THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : "dark";
};

function IconMenu() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M14 2 2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Close control for the Leaderboard drawer specifically -- a tiny panda
// climbing down a diagonal wooden plank, echoing the forest theme instead of
// a generic X, per the request to reskin that one dismiss control.
function IconPandaDescend() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true">
      <rect
        x="2"
        y="12"
        width="20"
        height="4.4"
        rx="1"
        transform="rotate(-24 2 12)"
        fill="#6b4a1e"
        stroke="#3a2810"
        strokeWidth="1"
      />
      <rect x="3.4" y="13.9" width="16.4" height="0.9" transform="rotate(-24 3.4 13.9)" fill="#4c3315" opacity="0.6" />
      <g transform="translate(6.4 2.4) rotate(-24)">
        <circle cx="4" cy="4" r="3.6" fill="#f4f1ea" stroke="#241804" strokeWidth="0.6" />
        <circle cx="1.3" cy="1.7" r="1.3" fill="#241804" />
        <circle cx="6.7" cy="1.7" r="1.3" fill="#241804" />
        <ellipse cx="2.3" cy="4.2" rx="1" ry="1.3" fill="#241804" />
        <ellipse cx="5.7" cy="4.2" rx="1" ry="1.3" fill="#241804" />
        <ellipse cx="4" cy="5.6" rx="0.7" ry="0.5" fill="#241804" />
      </g>
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

function IconHabits() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5.5h8M4 8h8M4 10.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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

function IconCoin() {
  // Same panda-face coin art as forest/Coin.tsx, for the topbar tally.
  return (
    <svg width="18" height="18" viewBox="0 0 17 17" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="8.1" fill="#3a2708" opacity="0.55" />
      <circle cx="8.5" cy="8.5" r="7.6" fill="#f0c04a" stroke="#8a5a17" strokeWidth="1" />
      <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="#c98f2e" strokeWidth="0.6" />
      <ellipse cx="5.6" cy="6.2" rx="1.3" ry="1.3" fill="#8a5a17" />
      <ellipse cx="11.4" cy="6.2" rx="1.3" ry="1.3" fill="#8a5a17" />
      <ellipse cx="8.5" cy="8.4" rx="3.6" ry="3.2" fill="#fff3c9" />
      <ellipse cx="6.7" cy="8.1" rx="1" ry="1.3" fill="#8a5a17" />
      <ellipse cx="10.3" cy="8.1" rx="1" ry="1.3" fill="#8a5a17" />
      <ellipse cx="8.5" cy="9.6" rx="0.6" ry="0.4" fill="#8a5a17" />
      <circle cx="6" cy="5.4" r="1" fill="#fff8e2" opacity="0.7" />
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

function IconGear() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8.5 1.7v2M8.5 13.3v2M1.7 8.5h2M13.3 8.5h2M3.5 3.5l1.4 1.4M12.1 12.1l1.4 1.4M13.5 3.5l-1.4 1.4M4.9 12.1l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 10.2 9.1 3.1l1.8 1.8L3.8 12H2v-1.8Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path d="M9.1 3.1 10.4 1.8a1 1 0 0 1 1.4 0l.4.4a1 1 0 0 1 0 1.4L10.9 4.9Z" fill="currentColor" />
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

export function LevelRing({ p }: { p: Progress }) {
  const span = (p.level_ceiling ?? p.xp) - p.level_floor;
  const pct = p.level_ceiling === null ? 1 : span > 0 ? (p.xp - p.level_floor) / span : 0;
  const r = 44;
  const c = 2 * Math.PI * r;

  return (
    <div className="ring">
      <svg width="108" height="108">
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="6" />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="ring-mid">
        <div className="lv">Lv {p.level}</div>
        <div className="name">{p.level_name}</div>
        <div className="xp">
          {p.level_ceiling === null ? `${p.xp} xp` : `${p.xp}/${p.level_ceiling}`}
        </div>
      </div>
    </div>
  );
}

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
  return (
    <div className="game-shell" aria-busy="true" aria-label="Loading">
      <div className="game-shell-inner">
        <header className="game-topbar">
          <div className="skel" style={{ width: 38, height: 38, borderRadius: 9 }} />
          <div className="skel" style={{ width: 180, height: 14, borderRadius: 6 }} />
          <div className="skel" style={{ width: 60, height: 22, borderRadius: 6 }} />
        </header>
        <div className="stage-area">
          <div className="day-card-float skel" style={{ height: "60%" }} />
        </div>
        <nav className="game-bottomnav">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skel" style={{ width: 46, height: 34, borderRadius: 8 }} />
          ))}
        </nav>
      </div>
    </div>
  );
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
  const [theme, setTheme] = useState<ThemeId>(storedTheme);
  // Value unused since the Runner-avatar picker was removed; the setter still
  // persists the pick chosen during onboarding.
  const [, setAvatars] = useState<Record<number, AvatarId>>(storedAvatars);
  const [pendingAvatar, setPendingAvatar] = useState<AvatarId>("guy");
  const [characters, setCharacters] = useState<Record<number, CharacterId>>(storedCharacters);
  const [characterPanelOpen, setCharacterPanelOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<null | "leaderboard" | "stats" | "habits" | "profile">(null);
  const [habitDraft, setHabitDraft] = useState("");
  const [snoozed, setSnoozed] = useState<Record<number, number>>(storedSnooze);
  const [waving, setWaving] = useState(false);
  const [livesOpen, setLivesOpen] = useState(false);
  const [dayCompleteOpen, setDayCompleteOpen] = useState(false);
  const [worldUnlock, setWorldUnlock] = useState<StageMeta | null>(null);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [muted, setMuted] = useState(isMuted);
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
  const [neglected, setNeglected] = useState<NeglectedTask[]>([]);
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

  const me = board.find((p) => p.user_id === meId) ?? null;
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
    // Day's done -- surface the standings so you see where the day landed you.
    setOpenPanel("leaderboard");
  };

  // New-world unlock (skill STAGE 4): the run reaching a chapter's first day
  // means that many days banked without a reset ("25 days consistency" ->
  // World 3), so announce it once per stage. day_number is the source of
  // truth for the stage, so this is purely a celebratory readout.
  const meDayNumber = me?.day_number ?? 0;
  useEffect(() => {
    if (meId == null || meDayNumber < 1) return;
    const stage = getStage(meDayNumber);
    if (stage.id <= 1 || meDayNumber !== stage.minDay) return;
    const key = `75hard.world:${meId}:${stage.id}`;
    try {
      if (localStorage.getItem(key) === "1") return;
    } catch {
      /* private mode -- just show it */
    }
    setWorldUnlock(stage);
  }, [meId, meDayNumber]);

  const closeWorldUnlock = () => {
    const stage = worldUnlock;
    setWorldUnlock(null);
    try {
      if (stage && meId != null) localStorage.setItem(`75hard.world:${meId}:${stage.id}`, "1");
    } catch {
      /* ignore */
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
    setCharacterPanelOpen(false);
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

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
        setDay((d) => (followToday.current ? nowDay : d));
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
    const t = { id: taskId };

    api
      .toggle(meId, taskId, day, next)
      .then((res) => {
        // The write was accepted (a non-2xx would have thrown), so `next` is
        // what the box must show. The day payload that comes back with it is a
        // convenience read, and a convenience read is not worth overruling the
        // user's own action: anything that made it disagree -- a stale read
        // after the write, a racing request, a proxy serving a cached body --
        // would show up as the box silently flipping back on its own, which is
        // precisely the fault being chased here. Take the rest of the payload,
        // keep our value for the task we just wrote, and keep the optimistic
        // value for any sibling whose own write is still in flight.
        if (res.day.tasks.find((x) => x.id === t.id)?.done !== next) {
          console.warn("[toggle] server echoed a different value than written", {
            taskId: t.id,
            wrote: next,
            echoed: res.day.tasks.find((x) => x.id === t.id)?.done,
          });
        }
        setDetail((cur) => {
          if (!cur) return res.day;
          return {
            ...res.day,
            tasks: res.day.tasks.map((x) => {
              if (x.id === t.id) return { ...x, done: next };
              if (pendingToggles.current.has(x.id)) {
                return { ...x, done: cur.tasks.find((c) => c.id === x.id)?.done ?? x.done };
              }
              return x;
            }),
          };
        });
        setBoard((b) => b.map((p) => (p.user_id === meId ? res.progress : p)));
        setSaveError(null);
        // Confirmed by the server -- nothing left to replay for this task.
        outbox.forget({ userId: meId, taskId, day });

        const nowFullClear = res.day.tasks.length > 0 && res.day.tasks.every((x) => x.done);
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
          outbox.forget({ userId: meId, taskId, day });
          // Undo only this task, and only if the user has not since asked for
          // something else -- a queued intent is newer than this failure, so
          // reverting to the pre-request value would fight the person tapping.
          if (!queuedToggles.current.has(t.id)) {
            setDetail((cur) =>
              cur
                ? { ...cur, tasks: cur.tasks.map((x) => (x.id === t.id ? { ...x, done: !next } : x)) }
                : cur
            );
          }
        }
        const msg = e instanceof Error ? e.message : "Could not update task";
        flash(msg);
        setSaveError(msg);
      })
      .finally(() => {
        pendingToggles.current.delete(t.id);
        const queued = queuedToggles.current.get(t.id);
        if (queued === undefined) {
          // Settled and nothing outstanding: hand authority back to server state.
          intendedDone.current.delete(t.id);
          return;
        }
        queuedToggles.current.delete(t.id);
        // Only worth a round trip if it actually differs from what we just wrote.
        if (queued !== next) sendToggle(t.id, queued);
        else intendedDone.current.delete(t.id);
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
    if (!confirm("Wipe the current run and start again from day 1 today?")) return;
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
      setCharacterPanelOpen(false);
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

  // Global Forest Dash leaderboard -- pulled when the board opens or the
  // minigame closes (a fresh score may have landed).
  useEffect(() => {
    if (!shellVisible) return;
    if (openPanel === "leaderboard" || !runnerOpen) {
      api.dashLeaderboard().then(setDashBoard).catch(() => setDashBoard([]));
    }
  }, [openPanel, runnerOpen, shellVisible]);

  // Which tasks the user has been quietly skipping -- recomputed server-side
  // from real completions each time the Habits panel opens (see
  // server/insights.js). Only ever looks at days before today, so it can't
  // change from ticking today's boxes -- no need to refetch on every tap.
  useEffect(() => {
    if (!shellVisible || openPanel !== "habits" || meId == null) return;
    api
      .insights(meId)
      .then((r) => setNeglected(r.neglected))
      .catch(() => setNeglected([]));
  }, [shellVisible, openPanel, meId]);

  if (users === null) return <Skeleton />;

  if (users.length === 0) {
    return (
      <Onboard
        theme={theme}
        onTheme={setTheme}
        avatar={pendingAvatar}
        onAvatar={setPendingAvatar}
        existing={[]}
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
  // user id, then never again -- selecting from the HUD later (see
  // characterPanelOpen below) reuses the same component in "switch" mode
  // instead of this blocking one.
  if (!myCharacter) {
    return <CharacterSelect mode="gate" onSelect={(c) => setCharacterFor(meId!, c)} />;
  }

  const isToday = day === todayISO();
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

  const togglePanel = (p: "leaderboard" | "stats" | "habits" | "profile") =>
    setOpenPanel((cur) => (cur === p ? null : p));

  return (
    <div className="game-shell" style={{ ["--u" as string]: me.color }}>
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
      {characterPanelOpen && (
        <CharacterSelect
          mode="switch"
          current={myCharacter}
          onSelect={(c) => setCharacterFor(meId!, c)}
          onClose={() => setCharacterPanelOpen(false)}
        />
      )}
      {dayCompleteOpen && (
        <DayCompleteOverlay
          dayNumber={me.day_number}
          tasksCompleted={detail.tasks.filter((t) => t.done).length}
          totalTasks={detail.tasks.length}
          coins={coinsEarned}
          streak={me.streak}
          character={myCharacter}
          onClose={closeDayComplete}
          onPlayRunner={() => {
            setDayCompleteOpen(false);
            dayCompleteDismissed.current = day;
            setRunnerOpen(true);
          }}
        />
      )}
      {worldUnlock && (
        <WorldUnlockOverlay stage={worldUnlock} character={myCharacter} onClose={closeWorldUnlock} />
      )}
      {runnerOpen && myCharacter && (
        <PandaRunner
          character={myCharacter}
          userId={meId}
          onClose={() => setRunnerOpen(false)}
        />
      )}

      <div className="game-shell-inner">
        <header className="game-topbar">
          <button
            className="hamburger-btn"
            aria-label="Menu"
            aria-expanded={openPanel !== null}
            onClick={() => togglePanel("profile")}
          >
            <IconMenu />
          </button>
          <button
            type="button"
            className="topbar-character"
            onClick={() => setCharacterPanelOpen(true)}
            aria-label={`Character: ${myCharacter}. Change character.`}
          >
            <img src={CHARACTER_SPRITE[myCharacter]} alt="" aria-hidden="true" className="topbar-character-sprite" />
            <span className="topbar-character-name pixel-font">{myCharacter.toUpperCase()}</span>
          </button>
          <div className="game-title pixel-font">75 DAY HARD CHALLENGE</div>
          <div className="topbar-coins" aria-label={`${coinsEarned} coins earned`}>
            <IconCoin />
            <span className="topbar-coins-count pixel-font">×{String(coinsEarned).padStart(2, "0")}</span>
          </div>
          <div
            className={`topbar-lives${livesOpen ? " open" : ""}`}
            onMouseLeave={() => setLivesOpen(false)}
          >
            <LivesHUD
              completed={detail.tasks.filter((t) => t.done).length}
              total={detail.tasks.length}
              resets={me.resets}
              expanded={livesOpen}
              onToggle={() => setLivesOpen((v) => !v)}
            />
            <div className="failure-banner-float" role="tooltip">
              <FailureBanner resets={me.resets} />
            </div>
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
          {openPanel === null && !characterPanelOpen && !runnerOpen && (
            <button
              type="button"
              className="dash-launch pixel-font"
              onClick={() => setRunnerOpen(true)}
              title="Forest Dash minigame — bonus, no effect on your challenge"
            >
              ▶ MINIGAME
            </button>
          )}
        </header>

        <div className="stage-area">
          <ForestScene
            detail={detail}
            dayNumber={me.day_number}
            seed={`${meId}:${day}`}
            resets={me.resets}
            character={myCharacter}
            onDayCleared={day === todayISO() ? handleDayCleared : undefined}
          />

          <div className="day-card-float">
            <button
              type="button"
              className="daycard-reset daycard-iconbtn pixel-font"
              onClick={restart}
              title="Reset run — wipe this run and start again from day 1"
              aria-label="Reset run"
            >
              <IconRestart />
            </button>
            <button
              type="button"
              className="daycard-edit daycard-iconbtn pixel-font"
              onClick={() => togglePanel("habits")}
              title="Edit your tasks"
              aria-label="Edit tasks"
            >
              <IconPencil />
            </button>
            <Checklist
              detail={detail}
              day={day}
              dayNumber={me.day_number}
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
              className={`rail-btn${openPanel === "stats" ? " on" : ""}`}
              onClick={() => togglePanel("stats")}
              aria-label="Stats"
              aria-pressed={openPanel === "stats"}
              title="Stats"
            >
              <IconStats />
            </button>
            <button
              className={`rail-btn${openPanel === "profile" ? " on" : ""}`}
              onClick={() => togglePanel("profile")}
              aria-label="Settings"
              aria-pressed={openPanel === "profile"}
              title="Settings"
            >
              <IconGear />
            </button>
          </div>

          {openPanel === "leaderboard" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head">
                <h2>Leaderboard</h2>
                <button className="panel-close panel-close-plank" aria-label="Close" onClick={() => setOpenPanel(null)}>
                  <IconPandaDescend />
                </button>
              </div>
              <Rivals board={board} meId={me.user_id} />

              {dashBoard.length > 0 && (
                <div className="card panel-section dash-board-card">
                  <div className="card-head">
                    <h2>Forest Dash — global</h2>
                  </div>
                  <DashLeaderboard rows={dashBoard} meName={me.name} />
                </div>
              )}
            </div>
          )}

          {openPanel === "stats" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head">
                <h2>Stats</h2>
                <button className="panel-close" aria-label="Close" onClick={() => setOpenPanel(null)}>
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
                  <div className="l">Restarts</div>
                </div>
              </div>

              <div className="panel-section" style={{ display: "flex", justifyContent: "center" }}>
                <LevelRing p={me} />
              </div>
              <div className="panel-section">
                <Badges p={me} />
              </div>
              <div className="panel-section">
                <Calendar75
                  cells={me.calendar}
                  onPick={(iso) => {
                    followToday.current = iso === todayISO();
                    setDay(iso);
                    setOpenPanel(null);
                  }}
                />
              </div>
            </div>
          )}

          {openPanel === "habits" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head">
                <h2>Habits</h2>
                <button className="panel-close" aria-label="Close" onClick={() => setOpenPanel(null)}>
                  <IconClose />
                </button>
              </div>
              <NeglectedTasks tasks={neglected} />
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
                      <button className="kill" onClick={() => removeTask(t)} aria-label={`delete ${t.title}`}>
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
                <div className="panel-close-stack">
                  <button
                    className="panel-close panel-close-red pixel-font"
                    aria-label="Close profile"
                    onClick={() => setOpenPanel(null)}
                  >
                    ✕
                  </button>
                  <span className="panel-close-hint pixel-font">press ESC to exit</span>
                </div>
              </div>

              <div className="card panel-section">
                <div className="card-head">
                  <h2>Your character</h2>
                </div>
                <CharacterTurntable
                  current={myCharacter}
                  onSelect={(c) => meId != null && setCharacterFor(meId, c)}
                />
                <div style={{ marginTop: 14 }}>
                  <ThemePicker theme={theme} onPick={setTheme} />
                </div>
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
                    title="Get a link that lets a friend join your lobby"
                    onClick={() => {
                      const token = users.find((u) => u.id === meId)?.invite_token;
                      if (!token) return;
                      setInviteUrl(`${location.origin}${location.pathname}?join=${token}`);
                    }}
                  >
                    Invite
                  </button>
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

        <nav className="game-bottomnav" role="tablist" aria-label="Sections">
          <button
            className={`nav-btn${openPanel === null ? " on" : ""}`}
            role="tab"
            aria-selected={openPanel === null}
            onClick={() => setOpenPanel(null)}
          >
            <IconHome />
            HOME
          </button>
          <button
            className={`nav-btn${openPanel === "stats" ? " on" : ""}`}
            role="tab"
            aria-selected={openPanel === "stats"}
            onClick={() => togglePanel("stats")}
          >
            <IconStats />
            STATS
          </button>
          <button
            className={`nav-btn${openPanel === "habits" ? " on" : ""}`}
            role="tab"
            aria-selected={openPanel === "habits"}
            onClick={() => togglePanel("habits")}
          >
            <IconHabits />
            HABITS
          </button>
          <button
            className={`nav-btn${openPanel === "profile" ? " on" : ""}`}
            role="tab"
            aria-selected={openPanel === "profile"}
            onClick={() => togglePanel("profile")}
          >
            <IconProfile />
            PROFILE
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
