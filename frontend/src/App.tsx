import { useCallback, useEffect, useRef, useState } from "react";
import { api, shiftISO, todayISO } from "./api";
import type { DayDetail, Progress, TaskItem, User } from "./types";
import { LAST_USER_KEY } from "./constants";
import Onboard from "./components/Onboard";
import Checklist from "./components/Checklist";
import Calendar75 from "./components/Calendar75";
import Badges from "./components/Badges";
import Rivals from "./components/Rivals";
import { Avatar3D, Sprite, type AvatarId } from "./components/Runner";
import ForestScene from "./components/forest/ForestScene";
import LivesHUD from "./components/forest/LivesHUD";
import FailureBanner from "./components/forest/FailureBanner";
import ThemePicker, { THEMES, type ThemeId } from "./components/ThemePicker";
import { playAlarmSiren, playDiscoBeat } from "./discoSound";

const LAST_USER = LAST_USER_KEY;
const THEME_KEY = "75hard.theme";
const AVATAR_KEY = "75hard.avatar";
const AVATARS: AvatarId[] = ["guy", "girl", "panda"];

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

const storedAvatars = (): Record<number, AvatarId> => {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
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

function PinPrompt({
  name,
  error,
  onSubmit,
  onCancel,
}: {
  name: string;
  error?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  return (
    <div className="pin-backdrop" onClick={onCancel}>
      <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{name}'s PIN</h3>
        <p className="muted">Needed to edit {name}'s progress -- viewing never needs it.</p>
        <input
          className="field"
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && pin && onSubmit(pin)}
        />
        {error && <p className="pin-error">{error}</p>}
        <button className="btn primary wide" disabled={!pin} onClick={() => onSubmit(pin)}>
          Unlock
        </button>
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

function AlarmOverlay({ task, onDone }: { task: TaskItem; onDone: () => void }) {
  useEffect(() => {
    const stop = playAlarmSiren();
    return stop;
  }, []);

  return (
    <div className="alarm-overlay">
      <div className="alarm-emoji">⏰</div>
      <h1>Time to get up</h1>
      <p>{task.title} -- the alarm won't stop until you have.</p>
      <button className="btn primary wide alarm-btn" onClick={onDone}>
        Done -- {task.reps_target ?? 20} reps
      </button>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [board, setBoard] = useState<Progress[]>([]);
  const [day, setDay] = useState(todayISO());
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeId>(storedTheme);
  const [avatars, setAvatars] = useState<Record<number, AvatarId>>(storedAvatars);
  const [pendingAvatar, setPendingAvatar] = useState<AvatarId>("guy");
  const [adding, setAdding] = useState(false);
  const [disco, setDisco] = useState(false);
  const [unlockedPins, setUnlockedPins] = useState<Record<number, string>>({});
  const [pinPrompt, setPinPrompt] = useState<{ userId: number; error?: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<null | "leaderboard" | "stats" | "habits" | "profile">(null);
  const [habitDraft, setHabitDraft] = useState("");
  const [, forceTick] = useState(0);
  const noteTimer = useRef<number | undefined>(undefined);
  const discoTimer = useRef<number | undefined>(undefined);
  const pinRetry = useRef<((pin: string) => void) | null>(null);

  const me = board.find((p) => p.user_id === meId) ?? null;
  const myAvatar: AvatarId = (meId != null && avatars[meId]) || "guy";

  // Viewing (board/progress/day) never needs a PIN -- only mutating a
  // user's own data does. `fn` receives the unlocked PIN (or undefined for
  // legacy users who never set one) and is retried once a correct PIN is
  // supplied; a 403 from the backend means a stale/wrong cached PIN, which
  // gets cleared so the prompt reappears instead of failing silently.
  const runWithPin = (userId: number, fn: (pin?: string) => Promise<void>) => {
    const user = users?.find((u) => u.id === userId);
    const cached = unlockedPins[userId];
    if (user?.has_pin && cached === undefined) {
      pinRetry.current = (pin: string) => {
        fn(pin)
          .then(() => {
            setUnlockedPins((p) => ({ ...p, [userId]: pin }));
            setPinPrompt(null);
          })
          .catch(() => setPinPrompt({ userId, error: "wrong PIN" }));
      };
      setPinPrompt({ userId });
      return;
    }
    fn(cached).catch((e) => {
      if (e instanceof Error && /pin/i.test(e.message)) {
        setUnlockedPins((p) => {
          const next = { ...p };
          delete next[userId];
          return next;
        });
      }
      throw e;
    });
  };

  const setAvatarFor = (userId: number, a: AvatarId) => {
    setAvatars((prev) => {
      const next = { ...prev, [userId]: a };
      localStorage.setItem(AVATAR_KEY, JSON.stringify(next));
      return next;
    });
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const partyTime = () => {
    setDisco(true);
    playDiscoBeat(4200);
    window.clearTimeout(discoTimer.current);
    discoTimer.current = window.setTimeout(() => setDisco(false), 4200);
  };

  // Boards are scoped per group server-side -- `asUserId` tells the backend
  // whose group to look up. Omit it only for a browser with no local user
  // yet (a brand new, still-empty board).
  const loadUsers = useCallback(async (asUserId?: number) => {
    const list = await api.users(asUserId);
    setUsers(list);
    if (list.length) {
      const pick = list.find((u) => u.id === asUserId) ?? list[0];
      setMeId((cur) => cur ?? pick.id);
    }
    return list;
  }, []);

  const loadBoard = useCallback(async (asUserId?: number) => setBoard(await api.board(asUserId)), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      const storedId = Number(localStorage.getItem(LAST_USER)) || undefined;
      let saved = storedId;
      // No saved local user (cleared storage, new device) -- ask whether
      // this IP was last seen as someone, so a returning player lands
      // pre-selected on their own tile instead of the onboarding screen.
      // Pure convenience: a wrong/missing suggestion just falls back to
      // today's behaviour, and editing still needs the right PIN either way.
      if (saved == null) {
        try {
          const suggestion = await api.suggestSession();
          if (suggestion.user_id != null) saved = suggestion.user_id;
        } catch {
          // ignore -- fall through to the normal onboarding path
        }
      }
      const list = await loadUsers(saved);
      if (list.length) await loadBoard(saved ?? list[0].id);
    })();
  }, [loadUsers, loadBoard]);

  useEffect(() => {
    if (meId == null) return;
    localStorage.setItem(LAST_USER, String(meId));
    api.day(meId, day).then((d) => {
      setDetail(d);
      setNote(d.note);
      setNoteState("idle");
    });
  }, [meId, day]);

  // The alarm condition (current time vs. wake_time) isn't itself reactive
  // state -- this just forces a re-render often enough to notice crossing it.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const myUser = users?.find((u) => u.id === meId) ?? null;
  const lockedTask = detail?.tasks.find((t) => t.locked) ?? null;
  const alarmActive =
    day === todayISO() &&
    !!myUser?.wake_time &&
    !!lockedTask &&
    !lockedTask.done &&
    new Date().toTimeString().slice(0, 8) >= myUser!.wake_time!;

  const toggle = (t: TaskItem) => {
    if (meId == null || !detail) return;
    const curDetail = detail;
    const curMe = me;
    runWithPin(meId, async (pin) => {
      const wasPerfect = curMe?.perfect_today ?? false;
      const wasFullClear = curDetail.tasks.length > 0 && curDetail.tasks.every((x) => x.done);
      setDetail({
        ...curDetail,
        tasks: curDetail.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)),
      });
      const res = await api.toggle(meId, t.id, day, !t.done, pin);
      setDetail(res.day);
      setBoard((b) => b.map((p) => (p.user_id === meId ? res.progress : p)));

      const nowFullClear = res.day.tasks.length > 0 && res.day.tasks.every((x) => x.done);
      const becameFullClear = day === todayISO() && !wasFullClear && nowFullClear;
      if (day === todayISO() && !wasPerfect && res.progress.perfect_today) {
        const hit = res.progress.badges.find((x) => x.day === res.progress.streak && x.earned);
        flash(hit ? `${hit.name} unlocked - day ${res.progress.streak}` : `Day ${res.progress.day_number} locked in`);
      } else if (becameFullClear) {
        flash("Full clear - nothing left today");
      }
      if (becameFullClear) partyTime();
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
    setNoteState("saving");
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      if (meId == null) return;
      runWithPin(meId, async (pin) => {
        await api.saveNote(meId, day, text, pin);
        setNoteState("saved");
      });
    }, 600);
  };

  const restart = () => {
    if (meId == null) return;
    if (!confirm("Wipe the current run and start again from day 1 today?")) return;
    runWithPin(meId, async (pin) => {
      await api.restart(meId, pin);
      await loadBoard(meId);
      flash("Back to day 1. Go.");
    });
  };

  if (users === null) return <div className="shell muted">loading...</div>;

  if (users.length === 0) {
    return (
      <Onboard
        theme={theme}
        onTheme={setTheme}
        avatar={pendingAvatar}
        onAvatar={setPendingAvatar}
        existing={[]}
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

  if (!me || !detail) return <div className="shell muted">loading...</div>;

  const isToday = day === todayISO();
  const bankedDays = me.calendar.filter((c) => c.status === "done").length;
  const overallProgressPct = Math.round((bankedDays / 75) * 100);

  const togglePanel = (p: "leaderboard" | "stats" | "habits" | "profile") =>
    setOpenPanel((cur) => (cur === p ? null : p));

  return (
    <div className={`game-shell${disco ? " disco" : ""}`} style={{ ["--u" as string]: me.color }}>
      {disco && (
        <div className="disco-overlay" aria-hidden="true">
          <span className="disco-ball">🪩</span>
        </div>
      )}
      {disco && (
        <div className="disco-finale">
          <Avatar3D avatar={myAvatar} running zoomed />
        </div>
      )}
      {alarmActive && lockedTask && <AlarmOverlay task={lockedTask} onDone={() => toggle(lockedTask)} />}
      {pinPrompt && (
        <PinPrompt
          name={users.find((u) => u.id === pinPrompt.userId)?.name ?? "that user"}
          error={pinPrompt.error}
          onCancel={() => {
            pinRetry.current = null;
            setPinPrompt(null);
          }}
          onSubmit={(pin) => pinRetry.current?.(pin)}
        />
      )}
      {shareUrl && <ShareDialog name={me.name} url={shareUrl} kind="share" onClose={() => setShareUrl(null)} />}
      {inviteUrl && <ShareDialog name={me.name} url={inviteUrl} kind="invite" onClose={() => setInviteUrl(null)} />}

      <div className={`game-shell-inner${disco ? " disco-tint" : ""}`}>
        <header className="game-topbar">
          <button
            className="hamburger-btn"
            aria-label="Menu"
            aria-expanded={openPanel !== null}
            onClick={() => togglePanel("profile")}
          >
            <IconMenu />
          </button>
          <div className="game-title pixel-font">75 DAY HARD CHALLENGE</div>
          <div className="topbar-lives">
            <LivesHUD resets={me.resets} />
          </div>
        </header>

        <div className="stage-area">
          <ForestScene detail={detail} dayNumber={me.day_number} seed={`${meId}:${day}`} resets={me.resets} />

          <div className="day-card-float">
            <Checklist
              detail={detail}
              day={day}
              dayNumber={me.day_number}
              onShift={(delta) => {
                const next = shiftISO(day, delta);
                if (next <= todayISO()) setDay(next);
              }}
              onToggle={toggle}
              onAdd={addTask}
              onRemove={removeTask}
              hideAddRow
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

          <div className="failure-banner-float">
            <FailureBanner resets={me.resets} />
          </div>

          {openPanel === "leaderboard" && (
            <div className="panel-drawer">
              <div className="panel-drawer-head">
                <h2>Leaderboard</h2>
                <button className="panel-close" aria-label="Close" onClick={() => setOpenPanel(null)}>
                  <IconClose />
                </button>
              </div>
              <Rivals board={board} meId={me.user_id} />
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
              <div className="panel-drawer-head">
                <h2>Profile</h2>
                <button className="panel-close" aria-label="Close" onClick={() => setOpenPanel(null)}>
                  <IconClose />
                </button>
              </div>

              <div className="card panel-section">
                <div className="card-head">
                  <h2>Your character</h2>
                </div>
                <div className="avatars" role="group" aria-label="Your character">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      className={`avatar-btn${a === myAvatar ? " on" : ""}`}
                      onClick={() => meId != null && setAvatarFor(meId, a)}
                      title={`play as ${a}`}
                      aria-label={`play as ${a}`}
                      aria-pressed={a === myAvatar}
                    >
                      <Sprite avatar={a} running={false} />
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <ThemePicker theme={theme} onPick={setTheme} />
                </div>
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

              <div className="card panel-section" style={{ textAlign: "center" }}>
                <button className="btn ghost" onClick={restart}>
                  Reset my run
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
    </div>
  );
}
