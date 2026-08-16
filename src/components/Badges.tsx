import type { Progress } from "../types";

export default function Badges({ p }: { p: Progress }) {
  const earned = p.badges.filter((b) => b.earned).length;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Trophies</h2>
        <span className="count num">
          {earned}/{p.badges.length}
        </span>
      </div>

      <div className="badges">
        {p.badges.map((b) => (
          <div key={b.day} className={`badge${b.earned ? " earned" : ""}`} title={b.blurb}>
            <div className="d">{b.day}</div>
            <div className="n">{b.name}</div>
          </div>
        ))}
      </div>

      {p.next_badge && (
        <div className="nextup">
          <b>{p.next_badge.day - p.streak}</b> more clean {p.next_badge.day - p.streak === 1 ? "day" : "days"} to
          unlock <b>{p.next_badge.name}</b> &mdash; {p.next_badge.blurb}
        </div>
      )}
    </div>
  );
}
