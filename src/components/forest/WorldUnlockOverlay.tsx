import { useEffect, useMemo } from "react";
import CharacterModel from "./CharacterModel";
import { usePrefersReducedMotion } from "./ForestScene";
import type { StageMeta } from "../../game/stageSystem";
import type { CharacterId } from "../../game/characters";

const STAGE_BLURB: Record<number, string> = {
  2: "The moss thickens and the stones grow taller.",
  3: "Blue moonlight, glowing motes, older trees.",
  4: "Giant silhouettes and ancient roots ahead.",
  5: "Golden leaves, warm light, higher platforms.",
  6: "The summit clearing. Almost there.",
};

/**
 * Fires once when the run crosses into a new chapter (skill §STAGE 4) -- i.e.
 * the day number lands on a stage's first day and the streak got there
 * unbroken. Announces the new "world"; it never changes state (the stage is
 * always derived from day number).
 */
export default function WorldUnlockOverlay({
  stage,
  character,
  onClose,
}: {
  stage: StageMeta;
  character: CharacterId;
  onClose: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const motes = useMemo(
    () =>
      reducedMotion
        ? []
        : Array.from({ length: 26 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            top: Math.random() * 100,
            delay: Math.random() * 3,
            dur: 2.4 + Math.random() * 3,
          })),
    [reducedMotion]
  );

  return (
    <div
      className="worldunlock"
      role="dialog"
      aria-modal="true"
      aria-label={`New world unlocked: ${stage.name}`}
    >
      <div className="worldunlock-motes" aria-hidden="true">
        {motes.map((m) => (
          <span
            key={m.id}
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              animationDelay: `${m.delay}s`,
              animationDuration: `${m.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="worldunlock-card">
        <p className="worldunlock-kicker pixel-font">NEW WORLD UNLOCKED</p>
        <p className="worldunlock-count pixel-font">
          WORLD {stage.id} <span>/ 6</span>
        </p>
        <h1 className="worldunlock-name pixel-font">{stage.name.toUpperCase()}</h1>
        <p className="worldunlock-blurb">{STAGE_BLURB[stage.id] ?? "A new stretch of forest opens up."}</p>
        <p className="worldunlock-days pixel-font">
          DAYS {stage.minDay}–{stage.maxDay}
        </p>

        <div className="worldunlock-hero" aria-hidden="true">
          <CharacterModel character={character} anim="Hop" className="worldunlock-model" />
        </div>

        <button type="button" className="worldunlock-enter pixel-font" onClick={onClose} autoFocus>
          ENTER →
        </button>
      </div>
    </div>
  );
}
