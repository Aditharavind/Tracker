import type { Progress } from "../types";

/**
 * Who is ahead of whom, in one place.
 *
 * The board sort used to be copy-pasted into Rivals and DayCompleteOverlay,
 * which is exactly the sort of thing that drifts: two screens showing the same
 * people in a different order is a bug nobody notices until someone screenshots
 * both. Everything that ranks members -- the leaderboard, the stage-clear card,
 * the "you are #N" readouts -- goes through this module.
 *
 * Nothing here is stored. Rank is derived from the same Progress rows the board
 * already returns, so it can never drift out of sync with the checkboxes people
 * actually ticked (same rule as server/engine.js).
 */

/**
 * The coin counter shown in the HUD: one per completed task, plus the "+5"
 * bonus (four extra on top of that day's own per-task coin) for a fully cleared
 * day. Derived from the calendar, never stored -- CLAUDE.md is explicit that
 * the coin count is never a source of truth.
 *
 * Note this is per *run*: the calendar window starts at run_start, so a setback
 * that moves run_start forward drops the days that fall out of the window. That
 * is why coins are a tie-breaker here and not the primary key -- see rankBoard.
 */
export function coinsFor(p: Pick<Progress, "calendar">): number {
  return p.calendar.reduce(
    (sum, c) => sum + c.done + (c.total > 0 && c.done === c.total ? 4 : 0),
    0
  );
}

export type RankedEntry = {
  p: Progress;
  /** 1-based. Ties share a rank, so this is not always the array index + 1. */
  rank: number;
  coins: number;
};

/**
 * Ranked best-first by lifetime XP, then coins, then current streak.
 *
 * XP leads because it only ever goes up: it is computed over the member's whole
 * history (tasks ticked, perfect days, badge thresholds), so a missed day or a
 * setback costs you ground against people still working, never a rank drop out
 * of nowhere. Coins break ties because they are the score people can actually
 * see on their own HUD.
 *
 * Ties share a rank ("competition" ranking: 1, 2, 2, 4) -- two members with
 * identical scores are genuinely level, and showing one of them as #3 would be
 * inventing a difference the numbers do not support. The final comparison falls
 * through to user_id purely so the *order* is stable between renders; members
 * tied on it still print the same rank number.
 */
export function rankBoard(board: Progress[]): RankedEntry[] {
  const scored = board.map((p) => ({ p, coins: coinsFor(p) }));

  scored.sort(
    (a, b) =>
      b.p.xp - a.p.xp ||
      b.coins - a.coins ||
      b.p.streak - a.p.streak ||
      a.p.user_id - b.p.user_id
  );

  const tied = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    a.p.xp === b.p.xp && a.coins === b.coins && a.p.streak === b.p.streak;

  let rank = 0;
  return scored.map((entry, i) => {
    // Only advance the rank when this entry actually scores below the previous
    // one; equal scores keep the rank the leader of that group was given.
    if (i === 0 || !tied(scored[i - 1], entry)) rank = i + 1;
    return { ...entry, rank };
  });
}

/**
 * Where one member sits, and out of how many. Returns null when they are not on
 * the board at all (a share link, a board that has not loaded yet), so callers
 * render nothing rather than a meaningless "#0 of 0".
 */
export function rankOf(
  board: Progress[],
  userId: number
): { rank: number; total: number } | null {
  if (board.length === 0) return null;
  const found = rankBoard(board).find((e) => e.p.user_id === userId);
  return found ? { rank: found.rank, total: board.length } : null;
}

/** "1st", "2nd", "3rd", "4th" -- for the rank readouts. */
export function ordinal(n: number): string {
  // 11/12/13 are the exception: they take "th" despite ending in 1/2/3.
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
