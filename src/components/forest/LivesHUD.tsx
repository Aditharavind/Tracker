import { useEffect, useRef, useState } from "react";

// This app's failure rule is an instant reset on any missed core task, not a
// 3-life buffer -- there is no partial-life state to represent. Lives are a
// purely cosmetic readout: full while the current run is alive, and they
// visibly "break" then refill at the moment a reset is detected (derived
// from `resets` going up), so a screen shot of a broken run still explains
// itself. The source of truth stays `resets`/`streak` from the server; nothing
// here is inferred from the heart icons themselves.
export default function LivesHUD({ resets }: { resets: number }) {
  const prevResets = useRef(resets);
  const [broken, setBroken] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (resets > prevResets.current) {
      setBroken(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setBroken(false), 2200);
    }
    prevResets.current = resets;
    return () => window.clearTimeout(timer.current);
  }, [resets]);

  const full = !broken;

  return (
    <div
      className="lives-block"
      role="group"
      aria-label={full ? "3 lives, run alive" : "run reset -- lives restored"}
    >
      <div className="lives">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`heart${full ? " full" : " empty"}${broken ? " break" : ""}`} aria-hidden="true" />
        ))}
      </div>
      <span className="lives-label">LIVES</span>
    </div>
  );
}
