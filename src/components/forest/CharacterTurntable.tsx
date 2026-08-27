import { useEffect, useState } from "react";
import { CHARACTERS, type CharacterId } from "../../game/characters";
import CharacterModel from "./CharacterModel";

/**
 * Profile "your character" display (skill §9 persistent selection): the .glb
 * model turns on a cylindrical podium, ← / → (buttons or arrow keys) browse
 * between the three, and CHOOSE ME commits the one on the stage. Browsing is
 * preview-only -- nothing is persisted until CHOOSE ME -- and committing is
 * cosmetic, it never touches challenge state.
 */
export default function CharacterTurntable({
  current,
  onSelect,
}: {
  current: CharacterId;
  onSelect: (id: CharacterId) => void;
}) {
  const currentIndex = Math.max(
    0,
    CHARACTERS.findIndex((c) => c.id === current)
  );
  const [index, setIndex] = useState(currentIndex);

  // Snap the preview back to the committed pick if it changes elsewhere
  // (e.g. the top-HUD switcher).
  useEffect(() => setIndex(currentIndex), [currentIndex]);

  const go = (delta: number) =>
    setIndex((i) => (i + delta + CHARACTERS.length) % CHARACTERS.length);

  // Arrow keys work whenever the panel is open, without needing to click in
  // first -- but only when the user isn't typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = CHARACTERS[index];
  const isCurrent = active.id === current;

  return (
    <div className="turntable" role="group" aria-label="Choose your character">
      <div className="turntable-row">
        <button type="button" className="turntable-arrow" aria-label="Previous character" onClick={() => go(-1)}>
          ◄
        </button>

        <div className="turntable-stage">
          <CharacterModel character={active.id} anim="Idle" autoRotate className="turntable-model" />
          <div className="turntable-disc" aria-hidden="true">
            <span className="turntable-disc-top" />
            <span className="turntable-disc-side" />
          </div>
          <span className="turntable-name pixel-font">{active.name.toUpperCase()}</span>
        </div>

        <button type="button" className="turntable-arrow" aria-label="Next character" onClick={() => go(1)}>
          ►
        </button>
      </div>

      <button
        type="button"
        className={`turntable-choose pixel-font${isCurrent ? " is-current" : ""}`}
        onClick={() => onSelect(active.id)}
        disabled={isCurrent}
      >
        {isCurrent ? "✓ YOUR CHARACTER" : "CHOOSE ME"}
      </button>
    </div>
  );
}
