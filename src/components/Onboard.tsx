import { useEffect, useState } from "react";
import { Sprite, type AvatarId } from "./Runner";
import { CHARACTERS } from "../game/characters";
import { api } from "../api";

const COLORS = ["#e8734a", "#4a9ee8", "#5cbd7e", "#b76ae8", "#e8c14a"];
const AVATARS: AvatarId[] = ["guy", "girl", "panda"];

export default function Onboard({
  existing,
  onCreate,
  onSignIn,
  avatar,
  onAvatar,
  initialMode = "new",
}: {
  existing: string[];
  onCreate: (name: string, color: string, pin: string, wakeTime: string | null, reps: number) => Promise<void>;
  // Without a way back in, the Profile drawer's sign-out is a one-way door:
  // this browser forgets who you are and the same-IP suggestion is suppressed,
  // so "create a new account" would be the only option left.
  onSignIn: (name: string, pin: string) => Promise<void>;
  avatar: AvatarId;
  onAvatar: (a: AvatarId) => void;
  // "new" was always the default regardless of how someone got here -- which
  // meant a browser landing back here right after Sign Out (see signOut in
  // App.tsx) opened on "create a new account" too. A returning user typing
  // their own real name + PIN into that side of the screen without noticing
  // the toggle got "that name is already taken", which read as their own
  // account being broken, not as being on the wrong tab. App.tsx now passes
  // "back" whenever the reason this screen is showing at all is a sign-out.
  initialMode?: "new" | "back";
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[existing.length % COLORS.length]);
  const [pin, setPin] = useState("");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [wakeTime, setWakeTime] = useState("06:00");
  const [reps, setReps] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"new" | "back">(initialMode);

  /**
   * How many people have signed up overall. `existing` only ever holds the
   * caller's own board, which is empty for anyone who has not signed in yet --
   * so the count has to come from the server. Null until it lands, and it stays
   * null if the request fails: a sign-in screen must still work offline, so
   * this is decoration that is simply absent rather than an error.
   */
  const [signups, setSignups] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .stats()
      .then((s) => alive && setSignups(s.users))
      .catch(() => {
        /* offline or the endpoint is down -- just don't show a count */
      });
    return () => {
      alive = false;
    };
  }, []);

  const pinValid = /^\d{4,6}$/.test(pin);

  const submit = async () => {
    if (!name.trim() || !pinValid || busy) return;
    setBusy(true);
    setErr("");
    try {
      if (mode === "back") {
        await onSignIn(name.trim(), pin);
      } else {
        await onCreate(name.trim(), color, pin, wakeEnabled ? wakeTime : null, reps);
      }
      setName("");
      setPin("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "something broke");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboard" style={{ ["--u" as string]: color }}>
      <div className="onboard-backdrop" aria-hidden="true">
        <div className="onboard-firefly" />
        <div className="onboard-cast">
          {CHARACTERS.map((c) => (
            <img key={c.id} src={c.sprite} alt="" className={`onboard-cast-char onboard-cast-${c.id}`} />
          ))}
        </div>
      </div>
      <div className="box2">
        <h1 className="onboard-logo-h1">
          <img src="/assets/logo.webp" alt="OnTrack" className="onboard-logo" />
        </h1>
        <p className="pixel-font onboard-tagline">75 DAY HARD CHALLENGE</p>
        {signups !== null && signups > 0 && (
          <p className="pixel-font onboard-count">
            <span className="onboard-count-n">{signups}</span>
            {signups === 1 ? " CHALLENGER" : " CHALLENGERS"}
          </p>
        )}
        <p>
          {existing.length === 0
            ? "No excuses, no compromises. Who's in?"
            : `${existing.join(" is in. ")} is in. Who else?`}
        </p>
        <input
          className="field"
          placeholder="your name"
          value={name}
          maxLength={40}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <input
          className="field"
          type="password"
          inputMode="numeric"
          placeholder={mode === "back" ? "your PIN" : "pick a 4-6 digit PIN (protects your own progress)"}
          value={pin}
          maxLength={6}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {mode === "new" && (
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={c === color ? "on" : ""}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`pick ${c}`}
            />
          ))}
        </div>
        )}
        {mode === "new" && (
        <div className="avatars" style={{ justifyContent: "center", margin: "0 auto 20px" }}>
          {AVATARS.map((a) => (
            <button
              key={a}
              className={`avatar-btn${a === avatar ? " on" : ""}`}
              onClick={() => onAvatar(a)}
              aria-label={`play as ${a}`}
              aria-pressed={a === avatar}
            >
              <Sprite avatar={a} running={false} />
            </button>
          ))}
        </div>
        )}
        {mode === "new" && (
        <label className="wake-toggle">
          <input type="checkbox" checked={wakeEnabled} onChange={(e) => setWakeEnabled(e.target.checked)} />
          Wake-up alarm (won't stop until you confirm your reps)
        </label>
        )}
        {mode === "new" && wakeEnabled && (
          <div className="wake-fields">
            <input
              className="field"
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
            />
            <input
              className="field"
              type="number"
              min={1}
              max={200}
              value={reps}
              onChange={(e) => setReps(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        )}
        <button className="btn primary wide" onClick={submit} disabled={busy || !pinValid}>
          {busy ? "..." : mode === "back" ? "Sign in" : "Start day 1"}
        </button>
        <button
          className="btn ghost wide"
          style={{ marginTop: 10 }}
          onClick={() => {
            setMode(mode === "new" ? "back" : "new");
            setErr("");
          }}
        >
          {mode === "new" ? "I already have an account" : "Start a new account instead"}
        </button>
        {err && (
          <p className="muted" style={{ marginTop: 12, color: "var(--bad)" }}>
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
