import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterId } from "../../game/characters";
import type { DayCell } from "../../types";
import { CHAPTER_ENEMIES, WORLDS, type EnemyKind } from "../../game/adventure/content";
import {
  ARC_COUNT,
  ARC_DAYS,
  arcDayRange,
  isArcConsistent,
  STORY_ARC_LIMIT,
  unlockedArcCount,
  unlockedDayCount,
} from "../../game/weekSystem";
import { usePrefersReducedMotion } from "./ForestScene";
import "../../story.css";
import "../../weekmap.css";

// Candy-Crush-style trail: 15 day-stones per arc, then a wormhole -- walking
// through it is what actually opens the next Story world. Built once as a
// flat list (day nodes + one wormhole node per arc, in order) and laid out
// on a snaking COLS-wide grid, alternating direction each row, so the path
// reads as one winding trail rather than the old two-column zigzag (which
// only had to fit 11 week-nodes; 75 day-nodes needs an actual snake).
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
const NODE_POS: { x: number; y: number }[] = PATH.map((_, i) => {
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
const ENEMY_LABEL: Record<EnemyKind, string> = { rootling: "ZOMBIE PLANT", shade: "SHADE", moth: "MOTH", armored: "ARMORED" };
const BACK_CHARACTER: Record<CharacterId, string> = {
  panda: "/assets/story/panda-back.png",
  koala: "/assets/story/koala-back.png",
  redpanda: "/assets/story/redpanda-back.png",
};

function BackCharacter({ character, running }: { character: CharacterId; running: boolean }) {
  return (
    <div className={`weekmap-panda${running ? " running" : ""}`} aria-hidden="true">
      <img className="weekmap-panda-fallback" src={BACK_CHARACTER[character]} alt="" />
    </div>
  );
}

export default function WeekMap({
  character,
  calendar,
  onClose,
  onOpenWorld,
}: {
  character: CharacterId;
  calendar: DayCell[];
  onClose: () => void;
  onOpenWorld: (worldIndex: number) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const unlockedArcs = useMemo(() => unlockedArcCount(calendar), [calendar]);
  const currentDay = useMemo(() => unlockedDayCount(calendar), [calendar]);
  // The panda's own node on PATH: today's day-stone, or -- once every day in
  // the final arc is done -- the wormhole it just walked up to.
  const pandaIndex = useMemo(() => {
    const dayIdx = PATH.findIndex((n) => n.kind === "day" && n.day === currentDay);
    return dayIdx === -1 ? PATH.length - 1 : dayIdx;
  }, [currentDay]);

  const pathRef = useRef<HTMLDivElement>(null);
  const knownUnlockedArcs = useRef<number | null>(null);
  const [visibleUnlockedArcs, setVisibleUnlockedArcs] = useState(unlockedArcs);
  const [displayedIndex, setDisplayedIndex] = useState(pandaIndex);
  const [releasingArc, setReleasingArc] = useState<number | null>(null);

  useEffect(() => {
    const saved = Number(window.sessionStorage.getItem("weekmap:last-unlocked-arc"));
    const known = Number.isFinite(saved) && saved >= 1 ? Math.min(saved, ARC_COUNT) : unlockedArcs;
    knownUnlockedArcs.current = known;
    setVisibleUnlockedArcs(Math.min(unlockedArcs, known));
    setDisplayedIndex(pandaIndex);
  }, []);

  useEffect(() => {
    const known = knownUnlockedArcs.current;
    if (known === null || unlockedArcs <= known) {
      setVisibleUnlockedArcs(unlockedArcs);
      setDisplayedIndex(pandaIndex);
      return;
    }
    knownUnlockedArcs.current = unlockedArcs;
    window.sessionStorage.setItem("weekmap:last-unlocked-arc", String(unlockedArcs));
    if (reducedMotion) {
      setVisibleUnlockedArcs(unlockedArcs);
      setDisplayedIndex(pandaIndex);
      return;
    }
    // A wormhole just opened -- hold the reveal at the previous state for a
    // beat (portal still dormant, panda parked in front of it), then
    // release: the portal animates open and the panda walks through.
    const openedArc = unlockedArcs - 1;
    setVisibleUnlockedArcs(openedArc);
    const wormholeIdx = PATH.findIndex((n) => n.kind === "wormhole" && n.arc === openedArc);
    setDisplayedIndex(wormholeIdx === -1 ? pandaIndex : wormholeIdx);
    setReleasingArc(openedArc);
    const start = window.setTimeout(() => setDisplayedIndex(pandaIndex), 40);
    const reveal = window.setTimeout(() => setVisibleUnlockedArcs(unlockedArcs), 680);
    const finish = window.setTimeout(() => setReleasingArc(null), 1120);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(reveal);
      window.clearTimeout(finish);
    };
  }, [reducedMotion, unlockedArcs, pandaIndex]);

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const target = NODE_POS[displayedIndex].y * CANVAS_HEIGHT - el.clientHeight / 2;
    el.scrollTo({ top: Math.max(0, Math.min(el.scrollHeight - el.clientHeight, target)), behavior: reducedMotion ? "auto" : "smooth" });
  }, [displayedIndex, reducedMotion]);

  const pandaPos = NODE_POS[displayedIndex];

  return (
    <div className="weekmap" role="dialog" aria-modal="true" aria-label="Story trail map">
      <button type="button" className="weekmap-close" onClick={onClose} aria-label="Return to forest">
        Back
      </button>
      <div className="weekmap-path" ref={pathRef}>
        <div className="weekmap-canvas" style={{ height: CANVAS_HEIGHT }}>
          <div className="weekmap-bg" aria-hidden="true" />

          {PATH.map((node, i) => {
            const pos = NODE_POS[i];
            const style = { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` };

            if (node.kind === "day") {
              const locked = node.arc > visibleUnlockedArcs;
              const done = node.day < currentDay;
              const current = node.day === currentDay;
              return (
                <span
                  key={`day-${node.day}`}
                  className={`weekmap-day${locked ? " locked" : ""}${done ? " done" : ""}${current ? " current" : ""}`}
                  style={style}
                  aria-hidden="true"
                />
              );
            }

            const hasWorld = node.arc <= STORY_ARC_LIMIT;
            const world = hasWorld ? WORLDS[node.arc - 1] : null;
            const locked = node.arc > visibleUnlockedArcs;
            const open = hasWorld && !locked && (node.arc === 1 || isArcConsistent(calendar, node.arc));
            const label = locked
              ? `Arc ${node.arc} locked`
              : !hasWorld
                ? `Arc ${node.arc}: more coming`
                : open
                  ? `Wormhole to ${world!.name}`
                  : `Arc ${node.arc}: complete all ${ARC_DAYS} days to open the wormhole`;
            return (
              <button
                key={`wormhole-${node.arc}`}
                type="button"
                className={`weekmap-wormhole${locked ? " locked" : ""}${open ? " open" : ""}${releasingArc === node.arc ? " releasing" : ""}`}
                style={{ ...style, ["--node-color" as string]: world?.color ?? "#f0c04a" }}
                disabled={!open}
                onClick={() => {
                  if (hasWorld && open) onOpenWorld(node.arc - 1);
                }}
                aria-label={label}
              >
                <span className="weekmap-wormhole-stone" aria-hidden="true" />
                <span className="weekmap-wormhole-ring" aria-hidden="true" />
                <span className="weekmap-wormhole-sign pixel-font">
                  {locked || !hasWorld ? (
                    <>
                      ARC {node.arc}
                      <small>{hasWorld ? "LOCKED" : "MORE COMING"}</small>
                    </>
                  ) : open ? (
                    world!.name.toUpperCase()
                  ) : (
                    <>
                      ARC {node.arc}
                      <small>{CHAPTER_ENEMIES[node.arc - 1].map((enemy) => ENEMY_LABEL[enemy]).join(" + ")}</small>
                    </>
                  )}
                </span>
              </button>
            );
          })}

          <div className="weekmap-panda-anchor" style={{ left: `${pandaPos.x * 100}%`, top: `${pandaPos.y * 100}%` }} aria-hidden="true">
            <BackCharacter character={character} running={displayedIndex !== pandaIndex || releasingArc !== null} />
          </div>
        </div>
      </div>
    </div>
  );
}
