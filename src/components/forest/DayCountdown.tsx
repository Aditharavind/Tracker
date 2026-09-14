import { useEffect, useState } from "react";
import { msUntilLocalMidnight } from "../../api";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * "Time left today" badge. Frame art is scripts/pack-clock-frame.py's crop of
 * frontend/assets/clock.png; the countdown counts down to api.ts's
 * msUntilLocalMidnight() -- the device's own local midnight, i.e. whatever
 * timezone the device is actually in, the same boundary todayISO() rolls a
 * day over on. Purely a readout: like the coin count (CLAUDE.md §8/21), it
 * never feeds back into challenge state -- a day fails or completes off the
 * persisted state, never off this clock.
 *
 * `compact` renders the small navbar chip that sits where the
 * "75 DAY HARD CHALLENGE" title used to (App.tsx's .game-topbar) -- same
 * frame art and countdown, just sized and laid out for that 38px-tall row.
 * The full-size version no longer has a mount site of its own but stays
 * available for a future non-navbar placement.
 *
 * `zoomable`, when passed, makes the badge a button that zooms the SAME
 * clock up in a centred overlay instead of opening a separate screen --
 * Pomodoro used to live behind a tap here, but now has its own bottom-nav
 * FOCUS tab, so tapping the clock just shows the clock, bigger. The overlay
 * scales the artwork up a lot; the time/label text deliberately does NOT
 * scale with it (day-clock-zoomed's own fixed, minimal font-size) so it
 * reads as "the same small readout, now easier to see" rather than blown-up
 * pixel-font blocks.
 */
export default function DayCountdown({
  compact,
  zoomable,
}: {
  compact?: boolean;
  zoomable?: boolean;
}) {
  const [remaining, setRemaining] = useState(msUntilLocalMidnight);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(msUntilLocalMidnight()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const frame = (
    <>
      <img className="day-clock-frame" src="/assets/day-clock-frame.webp" alt="" aria-hidden="true" />
      <div className="day-clock-readout" aria-hidden="true">
        <span className="day-clock-time pixel-font">{formatRemaining(remaining)}</span>
        <span className="day-clock-label pixel-font">{compact ? "LEFT TODAY" : "TIME LEFT TODAY"}</span>
      </div>
    </>
  );

  if (zoomable) {
    return (
      <>
        <button
          type="button"
          className={`day-clock day-clock-btn${compact ? " day-clock-compact" : ""}`}
          title="75 Day Hard Challenge -- tap to zoom in on the time left"
          aria-label={`75 Day Hard Challenge. Time left today: ${formatRemaining(remaining)}. Tap to zoom in.`}
          onClick={() => setZoomed(true)}
        >
          {frame}
        </button>
        {zoomed && (
          <div className="day-clock-zoom-backdrop" onClick={() => setZoomed(false)}>
            <div
              className="day-clock day-clock-zoomed"
              role="timer"
              aria-label={`Time left today: ${formatRemaining(remaining)}`}
              onClick={(e) => e.stopPropagation()}
            >
              {frame}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className={`day-clock${compact ? " day-clock-compact" : ""}`}
      role="timer"
      title="75 Day Hard Challenge"
      aria-label={`75 Day Hard Challenge. Time left today: ${formatRemaining(remaining)}`}
    >
      {frame}
    </div>
  );
}
