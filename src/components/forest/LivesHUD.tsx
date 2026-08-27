import { useEffect, useRef, useState } from "react";

// This app's failure rule is an instant reset on any missed core task, not a
// 3-life buffer -- there is no partial-life state to represent. Lives are a
// purely cosmetic readout: full while the current run is alive, and they
// visibly "break" then refill at the moment a reset is detected (derived
// from `resets` going up), so a screen shot of a broken run still explains
// itself. The source of truth stays `resets`/`streak` from the server; nothing
// here is inferred from the heart icons themselves.
export default function LivesHUD({
  resets,
  expanded,
  onToggle,
}: {
  resets: number;
  // The failure note is attached to this control rather than sitting open over
  // the forest, so this has to be a real button: hover alone would leave it
  // unreachable on a phone and invisible to a keyboard.
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const prevResets = useRef(resets);
  const [broken, setBroken] = useState(false);
  // Bumped whenever the hearts should play their staggered fill-in: once on
  // mount, and again each time a run resets and the lives are restored. The
  // key remounts the heart spans so the CSS fill animation actually re-runs
  // instead of being ignored as "already applied".
  const [fillKey, setFillKey] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const healTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (resets > prevResets.current) {
      setBroken(true);
      window.clearTimeout(timer.current);
      window.clearTimeout(healTimer.current);
      // Break first, then heal: the hearts shatter, sit empty a beat, then
      // refill one after another.
      timer.current = window.setTimeout(() => {
        setBroken(false);
        setFillKey((k) => k + 1);
      }, 1400);
    }
    prevResets.current = resets;
    return () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(healTimer.current);
    };
  }, [resets]);

  const full = !broken;

  return (
    <button
      type="button"
      className="lives-block"
      aria-expanded={!!expanded}
      onClick={onToggle}
      aria-label={
        (full ? "3 lives, run alive" : "run reset -- lives restored") +
        ". Show what happens if you miss a task."
      }
    >
      <div className="lives">
        {[0, 1, 2].map((i) => (
          <span
            key={`${fillKey}-${i}`}
            className={`heart${full ? " full" : " empty"}${broken ? " break" : ""}${full ? " fill" : ""}`}
            style={{ ["--i" as string]: i }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="lives-label">LIVES</span>
    </button>
  );
}
