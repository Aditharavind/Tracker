import { useEffect, useRef, useState } from "react";

/**
 * Top-HUD lives: three heart containers that fill like liquid rising through
 * a vessel as today's tasks are completed -- empty at the start of the day,
 * brimming when it's a full clear. Heart 1 fills first, then heart 2, then
 * heart 3. On a run reset they shatter, then drain to the new day's empty.
 * The persisted task / `resets` data is the source of truth; nothing is read
 * back from the icons.
 */
export default function LivesHUD({
  completed,
  total,
  resets,
  expanded,
  onToggle,
}: {
  completed: number;
  total: number;
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

  const frac = broken ? 0 : total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
  // Split the single fill level across three containers.
  const hearts = [0, 1, 2].map((i) => Math.max(0, Math.min(1, frac * 3 - i)));
  const pct = Math.round(frac * 100);

  return (
    <button
      type="button"
      className={`lives-block${broken ? " broken" : ""}`}
      aria-expanded={!!expanded}
      onClick={onToggle}
      aria-label={`Lives ${pct}% full (${completed} of ${total} tasks today). Show what happens if you miss a task.`}
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
      <span className="lives-label">{broken ? "RESET" : "LIVES"}</span>
    </button>
  );
}
