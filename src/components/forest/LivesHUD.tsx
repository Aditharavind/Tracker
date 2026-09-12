import { useEffect, useRef, useState } from "react";

/**
 * Top-HUD lives: three heart containers, each either full (a life still in
 * the buffer) or empty (spent on a missed day) -- the real 3-lives system
 * (server/engine.js), not a stand-in for today's own task progress (that
 * has its own bar in the Day card). Losing all 3 costs a week (day_number
 * moves back 7 days), not the whole run -- the hearts shatter for that
 * moment, then refill for the fresh buffer. The persisted `lives`/`resets`
 * data is the source of truth; nothing is read back from the icons.
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
  const [broken, setBroken] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (resets > prevResets.current) {
      setBroken(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setBroken(false), 1500);
    }
    prevResets.current = resets;
    return () => window.clearTimeout(timer.current);
  }, [resets]);

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
            className={`heart${broken ? " break" : ""}`}
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
