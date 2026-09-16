import { useEffect, useMemo, useRef } from "react";
import CharacterModel from "./CharacterModel";
import { usePrefersReducedMotion } from "./ForestScene";
import type { StageMeta } from "../../game/stageSystem";
import type { CharacterId } from "../../game/characters";
import { WORLDS } from "../../game/adventure/content";
import { ARC_COUNT } from "../../game/weekSystem";

const STAGE_BLURB: Record<number, string> = {
  2: "Your first 15 days are complete. Crystal caves open beyond the forest.",
  3: "Thirty days of showing up. Find your focus among glowing mushrooms and ancient ruins.",
  4: "Forty-five days complete. Snowy peaks and a new chapter await.",
  5: "Sixty days complete. Follow the golden valley through your final 15 days.",
};

/**
 * Announces a world earned by completing the previous 15 days of required
 * goals. Progress comes from the saved calendar; this dialog opens its story.
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
  const enterButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    enterButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab") { e.preventDefault(); enterButton.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
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
      className="worldunlock world-theme"
      data-world={stage.id - 1}
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
          WORLD {stage.id} <span>/ {ARC_COUNT}</span>
        </p>
        <h1 className="worldunlock-name pixel-font">{stage.name.toUpperCase()}</h1>
        <p className="worldunlock-blurb">{STAGE_BLURB[stage.id] ?? WORLDS[stage.id - 1].motto}</p>
        <p className="worldunlock-days pixel-font">
          DAYS {stage.minDay}–{stage.maxDay}
        </p>

        <div className="worldunlock-hero" aria-hidden="true">
          <CharacterModel character={character} anim="Hop" className="worldunlock-model" />
        </div>

        <button ref={enterButton} type="button" className="worldunlock-enter pixel-font" onClick={onClose} autoFocus>
          READ THE STORY →
        </button>
      </div>
    </div>
  );
}
