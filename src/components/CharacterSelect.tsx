import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CHARACTERS, type CharacterId } from "../game/characters";
import { CharBlink } from "./forest/Panda";
import { usePrefersReducedMotion } from "./forest/ForestScene";

// A single static frame -- no looping GIF/WEBP. The backdrop should read once
// and stay put, not keep animating behind the character carousel.
const SCENE_SRC = "/assets/character_selection/character_selection.jpg";

// A swipe has to travel at least this far (in px) before it counts as a
// deliberate "next/previous character" gesture instead of an accidental
// touch-scroll wobble.
const SWIPE_THRESHOLD = 40;

/**
 * Two entry points, one component (skill §9):
 *  - "gate": the mandatory first-run screen (App.tsx renders this in place
 *    of the whole game shell until a character is persisted for this user).
 *    No dismiss -- the user must press SELECT / START.
 *  - "switch": reopened from the top-HUD character indicator. Cosmetic-only
 *    re-selection; closable via the × button, Escape, or backdrop click.
 *    Never touches challenge/day/lives/coin state -- see App.tsx's
 *    setCharacterFor, which is the only thing either mode calls.
 */
export default function CharacterSelect({
  mode,
  current,
  onSelect,
  onClose,
}: {
  mode: "gate" | "switch";
  current?: CharacterId;
  onSelect: (id: CharacterId) => void;
  onClose?: () => void;
}) {
  const startIndex = Math.max(
    0,
    CHARACTERS.findIndex((c) => c.id === (current ?? "panda"))
  );
  const [index, setIndex] = useState(startIndex);
  const [confirming, setConfirming] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const touchStartX = useRef<number | null>(null);
  const picked = CHARACTERS[index];

  useEffect(() => {
    if (mode !== "switch") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  const step = (delta: 1 | -1) => {
    setIndex((i) => (i + delta + CHARACTERS.length) % CHARACTERS.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta <= -SWIPE_THRESHOLD) step(1);
    else if (delta >= SWIPE_THRESHOLD) step(-1);
  };

  const confirm = () => {
    if (confirming) return;
    setConfirming(true);
    // A short pixel-art entry beat before handing off, per skill §0 --
    // skipped under reduced motion so confirming never feels like a stall.
    window.setTimeout(() => onSelect(picked.id), reducedMotion ? 0 : 260);
  };

  return (
    <div
      className={`character-select${mode === "gate" ? " character-select-gate" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Choose your character"
      onClick={
        mode === "switch"
          ? (e) => {
              if (e.target === e.currentTarget) onClose?.();
            }
          : undefined
      }
    >
      <div
        className="character-select-bg"
        style={{ ["--character-select-scene" as string]: `url(${SCENE_SRC})` }}
        aria-hidden="true"
      />

      {mode === "switch" && (
        <button type="button" className="character-select-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      )}

      <h1 className="pixel-font character-select-title character-select-title-huge">
        CHOOSE YOUR
        <br />
        CHARACTER
      </h1>

      <div className="character-carousel">
        <button
          type="button"
          className="carousel-arrow carousel-arrow-left"
          onClick={() => step(-1)}
          aria-label="Previous character"
          title="Previous character"
        >
          <ChevronLeft size={26} strokeWidth={3} aria-hidden="true" />
        </button>

        <div
          className="carousel-stage"
          role="listbox"
          aria-label="Characters"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="carousel-platform">
            <span className="carousel-sprite-art">
              <img src={picked.sprite} alt="" aria-hidden="true" className="character-card-sprite" />
              <CharBlink character={picked.id} />
            </span>
          </div>
          {!reducedMotion && (
            <div className="carousel-swipe-hint" aria-hidden="true">
              <ChevronLeft size={14} strokeWidth={3} />
              <span className="pixel-font">SWIPE</span>
              <ChevronRight size={14} strokeWidth={3} />
            </div>
          )}
        </div>

        <button
          type="button"
          className="carousel-arrow carousel-arrow-right"
          onClick={() => step(1)}
          aria-label="Next character"
          title="Next character"
        >
          <ChevronRight size={26} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>

      <p className="carousel-name pixel-font" role="option" aria-selected="true">
        {picked.name.toUpperCase()}
      </p>

      <button
        type="button"
        className={`character-select-start pixel-font${confirming ? " confirming" : ""}`}
        onClick={confirm}
        disabled={confirming}
      >
        {mode === "gate" ? "SELECT / START" : "CONFIRM"}
      </button>
    </div>
  );
}
