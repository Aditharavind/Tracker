import { useEffect, useState } from "react";
import { api } from "../api";
import { LAST_USER_KEY } from "../constants";
import type { InvitePreview } from "../types";

const COLORS = ["#e8734a", "#4a9ee8", "#5cbd7e", "#b76ae8", "#e8c14a"];

// Landed on via a shared invite link (?join=<token>) -- unlike the read-only
// share link, joining creates a real, editable member of the lobby.
export default function JoinLobby({ token }: { token: string }) {
  const [preview, setPreview] = useState<InvitePreview | "error" | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.inviteInfo(token).then(setPreview).catch(() => setPreview("error"));
  }, [token]);

  const pinValid = /^\d{4,6}$/.test(pin);

  const submit = async () => {
    if (!name.trim() || !pinValid || busy) return;
    setBusy(true);
    setErr("");
    try {
      const user = await api.joinInvite(token, name.trim(), color, pin);
      localStorage.setItem(LAST_USER_KEY, String(user.id));
      // Drop the ?join= param and boot the normal app as this new member.
      location.replace(location.pathname);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not join");
      setBusy(false);
    }
  };

  if (preview === null) return <div className="shell muted">loading...</div>;
  if (preview === "error") {
    return <div className="shell muted">This invite link is invalid or has expired.</div>;
  }

  return (
    <div className="onboard" style={{ ["--u" as string]: color }}>
      <div className="box2">
        <h1>JOIN THE LOBBY</h1>
        <p>
          {preview.members.length === 0
            ? "Be the first one in."
            : `${preview.members.map((m) => m.name).join(", ")} ${
                preview.members.length === 1 ? "is" : "are"
              } already in. Join the run?`}
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
        <button className="btn primary wide" onClick={submit} disabled={busy || !name.trim() || !pinValid}>
          {busy ? "..." : "Join and start day 1"}
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
