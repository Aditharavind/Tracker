import { useEffect, useMemo, useState } from "react";
import CharacterModel from "./CharacterModel";
import { CoinIcon } from "./Coin";
import DayPuzzlePiece, { MysteryPuzzlePiece } from "./DayPuzzlePiece";
import { usePrefersReducedMotion } from "./ForestScene";
import type { CharacterId } from "../../game/characters";
import type { Progress } from "../../types";
import { ARC_DAYS } from "../../game/weekSystem";

/**
 * The level-clear screen (skill §13): a classic platformer "stage complete"
 * composition, not a generic success modal. Shown once the day's tasks are all
 * ticked. Two steps, not one screen:
 *  1. "puzzle" -- today's score, and (if this world has a fresh piece) a
 *     face-down mystery tile the player taps to reveal, which then snaps
 *     into the puzzle frame.
 *  2. "congrats" -- a congratulations header and the household standings,
 *     with the player's own rank called out.
 * It is celebratory only: day advancement is still date-driven by the
 * tracker, nothing here mutates challenge state.
 */
// The 75-day payoff, shown in place of the usual "stage clear" copy on the
// final day only -- the whole run has been leading here, so it gets its own
// words instead of just being "Day 75 complete" with a bigger number.
const FINALE_LINES = [
  "Seventy-five days ago this felt impossible. Today it's just... done.",
  "Over the last ridge, the family is waiting exactly where they said they'd be.",
  "Not a different panda. The one seventy-five days of showing up was quietly building.",
];

// How long the piece's own "is-new" snap-in animation (adventure-puzzle.css)
// takes to settle -- the puzzle step's Continue button waits this long after
// a reveal so it doesn't appear mid-animation.
const PIECE_SETTLE_MS = 1300;

export default function DayCompleteOverlay({
  dayNumber,
  tasksCompleted,
  totalTasks,
  coins,
  streak,
  character,
  worldIndex,
  worldPieceIds,
  board,
  meId,
  onClose,
  onPlayRunner,
}: {
  dayNumber: number;
  tasksCompleted: number;
  totalTasks: number;
  coins: number;
  streak: number;
  character: CharacterId;
  /** Which of the 6 world puzzles this run's piece belongs to (see
   * game/weekSystem.ts's journeyProgress) -- omit to skip the puzzle reveal. */
  worldIndex?: number;
  /** Every day-slot (0-14) ever completed in this world -- see
   * game/weekSystem.ts's worldPuzzlePieces. Not a consecutive streak, so a
   * missed day elsewhere never hides a piece already earned. */
  worldPieceIds?: number[];
  /** The household's standings, for the congratulations step's rank/list. */
  board: Progress[];
  meId: number;
  onClose: () => void;
  onPlayRunner?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const isFinale = dayNumber >= 75;
  const earnedPiece = worldIndex === undefined ? -1 : dayNumber - 1 - worldIndex * ARC_DAYS;
  const showPuzzle = worldIndex !== undefined && worldPieceIds !== undefined && earnedPiece >= 0 && earnedPiece < ARC_DAYS;

  const [step, setStep] = useState<"puzzle" | "congrats">(showPuzzle ? "puzzle" : "congrats");
  const [pieceRevealed, setPieceRevealed] = useState(false);
  const [pieceSettled, setPieceSettled] = useState(false);

  useEffect(() => {
    if (!pieceRevealed) return;
    if (reducedMotion) {
      setPieceSettled(true);
      return;
    }
    const t = window.setTimeout(() => setPieceSettled(true), PIECE_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [pieceRevealed, reducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter") return;
      if (step === "puzzle") {
        if (!showPuzzle || pieceSettled) setStep("congrats");
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step, showPuzzle, pieceSettled]);

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

  // Same ranking as Rivals (day number first, then streak, then xp) -- kept
  // local rather than importing that component, since Rivals' rows are
  // styled for the neutral dashboard drawers, not this pixel-art card.
  const ranked = useMemo(
    () => [...board].sort((a, b) => b.day_number - a.day_number || b.streak - a.streak || b.xp - a.xp),
    [board]
  );
  const myRank = ranked.findIndex((p) => p.user_id === meId) + 1;

  const canAdvancePastPuzzle = !showPuzzle || pieceSettled;

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

      <div className={`daycomplete-card${isFinale ? " daycomplete-finale" : ""}`}>
        {step === "puzzle" ? (
          <>
            <p className="daycomplete-kicker pixel-font">STAGE CLEAR</p>
            <h1 className="daycomplete-title pixel-font">
              DAY {String(dayNumber).padStart(2, "0")} COMPLETE
            </h1>

            <div className="daycomplete-stage" aria-hidden="true">
              <div className="daycomplete-dancer">
                <CharacterModel character={character} anim="Dance" className="daycomplete-model" />
              </div>
              <div className="daycomplete-podium" />
            </div>

            {streak > 0 && (
              <p className="daycomplete-streak-huge pixel-font">
                🔥 {streak} DAY STREAK
              </p>
            )}

            <dl className="daycomplete-score">
              <div>
                <dt className="pixel-font">TASKS</dt>
                <dd className="pixel-font">
                  {tasksCompleted} / {totalTasks}
                </dd>
              </div>
              <div>
                <dt className="pixel-font">COINS</dt>
                <dd className="pixel-font coin-readout"><CoinIcon size={17} /> ×{String(coins).padStart(2, "0")}</dd>
              </div>
              <div>
                <dt className="pixel-font">STREAK</dt>
                <dd className="pixel-font">{streak}d</dd>
              </div>
            </dl>

            {showPuzzle &&
              (pieceRevealed ? (
                <DayPuzzlePiece
                  worldIndex={worldIndex!}
                  pieceIds={worldPieceIds!}
                  earnedPiece={earnedPiece}
                  reducedMotion={reducedMotion}
                />
              ) : (
                <MysteryPuzzlePiece onReveal={() => setPieceRevealed(true)} />
              ))}

            <div className="daycomplete-actions">
              <button
                type="button"
                className="daycomplete-continue pixel-font"
                onClick={() => setStep("congrats")}
                disabled={!canAdvancePastPuzzle}
                autoFocus
              >
                CONTINUE →
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="daycomplete-kicker pixel-font">{isFinale ? "75 DAYS COMPLETE" : "CONGRATULATIONS"}</p>
            <h1 className="daycomplete-title pixel-font">
              {isFinale ? "WELCOME HOME" : `DAY ${String(dayNumber).padStart(2, "0")} BANKED`}
            </h1>

            {isFinale && (
              <div className="daycomplete-finale-text">
                {FINALE_LINES.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}

            {board.length > 1 && myRank > 0 && (
              <p className="daycomplete-rank pixel-font">
                YOU'RE RANKED #{myRank} OF {board.length}
              </p>
            )}

            <ol className="daycomplete-standings">
              {ranked.map((p, i) => (
                <li key={p.user_id} className={p.user_id === meId ? "is-you" : ""}>
                  <span className="pixel-font">#{i + 1}</span>
                  <span className="daycomplete-standings-name">{p.name}</span>
                  <span className="daycomplete-standings-day pixel-font">DAY {p.day_number}</span>
                </li>
              ))}
            </ol>

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
                  ▶ MINIGAMES
                </button>
              )}
            </div>
            {onPlayRunner && (
              <p className="daycomplete-play-note">Optional bonus minigame — doesn&apos;t affect your challenge.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
