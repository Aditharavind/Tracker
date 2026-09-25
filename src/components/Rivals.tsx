import type { Progress } from "../types";
import { ordinal, rankBoard } from "../game/ranking";

/**
 * The main leaderboard. Order, rank numbers and the coin figure all come from
 * game/ranking so this and the stage-clear card can never disagree about who is
 * ahead -- they used to keep separate copies of the same sort.
 */
export default function Rivals({ board, meId }: { board: Progress[]; meId: number }) {
  const ranked = rankBoard(board);
  const mine = ranked.find((e) => e.p.user_id === meId);
  const leader = ranked[0];
  // A shared rank means someone is genuinely level with you, so "3rd of 5"
  // alone would be misleading -- say so rather than implying a clean placing.
  const tiedWithMe = mine ? ranked.filter((e) => e.rank === mine.rank).length - 1 : 0;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Leaderboard</h2>
        {board.length > 1 && leader && (
          <span className="count">
            {leader.p.name} leads &middot; {leader.p.xp.toLocaleString()} xp
          </span>
        )}
      </div>

      {/* The "display the user's rank clearly" readout -- their own standing
          stated in words, above the list, instead of leaving them to find their
          own row. Hidden in a lobby of one, where a rank means nothing. */}
      {mine && board.length > 1 && (
        <p className="rank-readout">
          You&apos;re <strong>{ordinal(mine.rank)}</strong> of {board.length}
          {tiedWithMe > 0 && (
            <span className="rank-readout-tied">
              {" "}
              &middot; tied with {tiedWithMe} other{tiedWithMe > 1 ? "s" : ""}
            </span>
          )}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {ranked.map(({ p, rank, coins }) => {
          const pct = p.core_today ? (p.completed_today / p.core_today) * 100 : 0;
          return (
            <div className="rival" key={p.user_id} style={{ ["--u" as string]: p.color }}>
              <span className="rank num">#{rank}</span>
              <div className="avatar">{p.name.slice(0, 1).toUpperCase()}</div>
              <div className="rival-body">
                <div className="rival-name">
                  {p.name}
                  {p.user_id === meId && <span className="tag">you</span>}
                  <span className={`status ${p.perfect_today ? "win" : "wait"}`}>
                    {p.perfect_today ? "done" : `${p.completed_today}/${p.core_today}`}
                  </span>
                </div>
                <div className="rival-meta">
                  {/* xp first: it is what the order is actually based on, so
                      leading with day number would make the ranking look wrong
                      to anyone reading down the list. */}
                  {p.xp.toLocaleString()} xp &middot; {coins} coins &middot; {p.streak}d streak
                  &middot; day {p.day_number}
                  {p.resets > 0 && ` · ${p.resets} setback${p.resets > 1 ? "s" : ""}`}
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
