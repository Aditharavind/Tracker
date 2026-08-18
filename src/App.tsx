import { useCallback, useEffect, useRef, useState } from "react";
import { api, shiftISO, todayISO } from "./api";
import type { DayDetail, Progress, TaskItem, User } from "./types";
import Onboard from "./components/Onboard";
import Checklist from "./components/Checklist";
import Calendar75 from "./components/Calendar75";
import Badges from "./components/Badges";
import Rivals from "./components/Rivals";
import Runner, { Avatar3D, Sprite, type AvatarId } from "./components/Runner";
import ThemePicker, { THEMES, type ThemeId } from "./components/ThemePicker";
import SnoozePanda from "./components/SnoozePanda";
import { playAlarmSiren, playDiscoBeat, primeAudio } from "./discoSound";

const LAST_USER = "75hard.user";
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

const THEME_KEY = "75hard.theme";
const AVATAR_KEY = "75hard.avatar";
const SNOOZE_KEY = "75hard.snooze";
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

/** Local midnight tonight, so a dismiss lasts exactly until tomorrow's alarm. */
const msUntilTomorrow = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime() - Date.now();
};
const AVATARS: AvatarId[] = ["guy", "girl"];

const storedTheme = (): ThemeId => {
  const saved = localStorage.getItem(THEME_KEY) as ThemeId | null;
  return THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : "dark";
};

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

