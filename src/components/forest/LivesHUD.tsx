import { useEffect, useRef, useState } from "react";

/**
 * Top-HUD revive meter: three pixel heart vessels start visually empty each
 * day and refill from today's completed task count. The persisted `lives`
 * value still drives missed-day/failure reactions and the explanatory label;
 * the red liquid is a task-progress animation, not a source of truth.
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
  completedToday,
  totalToday,
  expanded,
  onToggle,
}: {
  lives: number;
  initialLives: number;
  resets: number;
  completedToday: number;
  totalToday: number;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const prevResets = useRef(resets);
  const prevLives = useRef(lives);
  const prevCompleted = useRef(completedToday);
  const [broken, setBroken] = useState(false);
  const [justBrokeIndex, setJustBrokeIndex] = useState<number | null>(null);
  const [justFilledIndex, setJustFilledIndex] = useState<number | null>(null);
  const brokenTimer = useRef<number | undefined>(undefined);
  const crackTimer = useRef<number | undefined>(undefined);
  const fillTimer = useRef<number | undefined>(undefined);

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
  const safeTotalToday = Math.max(0, totalToday);
  const safeCompletedToday = Math.max(0, Math.min(completedToday, safeTotalToday || completedToday));
  const fillUnits = safeTotalToday > 0 ? (safeCompletedToday / safeTotalToday) * safeInitial : 0;
  const hearts = Array.from({ length: safeInitial }, (_, i) =>
    broken ? 0 : Math.max(0, Math.min(1, fillUnits - i))
  );

  useEffect(() => {
    if (completedToday > prevCompleted.current && totalToday > 0) {
      const nextFillUnits = (Math.min(completedToday, totalToday) / totalToday) * safeInitial;
      const index = Math.max(0, Math.min(safeInitial - 1, Math.ceil(nextFillUnits) - 1));
      setJustFilledIndex(index);
      window.clearTimeout(fillTimer.current);
      fillTimer.current = window.setTimeout(() => setJustFilledIndex(null), 700);
    }
    prevCompleted.current = completedToday;
    return () => window.clearTimeout(fillTimer.current);
  }, [completedToday, totalToday, safeInitial]);

  const taskFillLabel =
    safeTotalToday > 0
      ? `${safeCompletedToday} of ${safeTotalToday} tasks completed; revive meter ${Math.round((fillUnits / safeInitial) * 100)}% full.`
      : "No tasks available for the revive meter yet.";

  return (
    <button
      type="button"
      className={`lives-block${broken ? " broken" : ""}`}
      aria-expanded={!!expanded}
      onClick={onToggle}
      aria-label={`Lives: ${broken ? 0 : lives} of ${safeInitial} remaining. ${taskFillLabel} Show what happens if you miss a task.`}
    >
      <div className="lives">
        {hearts.map((fill, i) => (
          <span
            key={i}
            className={`heart${broken ? " break" : ""}${justBrokeIndex === i ? " crack" : ""}${justFilledIndex === i ? " refill" : ""}`}
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
