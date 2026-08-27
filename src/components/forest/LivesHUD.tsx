import { useEffect, useRef, useState } from "react";

/**
 * Top-HUD hearts. Per the current design these track *today's task
 * completion*: they start empty at the top of the day and one fills (with a
 * pop) for every task ticked -- a glanceable mirror of the progress bar in
 * the Day card. On a run reset they shatter, then refill to the new day's
 * empty state. The source of truth stays the persisted task/`resets` data;
 * nothing is inferred back from the icons.
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
      timer.current = window.setTimeout(() => setBroken(false), 1400);
    }
    prevResets.current = resets;
    return () => window.clearTimeout(timer.current);
  }, [resets]);

  // One slot per task, but keep the HUD compact -- past 8 tasks it would
  // crowd the title, so it caps and the numeric read-out carries the rest.
  const slots = Math.max(1, Math.min(8, total || 3));
  const filled = Math.round((Math.max(0, Math.min(completed, total)) / Math.max(1, total)) * slots);

  return (
    <button
      type="button"
      className="lives-block"
      aria-expanded={!!expanded}
      onClick={onToggle}
      aria-label={`${completed} of ${total} tasks done today. Show what happens if you miss a task.`}
    >
      <div className="lives">
        {Array.from({ length: slots }, (_, i) => {
          const on = !broken && i < filled;
          return (
            <span
              key={`${resets}-${i}-${on ? "on" : "off"}`}
              className={`heart${on ? " full fill" : " empty"}${broken ? " break" : ""}`}
              style={{ ["--i" as string]: i }}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <span className="lives-label">{broken ? "RESET" : `${completed}/${total}`}</span>
    </button>
  );
}
