import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterId } from "../../game/characters";
import type { DayCell } from "../../types";
import { WORLDS } from "../../game/adventure/content";
import {
  ARC_COUNT,
  ARC_DAYS,
  arcDayRange,
  journeyProgress,
} from "../../game/weekSystem";
import { usePrefersReducedMotion } from "./ForestScene";
import WorldTransition from "./WorldTransition";
import "../../story.css";
import "../../weekmap.css";

// Fifteen daily goal stones per world. A portal to the next world's story
// appears once all fifteen days of required goals are complete.
type PathNode =
  | { kind: "day"; day: number; arc: number }
  | { kind: "wormhole"; arc: number };

const COLS = 4;

const PATH: PathNode[] = (() => {
  const nodes: PathNode[] = [];
  for (let arc = 1; arc <= ARC_COUNT; arc++) {
    const { start, end } = arcDayRange(arc);
    for (let day = start; day <= end; day++) nodes.push({ kind: "day", day, arc });
    nodes.push({ kind: "wormhole", arc });
  }
  return nodes;
})();
const ROWS = Math.ceil(PATH.length / COLS);
// Portal anchors match five of the large stone platforms painted into
// weekmap-bg.png, progressing from the bottom of the trail to the top.
const PORTAL_POS: Record<number, { x: number; y: number }> = {
  1: { x: 0.288, y: 0.797 },
  2: { x: 0.683, y: 0.589 },
  3: { x: 0.386, y: 0.384 },
  4: { x: 0.671, y: 0.207 },
  5: { x: 0.579, y: 0.093 },
};
const NODE_POS: { x: number; y: number }[] = PATH.map((_, i) => {
  const node = PATH[i];
  if (node.kind === "wormhole" && PORTAL_POS[node.arc]) return PORTAL_POS[node.arc];

  const row = Math.floor(i / COLS);
  const col = i % COLS;
  const leftToRight = row % 2 === 0;
  const colOrder = leftToRight ? col : COLS - 1 - col;
  return {
    x: 0.16 + colOrder * (0.68 / (COLS - 1)),
    // Row 0 (day 1) at the bottom, later rows higher up -- the panda climbs
    // toward the top of the canvas as the trail scrolls, same convention the
    // old week map used.
    y: 0.97 - row * (0.94 / Math.max(1, ROWS - 1)),
  };
});
const CANVAS_HEIGHT = ROWS * 150;
const BACK_CHARACTER: Record<CharacterId, string> = {
  panda: "/assets/story/panda-back.png",
  koala: "/assets/story/koala-back.png",
  redpanda: "/assets/story/redpanda-back.png",
};

function BackCharacter({ character }: { character: CharacterId }) {
  return (
    <div className="weekmap-panda" aria-hidden="true">
      <img className="weekmap-panda-fallback" src={BACK_CHARACTER[character]} alt="" />
    </div>
  );
}

