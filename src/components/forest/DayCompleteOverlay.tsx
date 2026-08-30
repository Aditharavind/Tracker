import { useEffect, useMemo } from "react";
import CharacterModel from "./CharacterModel";
import { usePrefersReducedMotion } from "./ForestScene";
import type { CharacterId } from "../../game/characters";

/**
 * The level-clear screen (skill §13): a classic platformer "stage complete"
 * composition, not a generic success modal. Shown once the day's tasks are all
 * ticked -- the character dances on a podium, the day's score is tallied, and
 * a CONTINUE button dismisses it. It is celebratory only: day advancement is
 * still date-driven by the tracker, nothing here mutates challenge state.
 */
export default function DayCompleteOverlay({
  dayNumber,
  tasksCompleted,
  totalTasks,
  coins,
  streak,
  character,
  onClose,
  onPlayRunner,
}: {
  dayNumber: number;
  tasksCompleted: number;
  totalTasks: number;
  coins: number;
  streak: number;
  character: CharacterId;
  onClose: () => void;
  onPlayRunner?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const confetti = useMemo(
    () =>
      reducedMotion
        ? []
        : Array.from({ length: 40 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 0.9,
            dur: 1.9 + Math.random() * 1.6,
            hue: [42, 140, 0, 200][i % 4],
          })),
    [reducedMotion]
  );

  return (
    <div className="daycomplete" role="dialog" aria-modal="true" aria-label={`Day ${dayNumber} complete`}>
      <div className="daycomplete-confetti" aria-hidden="true">
        {confetti.map((c) => (
          <span
            key={c.id}
            style={{
              left: `${c.left}%`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
              background: `hsl(${c.hue} 80% 60%)`,
            }}
          />
        ))}
      </div>

      <div className="daycomplete-card">
        <p className="daycomplete-kicker pixel-font">STAGE CLEAR</p>
        <h1 className="daycomplete-title pixel-font">DAY {String(dayNumber).padStart(2, "0")} COMPLETE</h1>

        <div className="daycomplete-stage" aria-hidden="true">
          <div className="daycomplete-dancer">
            <CharacterModel character={character} anim="Dance" className="daycomplete-model" />
          </div>
          <div className="daycomplete-podium" />
        </div>

        <dl className="daycomplete-score">
          <div>
            <dt className="pixel-font">TASKS</dt>
            <dd className="pixel-font">
              {tasksCompleted} / {totalTasks}
            </dd>
          </div>
          <div>
            <dt className="pixel-font">COINS</dt>
            <dd className="pixel-font">×{String(coins).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt className="pixel-font">STREAK</dt>
            <dd className="pixel-font">{streak}d</dd>
          </div>
        </dl>

        <div className="daycomplete-actions">
          <button type="button" className="daycomplete-continue pixel-font" onClick={onClose} autoFocus>
            CONTINUE →
          </button>
          {onPlayRunner && (
            <button
              type="button"
              className="daycomplete-play pixel-font"
              onClick={onPlayRunner}
            >
              ▶ FOREST DASH
            </button>
          )}
        </div>
        {onPlayRunner && (
          <p className="daycomplete-play-note">Optional bonus minigame — doesn&apos;t affect your challenge.</p>
        )}
      </div>
    </div>
  );
}
