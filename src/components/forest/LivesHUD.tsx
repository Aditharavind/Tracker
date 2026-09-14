import { useEffect, useRef, useState } from "react";

/**
 * Top-HUD lives: three heart containers, each either full (a life still in
 * the buffer) or empty (spent on a missed day) -- the real 3-lives system
 * (server/engine.js), not a stand-in for today's own task progress (that
 * has its own bar in the Day card, deliberately separate -- lives are a
 * multi-day failure buffer, not a per-task counter, so they don't fill up
 * as today's checklist does). Losing all 3 costs a week (day_number moves
 * back 7 days), not the whole run -- the hearts shatter for that moment,
 * then refill for the fresh buffer. The persisted `lives`/`resets` data is
 * the source of truth; nothing is read back from the icons.
 *
 * A single ordinary life loss (lives drops by one, short of the full
 * 3-lives reset above) gets its own smaller reaction: `justBrokeIndex`
 * marks exactly the one heart that went from full to empty with a `crack`
 * class (a quick shake/pop, see @keyframes heart-crack) for ~600ms, on top
 * of the water level's own transition -- so losing a single life reads as a
 * distinct, visible moment rather than just the water silently draining.
 */
export default function LivesHUD({
  lives,
  initialLives,
  resets,
  expanded,
  onToggle,
}: {
  lives: number;
  initialLives: number;
  resets: number;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const prevResets = useRef(resets);
  const prevLives = useRef(lives);
  const [broken, setBroken] = useState(false);
  const [justBrokeIndex, setJustBrokeIndex] = useState<number | null>(null);
  const brokenTimer = useRef<number | undefined>(undefined);
  const crackTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (resets > prevResets.current) {
      setBroken(true);
      window.clearTimeout(brokenTimer.current);
      brokenTimer.current = window.setTimeout(() => setBroken(false), 1500);
    } else if (lives < prevLives.current) {
      // Plain single-life loss, not the full 3-lives reset above (that
      // already gets its own, bigger .broken treatment). The heart at
      // index `lives` is the one that just went from full to empty --
      // hearts fill left to right, so this is the first now-empty slot.
      setJustBrokeIndex(lives);
      window.clearTimeout(crackTimer.current);
      crackTimer.current = window.setTimeout(() => setJustBrokeIndex(null), 650);
    }
    prevResets.current = resets;
    prevLives.current = lives;
    return () => {
      window.clearTimeout(brokenTimer.current);
      window.clearTimeout(crackTimer.current);
    };
  }, [resets, lives]);

  const safeInitial = Math.max(1, initialLives);
  const hearts = Array.from({ length: safeInitial }, (_, i) => (broken ? 0 : i < lives ? 1 : 0));

  return (
    <button
      type="button"
      className={`lives-block${broken ? " broken" : ""}`}
      aria-expanded={!!expanded}
      onClick={onToggle}
      aria-label={`Lives: ${broken ? 0 : lives} of ${safeInitial} remaining. Show what happens if you miss a task.`}
    >
      <div className="lives">
        {hearts.map((fill, i) => (
          <span
            key={i}
            className={`heart${broken ? " break" : ""}${justBrokeIndex === i ? " crack" : ""}`}
            style={{ ["--fill" as string]: `${Math.round(fill * 100)}%` }}
            aria-hidden="true"
          >
            <span className="heart-water" />
          </span>
        ))}
      </div>
      <span className="lives-label">{broken ? "-7 DAYS" : "LIVES"}</span>
    </button>
  );
}
