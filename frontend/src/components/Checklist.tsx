import { useState } from "react";
import type { DayDetail, TaskItem } from "../types";
import { prettyDate, todayISO } from "../api";

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Checklist({
  detail,
  day,
  onShift,
  onToggle,
  onAdd,
  onRemove,
}: {
  detail: DayDetail;
  day: string;
  onShift: (delta: number) => void;
  onToggle: (t: TaskItem) => void;
  onAdd: (title: string) => void;
  onRemove: (t: TaskItem) => void;
}) {
  const [draft, setDraft] = useState("");
  const today = todayISO();
  const core = detail.tasks.filter((t) => t.is_core);
  const doneCore = core.filter((t) => t.done).length;

  const add = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="daynav">
          <button onClick={() => onShift(-1)} aria-label="previous day">
            &lsaquo;
          </button>
          <span className="label">{day === today ? "Today" : prettyDate(day)}</span>
          <button onClick={() => onShift(1)} disabled={day >= today} aria-label="next day">
            &rsaquo;
          </button>
        </div>
        <span className="count num">
          {doneCore}/{core.length}
        </span>
      </div>

      <div className="tasks">
        {detail.tasks.map((t) => (
          <div key={t.id} className={`task${t.done ? " done" : ""}`}>
            <button
              className="box"
              onClick={() => onToggle(t)}
              aria-label={t.done ? `uncheck ${t.title}` : `check ${t.title}`}
              aria-pressed={t.done}
            >
              <Check />
            </button>
            <span className="emoji">{t.emoji}</span>
            <button className="title" onClick={() => onToggle(t)}>
              {t.title}
            </button>
            {!t.is_core && <span className="tag">bonus</span>}
            {t.locked && <span className="tag locked">locked</span>}
            {!t.locked && (
              <button className="kill" onClick={() => onRemove(t)} aria-label={`delete ${t.title}`}>
                &times;
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="addrow">
        <input
          placeholder="add a bonus habit..."
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}
