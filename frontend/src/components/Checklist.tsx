import { useState } from "react";
import type { DayDetail, TaskItem } from "../types";
import { prettyDate, todayISO } from "../api";
import { getStage } from "../game/stageSystem";
import { dayProgressPercent } from "../game/progress";

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
  dayNumber,
  onShift,
  onToggle,
  onAdd,
  onRemove,
  hideAddRow,
}: {
  detail: DayDetail;
  day: string;
  dayNumber: number;
  onShift: (delta: number) => void;
  onToggle: (t: TaskItem) => void;
  onAdd: (title: string) => void;
  onRemove: (t: TaskItem) => void;
  hideAddRow?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const today = todayISO();
  const core = detail.tasks.filter((t) => t.is_core);
  const doneCore = core.filter((t) => t.done).length;
  const doneAll = detail.tasks.filter((t) => t.done).length;
  const totalAll = detail.tasks.length;
  const stage = getStage(dayNumber);
  const progressPct = dayProgressPercent(doneAll, totalAll);
  const allDone = totalAll > 0 && doneAll === totalAll;

  const add = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  };

  return (
    <div className="card daycard">
      <div className="daycard-head">
        <h2 className="day-heading">
          DAY {String(dayNumber).padStart(2, "0")}
          <svg className="day-leaf" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M2 12c0-6 3.5-9.5 10-10 -0.5 6.5-4 10-10 10Z"
              fill="var(--good)"
              opacity="0.9"
            />
            <path d="M2.5 11.5 10.5 3" stroke="var(--panel)" strokeWidth="0.7" opacity="0.5" />
          </svg>
        </h2>
        <p className="stage-name">{stage.name.toUpperCase()}</p>
        <p className="day-sub muted">
          {allDone ? "All tasks completed! Great work today." : "Complete your tasks to climb higher!"}
        </p>
      </div>

      <div className="progress-block">
        <p className="progress-label-top">YOUR PROGRESS</p>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Today's progress: ${doneAll} of ${totalAll} tasks completed`}
        >
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="progress-count num">
          {doneAll} / {totalAll} TASKS
        </p>
      </div>

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

      <p className="tasks-label">TODAY'S TASKS</p>
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

      {!hideAddRow && (
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
      )}
    </div>
  );
}
