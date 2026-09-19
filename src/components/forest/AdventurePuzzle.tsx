import { useId, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Check, Puzzle, Sparkles } from "lucide-react";
import { LEVELS_PER_WORLD } from "../../game/adventure/content";
import { getWorldPuzzle } from "../../game/adventure/puzzles";
import type { Save } from "../../game/adventure/save";
import "../../adventure-puzzle.css";

type Props = { save: Save; worldIndex: number; earnedLevelId?: number; onClose: () => void };

// Every edge is symmetric. The adjacent piece traverses it in reverse with
// the opposite tab, so all fifteen silhouettes fit without gaps or overlap.
function edge(x: number, y: number, dx: number, dy: number, tab: number, depth: number) {
  const length = Math.hypot(dx, dy);
  const point = (along: number, out: number) => `${x + dx * along + dy / length * out * depth * tab},${y + dy * along - dx / length * out * depth * tab}`;
  if (!tab) return `L${point(1, 0)}`;
  return `L${point(.38, 0)} C${point(.46, 0)} ${point(.44, .35)} ${point(.42, .45)} C${point(.30, 1.15)} ${point(.70, 1.15)} ${point(.58, .45)} C${point(.56, .35)} ${point(.54, 0)} ${point(.62, 0)} L${point(1, 0)}`;
}

function piecePath(piece: number, width: number, height: number) {
  const col = piece % 3; const row = Math.floor(piece / 3);
  const w = width / 3; const h = height / 5; const x = col * w; const y = row * h;
  const depth = Math.min(w, h) * .21;
  const horizontal = (r: number, c: number) => (r + c) % 2 ? 1 : -1;
  const vertical = (r: number, c: number) => (r + c) % 2 ? -1 : 1;
  return `M${x},${y}`
    + edge(x, y, w, 0, row === 0 ? 0 : -horizontal(row - 1, col), depth)
    + edge(x + w, y, 0, h, col === 2 ? 0 : vertical(row, col), depth)
    + edge(x + w, y + h, -w, 0, row === 4 ? 0 : horizontal(row, col), depth)
    + edge(x, y + h, 0, -h, col === 0 ? 0 : -vertical(row, col - 1), depth) + "Z";
}

export default function AdventurePuzzle({ save, worldIndex, earnedLevelId, onClose }: Props) {
  const instance = useId().replace(/:/g, "");
  const puzzle = getWorldPuzzle(save, worldIndex);
  if (!puzzle) return <section className="adventure-puzzle"><h2>Puzzle unavailable</h2><button className="story-button" data-story-primary onClick={onClose}>Back to map</button></section>;
  const { width, height, pieceIds, complete } = puzzle;
  const earnedPiece = earnedLevelId === undefined ? -1 : earnedLevelId - worldIndex * LEVELS_PER_WORLD;
  const reward = pieceIds.includes(earnedPiece);
  const paths = Array.from({ length: LEVELS_PER_WORLD }, (_, piece) => piecePath(piece, width, height));
  const status = complete ? "World puzzle complete!" : reward ? "A new piece of your journey" : "Your world puzzle";
  const headingId = `${instance}-heading`; const descriptionId = `${instance}-description`;

  return <section className={`adventure-puzzle${complete ? " is-complete" : ""}${reward ? " is-reward" : ""}${save.settings.reducedMotion ? " reduced-motion" : ""}`} aria-labelledby={headingId} style={{ "--puzzle-aspect": width / height } as CSSProperties}>
    <header className="adventure-puzzle-heading">
      <p className="story-eyebrow"><Puzzle size={14} aria-hidden="true" />WORLD {worldIndex + 1} · PUZZLE COLLECTION</p>
      <h1 id={headingId}>{status}</h1>
      <p className="adventure-puzzle-title">{puzzle.title}</p>
    </header>

    <div className="adventure-puzzle-art">
      <div className="adventure-puzzle-frame">
        <i className="adventure-puzzle-rivet rivet-tl" aria-hidden="true" /><i className="adventure-puzzle-rivet rivet-tr" aria-hidden="true" />
        <i className="adventure-puzzle-rivet rivet-bl" aria-hidden="true" /><i className="adventure-puzzle-rivet rivet-br" aria-hidden="true" />
        <svg className="adventure-puzzle-board" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${instance}-title ${instance}-summary`}>
          <title id={`${instance}-title`}>{puzzle.title} jigsaw</title>
          <desc id={`${instance}-summary`}>{pieceIds.length} of 15 pieces collected. {complete ? "The whole picture is joined together." : "Complete each level in this world to reveal its matching piece."}</desc>
          <defs>
            <image id={`${instance}-art`} href={puzzle.src} width={width} height={height} preserveAspectRatio="xMidYMid meet" />
            {paths.map((path, piece) => <clipPath id={`${instance}-piece-${piece}`} key={piece}><path d={path} /></clipPath>)}
          </defs>
          <rect width={width} height={height} className="adventure-puzzle-backing" />
          {paths.map((path, piece) => <g key={piece} className="adventure-puzzle-empty">
            <path d={path} />
            {!pieceIds.includes(piece) && <text x={(piece % 3 + .5) * width / 3} y={(Math.floor(piece / 3) + .5) * height / 5} dominantBaseline="central" textAnchor="middle">{piece + 1}</text>}
          </g>)}
          {pieceIds.filter(piece => piece !== earnedPiece).concat(reward ? [earnedPiece] : []).map(piece => <g key={piece} className={`adventure-puzzle-piece${piece === earnedPiece ? " is-new" : ""}`}>
            <use href={`#${instance}-art`} clipPath={`url(#${instance}-piece-${piece})`} />
            <path d={paths[piece]} className="adventure-puzzle-seam" />
          </g>)}
          {complete && <use href={`#${instance}-art`} className="adventure-puzzle-joined" />}
        </svg>
      </div>
      {complete && <div className="adventure-puzzle-seal"><Check size={15} aria-hidden="true" />ALL 15 PIECES JOINED</div>}
      {complete && reward && <div className="adventure-puzzle-sparkles" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} style={{ "--spark": i } as CSSProperties}>✦</span>)}</div>}
    </div>

    <footer className="adventure-puzzle-footer">
      <div className="adventure-puzzle-progress" role="status" aria-live="polite">
        {complete ? <Sparkles size={18} aria-hidden="true" /> : <Puzzle size={18} aria-hidden="true" />}<strong>{pieceIds.length}<span> / 15</span></strong><span>pieces collected</span>
      </div>
      <progress value={pieceIds.length} max={LEVELS_PER_WORLD} aria-label="World puzzle pieces collected" />
      <p id={descriptionId}>{complete ? "Every step brought this picture to life. This completed puzzle is yours to keep." : reward ? `Level ${earnedPiece + 1} cleared. Your new piece fits right into place!` : "Clear a level, collect a piece. All 15 come together when you finish this world."}</p>
      <button className="story-button" data-story-primary onClick={onClose} aria-describedby={descriptionId}>{earnedLevelId === undefined && <ArrowLeft size={16} aria-hidden="true" />}{earnedLevelId === undefined ? "Back to map" : "Continue"}{earnedLevelId !== undefined && <ArrowRight size={16} aria-hidden="true" />}</button>
    </footer>
  </section>;
}
