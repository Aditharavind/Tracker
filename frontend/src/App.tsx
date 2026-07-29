import { useCallback, useEffect, useRef, useState } from "react";
import { api, shiftISO, todayISO } from "./api";
import type { DayDetail, Progress, TaskItem, User } from "./types";
import Onboard from "./components/Onboard";
import Checklist from "./components/Checklist";
import Calendar75 from "./components/Calendar75";
import Badges from "./components/Badges";
import Rivals from "./components/Rivals";

const LAST_USER = "75hard.user";

function LevelRing({ p }: { p: Progress }) {
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

export default function App() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [board, setBoard] = useState<Progress[]>([]);
  const [day, setDay] = useState(todayISO());
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const noteTimer = useRef<number | undefined>(undefined);

  const me = board.find((p) => p.user_id === meId) ?? null;

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const loadUsers = useCallback(async () => {
    const list = await api.users();
    setUsers(list);
    if (list.length) {
      const saved = Number(localStorage.getItem(LAST_USER));
      const pick = list.find((u) => u.id === saved) ?? list[0];
      setMeId((cur) => cur ?? pick.id);
    }
    return list;
  }, []);

  const loadBoard = useCallback(async () => setBoard(await api.board()), []);

  useEffect(() => {
    loadUsers().then((list) => {
      if (list.length) loadBoard();
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

  const toggle = async (t: TaskItem) => {
    if (meId == null || !detail) return;
    const wasPerfect = me?.perfect_today ?? false;
    setDetail({
      ...detail,
      tasks: detail.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)),
    });
    const res = await api.toggle(meId, t.id, day, !t.done);
    setDetail(res.day);
    setBoard((b) => b.map((p) => (p.user_id === meId ? res.progress : p)));

    if (day === todayISO() && !wasPerfect && res.progress.perfect_today) {
      const hit = res.progress.badges.find((x) => x.day === res.progress.streak && x.earned);
      flash(hit ? `${hit.name} unlocked - day ${res.progress.streak}` : `Day ${res.progress.day_number} locked in`);
    }
  };

  const addTask = async (title: string) => {
    if (meId == null || adding) return;
    setAdding(true);
    try {
      await api.addTask(meId, title, "+", false);
      setDetail(await api.day(meId, day));
      await loadBoard();
    } finally {
      setAdding(false);
    }
  };

  const removeTask = async (t: TaskItem) => {
    if (meId == null) return;
    await api.removeTask(meId, t.id);
    setDetail(await api.day(meId, day));
    await loadBoard();
  };

  const editNote = (text: string) => {
    setNote(text);
    setNoteState("saving");
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(async () => {
      if (meId == null) return;
      await api.saveNote(meId, day, text);
      setNoteState("saved");
    }, 600);
  };

  const restart = async () => {
    if (meId == null) return;
    if (!confirm("Wipe the current run and start again from day 1 today?")) return;
    await api.restart(meId);
    await loadBoard();
    flash("Back to day 1. Go.");
  };

  if (users === null) return <div className="shell muted">loading...</div>;

  if (users.length === 0) {
    return (
      <Onboard
        existing={[]}
        onCreate={async (name, color) => {
          const u = await api.createUser(name, color);
          setMeId(u.id);
          await loadUsers();
          await loadBoard();
        }}
      />
    );
  }

  if (!me || !detail) return <div className="shell muted">loading...</div>;

  const isToday = day === todayISO();

  return (
    <div className="shell" style={{ ["--accent" as string]: me.color }}>
      <header className="topbar">
        <div className="wordmark">
          <b>75</b>
          <span>hard</span>
        </div>
        <div className="who">
          {users.map((u) => (
            <button
              key={u.id}
              className={`pill${u.id === meId ? " on" : ""}`}
              style={{ color: u.id === meId ? u.color : undefined }}
              onClick={() => setMeId(u.id)}
            >
              <i className="dot" style={{ background: u.color }} />
              {u.name}
            </button>
          ))}
          {users.length < 4 && (
            <button
              className="pill"
              onClick={async () => {
                const name = prompt("Friend's name?");
                if (!name?.trim()) return;
                const palette = ["#4a9ee8", "#5cbd7e", "#b76ae8", "#e8c14a"];
                try {
                  await api.createUser(name.trim(), palette[users.length % palette.length]);
                  await loadUsers();
                  await loadBoard();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "could not add");
                }
              }}
            >
              +
            </button>
          )}
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

      <div style={{ marginTop: 22, textAlign: "center" }}>
        <button className="btn ghost" onClick={restart}>
          Reset my run
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
