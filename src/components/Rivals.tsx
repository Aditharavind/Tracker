import type { Progress } from "../types";

export default function Rivals({ board, meId }: { board: Progress[]; meId: number }) {
  // Ranked primarily by day number -- how far into the 75 each person has
  // climbed -- with streak and xp as tie-breakers.
  const ranked = [...board].sort(
    (a, b) => b.day_number - a.day_number || b.streak - a.streak || b.xp - a.xp
  );
  const leader = ranked[0];

  return (
    <div className="card">
      <div className="card-head">
        <h2>Leaderboard</h2>
        {board.length > 1 && (
          <span className="count">
            {leader.name} leads &middot; day {leader.day_number}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {ranked.map((p, i) => {
          const pct = p.core_today ? (p.completed_today / p.core_today) * 100 : 0;
          return (
            <div className="rival" key={p.user_id} style={{ ["--u" as string]: p.color }}>
              <span className="rank num">#{i + 1}</span>
              <div className="avatar">
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="rival-body">
                <div className="rival-name">
                  {p.name}
                  {p.user_id === meId && <span className="tag">you</span>}
                  <span className={`status ${p.perfect_today ? "win" : "wait"}`}>
                    {p.perfect_today ? "done" : `${p.completed_today}/${p.core_today}`}
                  </span>
                </div>
                <div className="rival-meta">
                  day {p.day_number} &middot; {p.streak}d streak &middot; {p.xp.toLocaleString()} xp
                  {p.resets > 0 && ` · ${p.resets} restart${p.resets > 1 ? "s" : ""}`}
                </div>
                <div className="mini">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
