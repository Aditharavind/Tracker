export type DashRow = { name: string; color: string; coins: number; distance: number };

/**
 * Global Forest Dash standings: the top 3 as a podium bar chart (bar height ∝
 * coins), everyone after that as a compact wrapping row of chips.
 */
export default function DashLeaderboard({
  rows,
  meName,
}: {
  rows: DashRow[];
  meName?: string;
}) {
  if (rows.length === 0) return null;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const max = Math.max(1, ...top.map((r) => r.coins));
  // Render order 2nd · 1st · 3rd so the tallest bar sits in the middle.
  const podium = [1, 0, 2].filter((i) => top[i] !== undefined);

  return (
    <div className="dashlb">
      <div className="dashlb-bars">
        {podium.map((i) => {
          const r = top[i];
          const h = 26 + Math.round((r.coins / max) * 96);
          return (
            <div key={i} className={`dashlb-bar dashlb-rank-${i + 1}${r.name === meName ? " me" : ""}`}>
              <span className="dashlb-score">{r.coins}🪙</span>
              <span className="dashlb-col" style={{ height: `${h}px` }}>
                <span className="dashlb-place">{i + 1}</span>
              </span>
              <span className="dashlb-name" style={{ color: r.color }}>
                {r.name}
              </span>
              <span className="dashlb-dist">{r.distance}m</span>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="dashlb-rest">
          {rest.map((r, k) => (
            <li key={`${r.name}-${k}`} className={r.name === meName ? "me" : undefined}>
              <b>{k + 4}</b>
              <i className="dot" style={{ background: r.color }} />
              <span className="nm">{r.name}</span>
              <span className="sc">{r.coins}🪙</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
