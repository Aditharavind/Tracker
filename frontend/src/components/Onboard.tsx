import { useState } from "react";
import ThemePicker, { type ThemeId } from "./ThemePicker";
import { Sprite, type AvatarId } from "./Runner";

const COLORS = ["#e8734a", "#4a9ee8", "#5cbd7e", "#b76ae8", "#e8c14a"];
const AVATARS: AvatarId[] = ["guy", "girl"];

export default function Onboard({
  existing,
  onCreate,
  theme,
  onTheme,
  avatar,
  onAvatar,
}: {
  existing: string[];
  onCreate: (name: string, color: string, pin: string, wakeTime: string | null, reps: number) => Promise<void>;
  theme: ThemeId;
  onTheme: (t: ThemeId) => void;
  avatar: AvatarId;
  onAvatar: (a: AvatarId) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[existing.length % COLORS.length]);
  const [pin, setPin] = useState("");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [wakeTime, setWakeTime] = useState("06:00");
  const [reps, setReps] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pinValid = /^\d{4,6}$/.test(pin);

  const submit = async () => {
    if (!name.trim() || !pinValid || busy) return;
    setBusy(true);
    setErr("");
    try {
      await onCreate(name.trim(), color, pin, wakeEnabled ? wakeTime : null, reps);
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
      <div className="box2">
        <h1>75 HARD</h1>
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
          placeholder="pick a 4-6 digit PIN (protects your own progress)"
          value={pin}
          maxLength={6}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
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
        <label className="wake-toggle">
          <input type="checkbox" checked={wakeEnabled} onChange={(e) => setWakeEnabled(e.target.checked)} />
          Wake-up alarm (won't stop until you confirm your reps)
        </label>
        {wakeEnabled && (
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
          {busy ? "..." : "Start day 1"}
        </button>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
          <ThemePicker theme={theme} onPick={onTheme} />
        </div>
        {err && (
          <p className="muted" style={{ marginTop: 12, color: "var(--bad)" }}>
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