export default function WeekMap({
  character,
  calendar,
  onClose,
  onOpenWorld,
  onOpenGoals,
}: {
  character: CharacterId;
  calendar: DayCell[];
  onClose: () => void;
  onOpenWorld: (worldIndex: number) => void;
  onOpenGoals?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [transitionWorld, setTransitionWorld] = useState<number | null>(null);
  const progress = useMemo(() => journeyProgress(calendar), [calendar]);
  const world = WORLDS[progress.worldIndex];
  const nextWorld = progress.nextWorldIndex === null ? null : WORLDS[progress.nextWorldIndex];
  const currentDay = Math.min(progress.completedDays + 1, 75);
  const pandaIndex = useMemo(() => {
    if (progress.complete) return PATH.length - 1;
    const dayIdx = PATH.findIndex((n) => n.kind === "day" && n.day === currentDay);
    return dayIdx === -1 ? PATH.length - 1 : dayIdx;
  }, [currentDay, progress.complete]);

  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.querySelector<HTMLButtonElement>(".weekmap-close")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const target = NODE_POS[pandaIndex].y * CANVAS_HEIGHT - el.clientHeight / 2;
    el.scrollTo({ top: Math.max(0, Math.min(el.scrollHeight - el.clientHeight, target)), behavior: reducedMotion ? "auto" : "smooth" });
  }, [pandaIndex, reducedMotion]);

  const pandaPos = NODE_POS[pandaIndex];

  return (
    <div ref={rootRef} className="weekmap world-theme" data-world={progress.worldIndex} role="dialog" aria-modal="true" aria-labelledby="weekmap-title" onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <header className="weekmap-header">
        <button type="button" className="weekmap-close" onClick={onClose} aria-label="Return to your world">
          Back
        </button>
        <div className="weekmap-intro">
          <p className="weekmap-eyebrow">STORY JOURNEY · WORLD {progress.worldIndex + 1} OF {ARC_COUNT}</p>
          <h1 id="weekmap-title">{world.name}</h1>
          <p className="weekmap-motto">{world.motto}</p>
          <p className="weekmap-description">{world.intro[0]}</p>
          <div className="weekmap-progress-heading" aria-live="polite">
            <strong>{progress.worldCompletedDays} / {ARC_DAYS} days complete</strong>
            <span>{progress.complete ? "Journey complete" : `Day ${progress.dayInWorld} in this world`}</span>
          </div>
          <progress className="weekmap-progress" value={progress.worldCompletedDays} max={ARC_DAYS} aria-label="Completed daily goals in this world" />
          <div className="weekmap-actions">
            <button type="button" className="weekmap-primary" onClick={() => onOpenWorld(progress.worldIndex)}>Enter story</button>
            {onOpenGoals && !progress.complete && <button type="button" className="weekmap-secondary" onClick={onOpenGoals}>Today's goals</button>}
            {progress.complete && WORLDS[ARC_COUNT] && (
              <button type="button" className="weekmap-secondary" onClick={() => onOpenWorld(ARC_COUNT)}>Bonus story</button>
            )}
          </div>
          <p className="weekmap-instruction">
            {progress.complete
              ? "All 75 days complete. Revisit your worlds or explore the bonus story."
              : nextWorld
                ? `Complete your required daily goals for 15 days to enter ${nextWorld.name}. Every page changes with your world.`
                : "Complete your required daily goals for these final 15 days to finish your journey and unlock the bonus story."}
          </p>
        </div>
      </header>
      <div className="weekmap-path" ref={pathRef}>
        <div className="weekmap-canvas" style={{ height: CANVAS_HEIGHT }}>
          <div className="weekmap-bg" aria-hidden="true" />

          {PATH.map((node, i) => {
            const pos = NODE_POS[i];
            const style = { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` };

            if (node.kind === "day") {
              const locked = node.arc > progress.worldIndex + 1;
              const done = node.day <= progress.completedDays;
              const current = !progress.complete && node.day === currentDay;
              const cellStatus = calendar[node.day - 1]?.status;
              const status = done ? "complete" : locked ? "locked" : cellStatus === "partial" ? "goals incomplete" : cellStatus === "missed" ? "missed goals" : current ? "next daily goals" : "upcoming";
              const label = `Day ${node.day}, world ${node.arc}: ${status}`;
              return (
                <span
                  key={`day-${node.day}`}
                  className={`weekmap-day${locked ? " locked" : ""}${done ? " done" : ""}${current ? " current" : ""}`}
                  style={style}
                  role="img"
                  aria-label={label}
                  aria-current={current ? "step" : undefined}
                  title={label}
                >
                  <span aria-hidden="true">{node.day}</span>
                </span>
              );
            }

            const destination = WORLDS[node.arc];
            if (progress.completedDays < node.arc * ARC_DAYS || !destination) return null;
            return (
              <button
                key={`wormhole-${node.arc}`}
                type="button"
                className="weekmap-wormhole open"
                style={{ ...style, ["--node-color" as string]: destination.color }}
                onClick={() => setTransitionWorld(node.arc)}
                aria-label={`Enter ${destination.name} story`}
              >
                <span className="weekmap-wormhole-ring" aria-hidden="true" />
                <span className="weekmap-wormhole-sign pixel-font">
                  {destination.name.toUpperCase()}
                </span>
              </button>
            );
          })}

          <div className="weekmap-panda-anchor" style={{ left: `${pandaPos.x * 100}%`, top: `${pandaPos.y * 100}%` }} aria-hidden="true">
            <BackCharacter character={character} />
          </div>
        </div>
      </div>
      {transitionWorld !== null && <WorldTransition
        fromWorld={transitionWorld - 1}
        toWorld={transitionWorld}
        character={character}
        reducedMotion={reducedMotion}
        onComplete={() => { setTransitionWorld(null); onOpenWorld(transitionWorld); }}
      />}
    </div>
  );
}
