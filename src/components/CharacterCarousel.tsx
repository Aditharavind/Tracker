import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { CHARACTERS } from "../game/characters";
import { CharBlink } from "./forest/Panda";

// A swipe has to travel at least this far (in px) before it counts as a
// deliberate "next/previous character" gesture instead of an accidental
// touch-scroll wobble.
const SWIPE_THRESHOLD = 40;

/**
 * The character-on-a-platform swipe/arrow picker -- shared by the mandatory
 * first-run gate and cosmetic re-selection screen (CharacterSelect.tsx) and
 * Profile's "Choose your character" hero (App.tsx), so both read as the same
 * control instead of two similar-but-different pickers. Purely presentational:
 * `index` is who's shown, `onStep` reports the gesture/tap and leaves
 * wraparound and whether to apply immediately up to the caller.
 */
export default function CharacterCarousel({
  index,
  onStep,
  reducedMotion,
}: {
  index: number;
  onStep: (delta: 1 | -1) => void;
  reducedMotion?: boolean;
}) {
  const touchStartX = useRef<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const picked = CHARACTERS[index] ?? CHARACTERS[0];

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta <= -SWIPE_THRESHOLD) onStep(1);
    else if (delta >= SWIPE_THRESHOLD) onStep(-1);
  };

  return (
    <>
      <div className="character-carousel">
        <button
          type="button"
          className="carousel-arrow carousel-arrow-left"
          onClick={() => onStep(-1)}
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
          <button
            type="button"
            className="carousel-info"
            aria-expanded={infoOpen}
            aria-label={`About ${picked.name}`}
            title={`About ${picked.name}`}
            onClick={() => setInfoOpen((open) => !open)}
          >
            <Info size={16} strokeWidth={2.8} aria-hidden="true" />
          </button>
          <div className="carousel-platform">
            <span className="carousel-sprite-art">
              <img src={picked.sprite} alt="" aria-hidden="true" className="character-card-sprite" />
              <CharBlink character={picked.id} />
            </span>
          </div>
          {infoOpen && (
            <div className="carousel-info-card">
              <p className="carousel-info-trait pixel-font">{picked.trait.toUpperCase()}</p>
              <p>{picked.backstory}</p>
            </div>
          )}
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
          onClick={() => onStep(1)}
          aria-label="Next character"
          title="Next character"
        >
          <ChevronRight size={26} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>

      <p className="carousel-name pixel-font" role="option" aria-selected="true">
        {picked.name.toUpperCase()}
      </p>
    </>
  );
}
