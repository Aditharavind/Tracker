import { useEffect, useRef, useState } from "react";
import { api, todayISO } from "../api";
import { askCoach, isWebLLMSupported, type ChatTurn } from "../game/coachChat";
import type { CoachMessage, CoachReport } from "../types";

const DAILY_LIMIT = 10;

/**
 * Ask the Coach things about your own report -- runs entirely on-device via
 * WebLLM (src/game/coachChat.ts), the server only persists the transcript
 * (api.coachMessages/sendCoachMessage). See coachChat.ts's own doc comment
 * for the guardrail design and its honest limits (a 1B local model follows
 * instructions less reliably than a hosted one).
 */
export default function CoachChat({ userId, report }: { userId: number; report: CoachReport | null }) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [modelProgress, setModelProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const supported = isWebLLMSupported();

  useEffect(() => {
    let live = true;
    api
      .coachMessages(userId)
      .then((rows) => live && setMessages(rows))
      .catch(() => {})
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [userId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  const usedToday = messages.filter((m) => m.role === "user" && m.day === todayISO()).length;
  const remaining = Math.max(0, DAILY_LIMIT - usedToday);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || remaining <= 0) return;
    setError(null);
    setDraft("");
    setSending(true);

    try {
      const userRow = await api.sendCoachMessage(userId, "user", text);
      setMessages((prev) => [...prev, userRow]);

      const history: ChatTurn[] = [...messages, userRow].map((m) => ({ role: m.role, text: m.text }));
      const reply = await askCoach(report, history, (r) => setModelProgress(r.text));
      setModelProgress(null);

      const assistantRow = await api.sendCoachMessage(userId, "assistant", reply);
      setMessages((prev) => [...prev, assistantRow]);
    } catch (e) {
      setModelProgress(null);
      setError(e instanceof Error ? e.message : "Something went wrong -- try again.");
    } finally {
      setSending(false);
    }
  };

  if (!supported) {
    return (
      <div className="card panel-section coach-chat">
        <div className="card-head">
          <h2>Ask the coach</h2>
        </div>
        <p className="muted">
          This needs WebGPU, which your browser doesn't support here. Try a recent Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="card panel-section coach-chat">
      <div className="card-head">
        <h2>Ask the coach</h2>
        <span className="coach-chat-remaining muted">{remaining}/{DAILY_LIMIT} left today</span>
      </div>

      <div className="coach-chat-list" ref={listRef} aria-live="polite">
        {!loaded && <p className="muted">Loading your conversation…</p>}
        {loaded && messages.length === 0 && (
          <p className="muted">
            Ask about your report -- what's slipping, why the plan looks like it does, what to try next.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`coach-chat-msg coach-chat-msg-${m.role}`}>
            {m.text}
          </div>
        ))}
        {sending && (
          <div className="coach-chat-msg coach-chat-msg-assistant coach-chat-pending">
            {modelProgress ?? "Thinking…"}
          </div>
        )}
      </div>

      {error && <p className="coach-chat-error">{error}</p>}

      <div className="coach-chat-input-row">
        <input
          className="field"
          value={draft}
          maxLength={500}
          placeholder={remaining > 0 ? "Ask something…" : "Out of messages for today"}
          disabled={sending || remaining <= 0}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn primary" onClick={send} disabled={sending || remaining <= 0 || !draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
