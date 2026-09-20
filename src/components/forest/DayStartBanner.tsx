import { useEffect } from "react";

/**
 * Shown once per trip through WeekMap into the game shell (see App.tsx's
 * dayStartBannerOpen): the moment the player picks their current day off the
 * trail, before they see the forest scene itself. Purely a greeting + a
 * tip -- it never touches challenge state, same spirit as DayCompleteOverlay.
 */
const TIPS = [
  "Small, consistent effort beats occasional bursts. Just show up today.",
  "You don't need motivation to start -- you need the first task done.",
  "Progress compounds. Today's tick is tomorrow's streak.",
  "A missed day costs a life, not the run. Keep climbing.",
  "Do your hardest task first, while your energy is highest.",
  "Consistency is a skill. Every day you practice it, it gets easier.",
  "The panda doesn't need a perfect day -- just today's tasks.",
];

export default function DayStartBanner({
  dayNumber,
  onDismiss,
}: {
  dayNumber: number;
  onDismiss: () => void;
}) {
  const tip = TIPS[Math.max(0, dayNumber - 1) % TIPS.length];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div className="daystart" role="dialog" aria-modal="true" aria-label={`Welcome to day ${dayNumber}`}>
      <div className="daystart-card">
        <p className="daystart-kicker pixel-font">DAY {String(dayNumber).padStart(2, "0")}</p>
        <h1 className="daystart-title pixel-font">
          WELCOME TO DAY {dayNumber}
          <br />
          OF CONSISTENCY
        </h1>
        <p className="daystart-tip">{tip}</p>
        <button type="button" className="daystart-start pixel-font" onClick={onDismiss} autoFocus>
          LET'S GO →
        </button>
      </div>
    </div>
  );
}
