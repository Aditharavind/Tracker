import type { CoachReport } from "../types";

/**
 * The habit coach card in the Habits drawer. Everything shown here is built
 * server-side from the user's real completion history (server/coach.js) -- the
 * "AI" tag only means the model chose the wording; the facts behind it are
 * counted, not guessed.
 */
export default function Coach({
  report,
  onRefresh,
  refreshing = false,
}: {
  report: CoachReport | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  if (!report) return null;

  return (
    <div className="card panel-section coach-card">
      <div className="card-head">
        <h2>Your coach</h2>
        <span className={`coach-src coach-src-${report.source}`}>
          {report.source === "ai" ? "AI" : "auto"}
        </span>
        {onRefresh && (
          <button
            type="button"
            className="coach-refresh"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "…" : "refresh"}
          </button>
        )}
      </div>

      <p className="coach-persona">{report.persona}</p>

      {report.focus.length > 0 && (
        <>
          <h3 className="coach-sub">Where you're slipping</h3>
          <ul className="coach-focus">
            {report.focus.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </>
      )}

      {report.plan.length > 0 && (
        <>
          <h3 className="coach-sub">Your plan</h3>
          <ol className="coach-plan">
            {report.plan.map((p, i) => (
              <li key={i}>
                {p.title && <span className="coach-plan-title">{p.title}</span>}
                {p.detail && <span className="coach-plan-detail">{p.detail}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
