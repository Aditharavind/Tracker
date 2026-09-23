import { MysteryPuzzlePiece, RevealedPuzzlePiece } from "./DayPuzzlePiece";
import "../../puzzle-reveal.css";

/**
 * The fullscreen "zoom in" moment the floating mystery piece (ForestScene's
 * forest-puzzle-card) hands off to once the panda touches it: the same card,
 * enlarged and centred over a dark backdrop so it's the only thing on
 * screen, now actually clickable (the small in-scene version sits behind a
 * pointer-events:none layer -- this is the real interaction target). A tap
 * flips it, then the standalone earned piece stays on screen. The full puzzle
 * frame lives elsewhere; this reward moment stays focused on the piece the
 * player just picked up during the run.
 */
export default function PuzzleRevealOverlay({
  worldIndex,
  pieceIds,
  earnedPiece,
  revealed,
  flipping,
  placing,
  settled,
  onReveal,
  onContinue,
  reducedMotion,
}: {
  worldIndex: number;
  pieceIds: number[];
  earnedPiece: number;
  revealed: boolean;
  flipping: boolean;
  placing: boolean;
  settled: boolean;
  onReveal: () => void;
  onContinue: () => void;
  reducedMotion?: boolean;
}) {
  return (
    <div className="puzzle-reveal-overlay" role="dialog" aria-modal="true" aria-label="A new puzzle piece">
      <div className="puzzle-reveal-stage">
        {revealed || placing ? (
          <RevealedPuzzlePiece
            worldIndex={worldIndex}
            pieceIds={pieceIds}
            earnedPiece={earnedPiece}
            reducedMotion={reducedMotion}
          />
        ) : (
          <MysteryPuzzlePiece onReveal={onReveal} flipping={flipping} />
        )}
      </div>
      {settled && (
        <button
          type="button"
          className="puzzle-reveal-continue pixel-font"
          onClick={onContinue}
          autoFocus
        >
          CONTINUE →
        </button>
      )}
    </div>
  );
}
