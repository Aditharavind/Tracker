import { useEffect, useState } from "react";
import { CHARACTERS, type CharacterId } from "../game/characters";
import { CharBlink } from "./forest/Panda";
import { usePrefersReducedMotion } from "./forest/ForestScene";

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
  const [picked, setPicked] = useState<CharacterId>(current ?? "panda");
  const [confirming, setConfirming] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (mode !== "switch") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  const confirm = () => {
    if (confirming) return;
    setConfirming(true);
    // A short pixel-art entry beat before handing off, per skill §0 --
    // skipped under reduced motion so confirming never feels like a stall.
    window.setTimeout(() => onSelect(picked), reducedMotion ? 0 : 260);
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
      <div className="character-select-card">
        {mode === "switch" && (
          <button type="button" className="character-select-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}

        <h1 className="pixel-font character-select-title">CHOOSE YOUR CHARACTER</h1>

        <div className="character-select-row" role="listbox" aria-label="Characters">
          {CHARACTERS.map((c) => (
            <button
              type="button"
              key={c.id}
              role="option"
              aria-selected={picked === c.id}
              className={`character-card${picked === c.id ? " on" : ""}`}
              onClick={() => setPicked(c.id)}
            >
              <span className="character-card-art">
                <img src={c.sprite} alt="" aria-hidden="true" className="character-card-sprite" />
                <CharBlink character={c.id} />
              </span>
              <span className="character-card-name pixel-font">{c.name.toUpperCase()}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`character-select-start pixel-font${confirming ? " confirming" : ""}`}
          onClick={confirm}
          disabled={confirming}
        >
          {mode === "gate" ? "SELECT / START" : "CONFIRM"}
        </button>
      </div>
    </div>
  );
}
