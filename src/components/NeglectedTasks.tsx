import type { NeglectedTask } from "../types";

/**
 * "You've been skipping X" nudge card -- rows are already-computed facts from
 * server/insights.js (a miss-streak or a low completion rate over real
 * ticks). This component only chooses which template sentence to show; it
 * never invents a number that isn't in the row.
 */
export default function NeglectedTasks({ tasks }: { tasks: NeglectedTask[] }) {
  if (tasks.length === 0) return null;

  return (
    <div className="card panel-section neglected-card">
      <div className="card-head">
        <h2>Slipping</h2>
      </div>
      <ul className="neglected-list">
        {tasks.map((t) => (
          <li key={t.taskId}>
            <span className="neglected-title">{t.title}</span>
            <span className="neglected-note">{describe(t)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function describe(t: NeglectedTask): string {
  if (t.missStreak >= 5) {
    const since = t.lastDone ? ` — last done ${t.lastDone}` : " — never done yet";
    return `Missed ${t.missStreak} days in a row${since}`;
  }
  return `Only ${Math.round(t.rate * 100)}% the last two weeks`;
}
