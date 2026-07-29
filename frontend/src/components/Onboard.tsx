import { useState } from "react";
import ThemePicker, { type ThemeId } from "./ThemePicker";

const COLORS = ["#e8734a", "#4a9ee8", "#5cbd7e", "#b76ae8", "#e8c14a"];

export default function Onboard({
  existing,
  onCreate,
  theme,
  onTheme,
}: {
  existing: string[];
  onCreate: (name: string, color: string) => Promise<void>;
  theme: ThemeId;
  onTheme: (t: ThemeId) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[existing.length % COLORS.length]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      await onCreate(name.trim(), color);
      setName("");
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
        <button className="btn primary wide" onClick={submit} disabled={busy}>
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
