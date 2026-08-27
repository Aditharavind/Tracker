import { useEffect, useRef, useState } from "react";
import type { DayDetail } from "../../types";
import { generatePlatforms, goalPoint, startPoint, type Point } from "../../game/platformGenerator";
import { getStage } from "../../game/stageSystem";
import { pandaPlatformIndex } from "../../game/progress";
import Panda, { type PandaAnim } from "./Panda";
import Platform from "./Platform";
import Coin from "./Coin";
import GoalFlag from "./GoalFlag";
import StartSign from "./StartSign";
import ZombiePlant from "./ZombiePlant";
import Clouds from "./Clouds";
import Scenery from "./Scenery";
import { DEFAULT_CHARACTER, type CharacterId } from "../../game/characters";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// Game-space (platformGenerator's 0..1) stays resolution/chrome-agnostic --
// tested independently -- so the "leave room for the game shell's left
// rail and edges" concern is handled purely here, at the screen-space
// mapping step, rather than by skewing the deterministic path data.
const X_GUTTER = 8;
const pct = (p: Point) => ({ left: X_GUTTER + p.x * (100 - X_GUTTER * 2), bottom: p.y * 100 });

export default function ForestScene({
  detail,
  dayNumber,
  seed,
  resets,
  character = DEFAULT_CHARACTER,
}: {
  detail: DayDetail;
  dayNumber: number;
  seed: string;
  resets: number;
  character?: CharacterId;
}) {
  const tasks = detail.tasks;
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;

  const reducedMotion = usePrefersReducedMotion();
  const stage = getStage(dayNumber);

  const platforms = generatePlatforms(dayNumber, total, seed);
  const pandaIndex = pandaPlatformIndex(doneCount, total);
  const start = startPoint();
  const goal = goalPoint(total);
  const reachedGoal = total > 0 && doneCount === total;
  const pathPoints = [start, ...platforms, goal];

  const [anim, setAnim] = useState<PandaAnim>("idle");
  // The panda's *visual* position on the staircase -- deliberately decoupled
  // from pandaIndex (the real, state-derived position). pandaIndex can jump
  // by more than one step in a single update (several tasks completed at
  // once, or checked out of order); visualIndex instead catches up to it one
  // platform at a time so the climb always reads as climbing, never
  // teleporting. It is purely cosmetic -- clamped to, and always eventually
  // consistent with, pandaIndex -- so a refresh mid-hop just snaps to the
  // correct real position rather than losing or fabricating progress.
  const [visualIndex, setVisualIndex] = useState(pandaIndex);
  // A new day (different task count) can land between this render and the
  // effect below that reconciles visualIndex to it -- clamp defensively so
  // a leftover index from a longer day never indexes past the new,
  // possibly-shorter platform array.
  const safeVisualIndex = Math.min(visualIndex, platforms.length);
  const pandaPoint = safeVisualIndex === 0 ? start : platforms[safeVisualIndex - 1];

  // Follow-cam (skill §6): slide the whole level sideways so the active
  // character stays in clear space near mid-screen, instead of tucked under
  // the floating Day card at the level's left edge. Purely presentational --
  // it reads off the panda's already-derived visual position and never feeds
  // back into state. Clamped so the goal flag never slams into the right
  // edge; panning the start toward centre is unclamped because the forest
  // photo simply covers whatever it reveals.
  const camX = Math.max(-26, Math.min(40, 50 - pct(pandaPoint).left));

  const prevDone = useRef(doneCount);
  const prevResets = useRef(resets);
  const timers = useRef<number[]>([]);

  const queue = (fn: () => void, delay: number) => {
    timers.current.push(window.setTimeout(fn, delay));
  };
  const clearQueue = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  // Initial run-in: idle -> short run -> idle, per CLAUDE.md section 9.
  //
  // No "already ran" guard here on purpose. React 18 StrictMode
  // (see main.tsx) deliberately mounts every component twice in dev --
  // mount, cleanup, mount again -- to surface exactly this class of bug. A
  // `mounted` ref survives that cleanup (refs aren't reset by it), so a
  // guard reading it sees "already ran" on the second mount, skips
  // re-arming the queued transition to idle, and the cleanup from the
  // *first* mount has already cancelled that timer -- the panda gets stuck
  // playing "running" forever. Letting the effect simply re-run on the
  // second, real mount is what actually leaves it in the correct end state.
  useEffect(() => {
    if (reducedMotion) return;
    setAnim("running");
    queue(() => setAnim("idle"), 700);
    return clearQueue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A completed task advances the panda -- state has already moved (the
  // caller only re-renders after persistence succeeds), this only plays the
  // run/jump/land flourish on top of the already-correct position. When
  // pandaIndex has jumped by more than one platform (several tasks
  // completed together, or completed out of order), visualIndex climbs to
  // it one stair at a time instead of sliding straight there.
  useEffect(() => {
    if (doneCount === prevDone.current) return;
    const increased = doneCount > prevDone.current;
    prevDone.current = doneCount;
    clearQueue();

    if (!increased) {
      // A task got unchecked, a restart, or a fresh day -- the target is
      // already correct and behind (or equal to) where the panda visually
      // is; snap rather than animate a climb-down.
      setVisualIndex(pandaIndex);
      setAnim("idle");
      return;
    }

    if (reducedMotion) {
      setVisualIndex(pandaIndex);
      setAnim("landing");
      queue(() => setAnim(doneCount === total ? "celebrating" : "idle"), 220);
      return;
    }

    const target = pandaIndex;
    const HOP_MS = 680;
    const hop = (from: number) => {
      // Scamper along the platform first (feet on the ground, running in
      // place)...
      setAnim("running");
      // ...then leave it: the position change and the jump arc are kicked off
      // in the same beat, so the character actually travels across the gap
      // while airborne instead of hopping in place and sliding over after.
      queue(() => {
        setAnim("jumping");
        setVisualIndex(from + 1);
      }, HOP_MS * 0.3);
      queue(() => setAnim("landing"), HOP_MS * 0.74);
      queue(() => {
        const arrived = from + 1;
        if (arrived < target) {
          hop(arrived);
        } else {
          setAnim(doneCount === total ? "celebrating" : "idle");
        }
      }, HOP_MS);
    };
    hop(visualIndex);
    return clearQueue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount]);

  // A detected reset (resets went up) -- panda is already back at the start
  // platform by the time this fires; this only layers a fall/recover
  // flourish on top, it never relocates the panda via an arbitrary coordinate.
  useEffect(() => {
    if (resets <= prevResets.current) {
      prevResets.current = resets;
      return;
    }
    prevResets.current = resets;
    clearQueue();
    if (reducedMotion) {
      setAnim("idle");
      return;
    }
    setAnim("falling");
    queue(() => setAnim("landing"), 900);
    queue(() => setAnim("idle"), 1250);
    return clearQueue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resets]);

  useEffect(() => clearQueue, []);

  if (total === 0) return null;

  return (
    <div
      className="forest-scene"
      data-stage={stage.id}
      data-reduced-motion={reducedMotion || undefined}
      // The level's width has to earn room per platform, or extra tasks just
      // pack more platforms into the same horizontal strip until they overlap
      // into one blob -- which reads as "the level didn't grow" even though
      // the count did. The CSS scales the platform art down past the point
      // where full-size platforms would collide.
      style={{
        ["--step-count" as string]: total,
        ["--cam-x" as string]: `${camX}%`,
      }}
    >
      {/* Parallax stack (skill §14): each layer carries a fraction of the
          follow-cam shift so the world reads as depth in motion, not a flat
          backdrop sliding as one piece. Stage 1 swaps the painted sky +
          silhouette layers for the hand-drawn forest-bg-1 art (CSS keys this
          off [data-stage="1"]); the drifting clouds and fireflies stay on
          top. Stages 2-6 keep the CSS parallax, re-tinted per chapter. */}
      <div className="forest-photo" aria-hidden="true" />
      <div className="forest-sky" aria-hidden="true" />
      <div className="forest-mountains" aria-hidden="true" />
      <Clouds seed={seed} />
      <div className="forest-trees-far" aria-hidden="true" />
      <div className="forest-trees-mid" aria-hidden="true" />
      <div className="forest-texture" aria-hidden="true" />
      <div className="forest-fireflies" aria-hidden="true" />

      <div className="forest-path">
        <Scenery seed={seed} taskCount={total} />

        <svg className="forest-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            points={pathPoints.map((p) => `${pct(p).left},${(1 - p.y) * 100}`).join(" ")}
            fill="none"
            className="forest-trail-line"
          />
        </svg>

        <StartSign left={6} bottom={0} />
        <ZombiePlant left={18} bottom={0} />

        {tasks.map((t, i) => {
          const p = platforms[i];
          const { left, bottom } = pct(p);
          return (
            <div key={t.id}>
              <Platform left={left} bottom={bottom} cleared={t.done} title={t.title} />
              <Coin left={left} bottom={bottom + 6} visible={i >= safeVisualIndex} />
            </div>
          );
        })}

        <GoalFlag
          left={pct(goal).left}
          bottom={pct(goal).bottom}
          reached={reachedGoal}
          dayNumber={dayNumber}
        />

        <div
          className="panda-anchor"
          style={{ left: `${pct(pandaPoint).left}%`, bottom: `${pct(pandaPoint).bottom}%` }}
        >
          <Panda anim={anim} character={character} />
        </div>
      </div>

      <div className="forest-fg" aria-hidden="true" />
    </div>
  );
}