function ShareDialog({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
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
        <h3>Share {name}'s progress</h3>
        <p className="muted">Read only -- no PIN, no editing. Works for anyone who has the link.</p>
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
 * Mirrors the real layout's boxes so the page doesn't jump when data lands.
 * Nothing here animates in from nothing -- it just fills in.
 */
function Skeleton() {
  return (
    <div className="shell" aria-busy="true" aria-label="Loading">
      <div className="skel-topbar">
        <div className="skel skel-mark" />
        <div className="skel skel-pill" />
      </div>
      <div className="skel-hero">
        <div>
          <div className="skel skel-count" />
          <div className="skel skel-sub" />
        </div>
        <div className="skel skel-ring" />
      </div>
      <div className="skel-cols">
        <div className="skel skel-card tall" />
        <div>
          <div className="skel skel-card" />
          <div className="skel skel-card" style={{ marginTop: 18 }} />
        </div>
      </div>
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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [avatars, setAvatars] = useState<Record<number, AvatarId>>(storedAvatars);
  const [pendingAvatar, setPendingAvatar] = useState<AvatarId>("guy");
  const [adding, setAdding] = useState(false);
  const [disco, setDisco] = useState(false);
  const [unlockedPins, setUnlockedPins] = useState<Record<number, string>>({});
  const [pinPrompt, setPinPrompt] = useState<{ userId: number; error?: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [snoozed, setSnoozed] = useState<Record<number, number>>(storedSnooze);
  const [waving, setWaving] = useState(false);
  const [, forceTick] = useState(0);
  const todayRef = useRef(todayISO());
  const minuteRef = useRef("");
  const noteTimer = useRef<number | undefined>(undefined);
  const discoTimer = useRef<number | undefined>(undefined);
  const waveTimer = useRef<number | undefined>(undefined);
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
    // match the phone's status bar / address bar to the theme
    const bg = getComputedStyle(document.body).backgroundColor;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [theme]);

  // Chrome fires this instead of showing its own install banner; stashing it
  // lets us offer the button at a sensible moment. iOS never fires it -- there
  // you add to the home screen from the share sheet.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // The saved id is already in localStorage, so users/board/day don't need to
  // wait on each other -- chaining them cost three round trips before anything
  // rendered. Only the no-saved-user case still has to resolve users first.
  useEffect(() => {
    const saved = Number(localStorage.getItem(LAST_USER)) || undefined;
    if (saved) {
      loadUsers(saved);
      loadBoard(saved);
      return;
    }
    loadUsers(undefined).then((list) => {
      if (list.length) loadBoard(list[0].id);
    });
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
        const prevDay = todayRef.current;
        todayRef.current = nowDay;
        setDay((d) => (d === prevDay ? nowDay : d));
        if (meId != null) loadBoard(meId);
      }
      const nowMin = new Date().toTimeString().slice(0, 5);
      if (nowMin !== minuteRef.current) {
        minuteRef.current = nowMin;
        forceTick((n) => n + 1);
      }
    };
    const id = window.setInterval(check, 1000);
    // Backgrounded tabs get their timers throttled hard (and a sleeping phone
    // stops them outright), so re-check the instant we're visible again.
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
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

  // Web Audio refuses to start outside a user gesture, so an alarm firing on a
  // timer plays nothing unless the context was already unlocked. Grab the first
  // tap of the session to warm it up.
  useEffect(() => {
    const on = () => primeAudio();
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
  const alarmActive =
    day === todayISO() &&
    !!myUser?.wake_time &&
    !!lockedTask &&
    !lockedTask.done &&
    Date.now() >= silencedUntil &&
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
      // Put the optimistic tick back if the server refused it. The alarm keys
      // off this exact flag, so without the rollback a failed save (wrong
      // cached PIN, offline) still dismissed the alarm -- siren off, reps
      // never actually recorded.
      let res;
      try {
        res = await api.toggle(meId, t.id, day, !t.done, pin);
      } catch (e) {
        setDetail(curDetail);
        throw e;
      }
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

  const signOut = () => {
    if (!confirm("Sign out on this device? You'll need your name and PIN to get back in.")) return;
    localStorage.removeItem(LAST_USER);
    setMeId(null);
    setUsers([]);
    setBoard([]);
    setDetail(null);
    setUnlockedPins({});
  };

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
          setUnlockedPins((p) => ({ ...p, [u.id]: pin }));
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

  const isToday = day === todayISO();

  return (
    <div className={`shell${disco ? " disco" : ""}`} style={{ ["--u" as string]: me.color }}>
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
      {shareUrl && <ShareDialog name={me.name} url={shareUrl} onClose={() => setShareUrl(null)} />}
      <div className={disco ? "disco-tint" : undefined}>
      <header className="topbar">
        <div className="wordmark">
          <b>75</b>
          <span>hard</span>
        </div>
        <div className="who">
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
          <ThemePicker theme={theme} onPick={setTheme} />
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
                  await api.createUser(name.trim(), palette[users.length % palette.length], pin.trim(), null, 20, meId ?? undefined);
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
          <button
            className="pill"
            title="Get a read-only link to your progress -- no PIN, no editing"
            onClick={() => {
              const token = users.find((u) => u.id === meId)?.share_token;
              if (!token) return;
              setShareUrl(`${location.origin}${location.pathname}?share=${token}`);
            }}
          >
            Share
          </button>
          <button
            className="pill signout"
            title="Sign out on this device"
            aria-label="Sign out"
            onClick={signOut}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6.2 2.4H3.4a1 1 0 0 0-1 1v9.2a1 1 0 0 0 1 1h2.8M10.2 11.2 13.4 8l-3.2-3.2M13.4 8H6.4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="counter">
            <span className="big num">{String(me.day_number).padStart(2, "0")}</span>
            <span className="of">/ 75</span>
          </div>
          <div className="hero-sub">
            <span className="streakchip">{me.streak} day streak</span>
            <span className="sep">|</span>
            <span>
              best <b className="num">{me.best_streak}</b>
            </span>
            <span className="sep">|</span>
            <span>
              <b className="num">{me.perfect_days_ever}</b> perfect day
              {me.perfect_days_ever === 1 ? "" : "s"}
            </span>
            {me.resets > 0 && (
              <>
                <span className="sep">|</span>
                <span>
                  <b className="num">{me.resets}</b> restart{me.resets > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
        <LevelRing p={me} />
      </section>

      <div className="cols">
        <div>
          <Runner detail={detail} avatar={myAvatar} onRemove={removeTask} />

          <Checklist
            detail={detail}
            day={day}
            onShift={(delta) => {
              const next = shiftISO(day, delta);
              if (next <= todayISO()) setDay(next);
            }}
            onToggle={toggle}
            onAdd={addTask}
            onRemove={removeTask}
          />

          <div className="card">
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

        <div>
          <Rivals board={board} meId={me.user_id} />
          <Badges p={me} />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Calendar75 cells={me.calendar} onPick={setDay} />
      </div>

      <div
        style={{
          marginTop: 22,
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {installPrompt && (
          <button
            className="btn"
            onClick={async () => {
              await installPrompt.prompt();
              setInstallPrompt(null);
            }}
          >
            Add to home screen
          </button>
        )}
        <button className="btn ghost" onClick={restart}>
          Reset my run
        </button>
      </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
