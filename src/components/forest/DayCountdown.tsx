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
 * `onOpenPomodoro`, when passed, makes the badge a button that opens the
 * Pomodoro focus-timer panel (App.tsx's PomodoroPanel) -- same clock-frame
 * art, a separate 25/5min timer that never reads or writes this countdown
 * or any challenge state.
 */
export default function DayCountdown({
  compact,
  onOpenPomodoro,
}: {
  compact?: boolean;
  onOpenPomodoro?: () => void;
}) {
  const [remaining, setRemaining] = useState(msUntilLocalMidnight);

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(msUntilLocalMidnight()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const frame = (
    <>
      <img className="day-clock-frame" src="/assets/day-clock-frame.webp" alt="" aria-hidden="true" />
      <div className="day-clock-readout" aria-hidden="true">
        {!compact && <span className="day-clock-label pixel-font">TIME LEFT TODAY</span>}
        <span className="day-clock-time pixel-font">{formatRemaining(remaining)}</span>
      </div>
    </>
  );

  if (onOpenPomodoro) {
    return (
      <button
        type="button"
        className={`day-clock day-clock-btn${compact ? " day-clock-compact" : ""}`}
        title="75 Day Hard Challenge -- tap for the Pomodoro focus timer"
        aria-label={`75 Day Hard Challenge. Time left today: ${formatRemaining(remaining)}. Open the Pomodoro focus timer.`}
        onClick={onOpenPomodoro}
      >
        {frame}
      </button>
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
