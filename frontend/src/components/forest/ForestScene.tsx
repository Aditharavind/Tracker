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

function usePrefersReducedMotion(): boolean {
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
}: {
  detail: DayDetail;
  dayNumber: number;
  seed: string;
  resets: number;
}) {
  const tasks = detail.tasks;
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;

  const reducedMotion = usePrefersReducedMotion();
  const stage = getStage(dayNumber);

  const platforms = generatePlatforms(dayNumber, total, seed);
  const pandaIndex = pandaPlatformIndex(doneCount, total);
  const start = startPoint();
  const pandaPoint = pandaIndex === 0 ? start : platforms[pandaIndex - 1];
  const goal = goalPoint(total);
  const reachedGoal = total > 0 && doneCount === total;
  const pathPoints = [start, ...platforms, goal];
  const stepBlocks = pathPoints.slice(1).flatMap((point, index) => {
    const previous = pathPoints[index];
    return [0.38, 0.62].map((amount, stepIndex) => ({
      id: `${index}-${stepIndex}`,
      x: previous.x + (point.x - previous.x) * amount,
      y: previous.y + (point.y - previous.y) * amount,
      cleared: pandaIndex > index,
    }));
  });

  const [anim, setAnim] = useState<PandaAnim>("idle");
  const prevDone = useRef(doneCount);
  const prevResets = useRef(resets);
  const timers = useRef<number[]>([]);
  const mounted = useRef(false);

  const queue = (fn: () => void, delay: number) => {
    timers.current.push(window.setTimeout(fn, delay));
  };
  const clearQueue = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  // Initial run-in: idle -> short run -> idle, per CLAUDE.md section 9.
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (reducedMotion) return;
    setAnim("running");
    queue(() => setAnim("idle"), 700);
    return clearQueue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A completed task advances the panda -- state has already moved (the
  // caller only re-renders after persistence succeeds), this only plays the
  // run/jump/land flourish on top of the already-correct position.
  useEffect(() => {
    if (doneCount === prevDone.current) return;
    const increased = doneCount > prevDone.current;
    prevDone.current = doneCount;
    clearQueue();
    if (!increased) {
      setAnim("idle");
      return;
    }
    if (reducedMotion) {
      setAnim("landing");
      queue(() => setAnim(doneCount === total ? "celebrating" : "idle"), 220);
      return;
    }
    setAnim("running");
    queue(() => setAnim("jumping"), 480);
    queue(() => setAnim("landing"), 900);
    queue(() => setAnim(doneCount === total ? "celebrating" : "idle"), 1150);
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
    <div className="forest-scene" data-stage={stage.id} data-reduced-motion={reducedMotion || undefined}>
      <div className="forest-bg" aria-hidden="true" />
      <div className="forest-layer-far" aria-hidden="true" />
      <div className="forest-layer-mid" aria-hidden="true" />
      <div className="forest-texture" aria-hidden="true" />
      <div className="forest-fireflies" aria-hidden="true" />

      <div className="forest-path">
        <svg className="forest-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            points={pathPoints.map((p) => `${pct(p).left},${(1 - p.y) * 100}`).join(" ")}
            fill="none"
            className="forest-trail-line"
          />
        </svg>

        <StartSign left={pct(start).left} bottom={pct(start).bottom} />

        {stepBlocks.map((step) => {
          const { left, bottom } = pct(step);
          return (
            <span
              key={step.id}
              className={`forest-step${step.cleared ? " cleared" : ""}`}
              style={{ left: `${left}%`, bottom: `${bottom}%` }}
              aria-hidden="true"
            />
          );
        })}

        {tasks.map((t, i) => {
          const p = platforms[i];
          const { left, bottom } = pct(p);
          return (
            <div key={t.id}>
              <Platform left={left} bottom={bottom} cleared={t.done} title={t.title} />
              <Coin left={left} bottom={bottom + 6} collected={t.done} />
            </div>
          );
        })}

        <GoalFlag left={pct(goal).left} bottom={pct(goal).bottom} reached={reachedGoal} />

        <div
          className="panda-anchor"
          style={{ left: `${pct(pandaPoint).left}%`, bottom: `${pct(pandaPoint).bottom}%` }}
        >
          <Panda anim={anim} />
        </div>
      </div>

      <div className="forest-fg" aria-hidden="true" />
    </div>
  );
}
