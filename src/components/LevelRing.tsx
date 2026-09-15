import type { Progress } from "../types";

export default function LevelRing({ p }: { p: Progress }) {
  const span = (p.level_ceiling ?? p.xp) - p.level_floor;
  const pct = p.level_ceiling === null ? 1 : span > 0 ? (p.xp - p.level_floor) / span : 0;
  const r = 44;
  const c = 2 * Math.PI * r;

  return (
    <div className="ring">
      <svg width="108" height="108">
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="6" />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="ring-mid">
        <div className="lv">Lv {p.level}</div>
        <div className="name">{p.level_name}</div>
        <div className="xp">
          {p.level_ceiling === null ? `${p.xp} xp` : `${p.xp}/${p.level_ceiling}`}
        </div>
      </div>
    </div>
  );
}
