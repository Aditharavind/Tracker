import { useEffect, useState } from "react";
import { CHARACTERS, type CharacterId } from "../game/characters";
import { usePrefersReducedMotion } from "./forest/ForestScene";
import CharacterCarousel from "./CharacterCarousel";

// A single static frame -- no looping GIF/WEBP. The backdrop should read once
// and stay put, not keep animating behind the character carousel.
const SCENE_SRC = "/assets/character_selection/character_selection-wide.jpg";
const MOBILE_SCENE_SRC = "/assets/character_selection/character_selection.jpg";

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
        style={{
          ["--character-select-scene" as string]: `url(${SCENE_SRC})`,
          ["--character-select-scene-mobile" as string]: `url(${MOBILE_SCENE_SRC})`,
        }}
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

      <CharacterCarousel index={index} onStep={step} reducedMotion={reducedMotion} />

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
