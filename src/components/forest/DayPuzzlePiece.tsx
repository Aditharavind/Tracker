import { useId, type CSSProperties } from "react";
import { Puzzle, Sparkles } from "lucide-react";
import { LEVELS_PER_WORLD } from "../../game/adventure/content";
import { getWorldPuzzle, piecePath } from "../../game/adventure/puzzles";
import "../../adventure-puzzle.css";

/**
 * The daily-task counterpart to AdventurePuzzle (the optional Adventure
 * minigame's full jigsaw screen): a compact reveal of the *main* 75-day
 * journey's world puzzle, shown on the stage-clear screen once today's
 * tasks are all done. Each of the 15 days in a world fills one piece --
 * `completedDays` is the journey's running consecutive-done-day count
 * (see game/weekSystem.ts's journeyProgress), which getWorldPuzzle already
 * knows how to turn into "pieces collected" for any world.
 */
export default function DayPuzzlePiece({
  worldIndex,
  completedDays,
  earnedPiece,
  reducedMotion,
}: {
  worldIndex: number;
  completedDays: number;
  /** The 0-indexed slot the day just cleared fills, e.g. day 3 of a world -> 2. */
  earnedPiece: number;
  reducedMotion?: boolean;
}) {
  const instance = useId().replace(/:/g, "");
  const puzzle = getWorldPuzzle({ completed: Array.from({ length: completedDays }, (_, i) => i) }, worldIndex);
  if (!puzzle) return null;

  const { width, height, pieceIds, complete, title } = puzzle;
  const reward = pieceIds.includes(earnedPiece);
  const paths = Array.from({ length: LEVELS_PER_WORLD }, (_, piece) => piecePath(piece, width, height));

  return (
    <section
      className={`daypuzzle${complete ? " is-complete" : ""}${reward ? " is-reward" : ""}${reducedMotion ? " reduced-motion" : ""}`}
      style={{ "--puzzle-aspect": width / height } as CSSProperties}
      aria-label={`World ${worldIndex + 1} puzzle: ${pieceIds.length} of ${LEVELS_PER_WORLD} pieces collected`}
    >
      <p className="daypuzzle-title pixel-font">
        <Puzzle size={12} aria-hidden="true" /> {title.toUpperCase()}
      </p>

      <div className="adventure-puzzle-art daypuzzle-art">
        <div className="adventure-puzzle-frame">
          <i className="adventure-puzzle-rivet rivet-tl" aria-hidden="true" />
          <i className="adventure-puzzle-rivet rivet-tr" aria-hidden="true" />
          <i className="adventure-puzzle-rivet rivet-bl" aria-hidden="true" />
          <i className="adventure-puzzle-rivet rivet-br" aria-hidden="true" />
          <svg className="adventure-puzzle-board" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
            <defs>
              <image id={`${instance}-art`} href={puzzle.src} width={width} height={height} preserveAspectRatio="xMidYMid meet" />
              {paths.map((path, piece) => (
                <clipPath id={`${instance}-piece-${piece}`} key={piece}>
                  <path d={path} />
                </clipPath>
              ))}
            </defs>
            <rect width={width} height={height} className="adventure-puzzle-backing" />
            {paths.map((path, piece) => (
              <g key={piece} className="adventure-puzzle-empty">
                <path d={path} />
              </g>
            ))}
            {pieceIds
              .filter((piece) => piece !== earnedPiece)
              .concat(reward ? [earnedPiece] : [])
              .map((piece) => (
                <g key={piece} className={`adventure-puzzle-piece${piece === earnedPiece ? " is-new" : ""}`}>
                  <use href={`#${instance}-art`} clipPath={`url(#${instance}-piece-${piece})`} />
                  <path d={paths[piece]} className="adventure-puzzle-seam" />
                </g>
              ))}
            {complete && <use href={`#${instance}-art`} className="adventure-puzzle-joined" />}
          </svg>
        </div>
        {complete && reward && (
          <div className="adventure-puzzle-sparkles" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} style={{ "--spark": i } as CSSProperties}>✦</span>
            ))}
          </div>
        )}
      </div>

      <p className="daypuzzle-count pixel-font">
        {complete ? <Sparkles size={12} aria-hidden="true" /> : <Puzzle size={12} aria-hidden="true" />}
        {pieceIds.length} / {LEVELS_PER_WORLD} PIECES
      </p>
    </section>
  );
}
