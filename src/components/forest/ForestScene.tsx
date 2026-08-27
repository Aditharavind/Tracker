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

// Slide + scale the generated platforms into [lo, hi] on the x axis, keeping
// their relative spacing and jitter. Used to guarantee a run-up before the
// first platform without touching the (independently tested) generator.
function remapPlatformRun<T extends Point>(platforms: T[], lo: number, hi: number): T[] {
  if (platforms.length === 0) return platforms;
  if (platforms.length === 1) return [{ ...platforms[0], x: lo }];
  const first = platforms[0].x;
  const last = platforms[platforms.length - 1].x;
  const span = last - first || 1;
  return platforms.map((p) => ({ ...p, x: lo + ((p.x - first) / span) * (hi - lo) }));
}

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

  const start = startPoint();
  const pandaIndex = pandaPlatformIndex(doneCount, total);

  // Deterministic layout, then remapped so (a) the first platform sits a fat
  // run-up past the START sign (~300px on desktop) and (b) platforms keep a
  // consistent gap regardless of task count. The level is wider than the
  // viewport -- the follow-cam scrolls it -- so relative spacing + jitter are
  // preserved rather than squashed to fit.
  const rawPlatforms = generatePlatforms(dayNumber, total, seed);
  const LEAD_X = 0.26; // START sign -> first platform (~300px)
  const SPACING_X = 0.12; // platform -> platform
  const runLo = start.x + LEAD_X;
  const runHi = runLo + Math.max(1, total - 1) * SPACING_X;
  const platforms = remapPlatformRun(rawPlatforms, runLo, runHi);
  const goal = { ...goalPoint(total), x: runHi + 0.13 };
  const reachedGoal = total > 0 && doneCount === total;
  const pathPoints = [start, ...platforms, goal];

  const [anim, setAnim] = useState<PandaAnim>("idle");
  // Mount flourish (skill §0 / CLAUDE.md §9): the character is parked AT the
  // START sign, then runs to its ready spot next to the first platform. This
  // is the only scripted travel -- everything after is task-driven hops.
  // "parked" snaps it to the sign; "running" lets the position transition
  // carry it forward while .panda-running plays; null = arrived, idle.
  const [runInPhase, setRunInPhase] = useState<"parked" | "running" | null>("parked");
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

  // Where the character is drawn: normally pandaPoint, but during the "parked"
  // beat of the mount flourish it sits back at the START sign so the run
  // reads as sign -> first platform.
  const SIGN_POINT: Point = { x: -0.06, y: 0 };
  const atStartRest = safeVisualIndex === 0;
  const displayPoint = runInPhase === "parked" && atStartRest ? SIGN_POINT : pandaPoint;

  // Follow-cam (skill §6): slide the whole level sideways so the active
  // character stays in clear space near mid-screen, instead of tucked under
  // the floating Day card at the level's left edge. Purely presentational --
  // it reads off the panda's already-derived visual position and never feeds
  // back into state. Clamped so the goal flag never slams into the right
  // edge; panning the start toward centre is unclamped because the forest
  // photo simply covers whatever it reveals.
  // Lower bound = don't scroll past the goal (keep it around mid-screen);
  // the level is now wider than one viewport, so this has to track the goal
  // rather than being a fixed number.
  const minCam = Math.min(46, 50 - pct(goal).left);
  let camX = Math.max(minCam, Math.min(46, 50 - pct(pandaPoint).left));
  // Early in the level the character sits near the far-left edge, right where
  // the Day card overlays. Push the pan further so the START sign + character
  // always clear the card's right edge (skill §21 "let task cards cover the
  // gameplay path" -> don't).
  if (atStartRest) camX = Math.max(camX, 40);

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
    if (reducedMotion) {
      setRunInPhase(null);
      return;
    }
    setAnim("running");
    // Release the parked offset a frame later so the position transition
    // (see .panda-anchor[data-runin="running"]) carries it sign -> ready.
    queue(() => setRunInPhase("running"), 90);
    queue(() => {
      setRunInPhase(null);
      setAnim("idle");
    }, 1300);
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
    // Completing a task ("checking a checkpoint") sends the character forward:
    // it RUNS along the current platform, then jumps to the next and lands.
    const HOP_MS = 620;
    const hop = (from: number) => {
      setAnim("running");
      queue(() => {
        setAnim("jumping");
        setVisualIndex(from + 1);
      }, HOP_MS * 0.42);
      queue(() => setAnim("landing"), HOP_MS * 0.8);
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

        <div className="start-area" aria-hidden="true">
          <StartSign left={0} bottom={0} />
          <ZombiePlant left={0} bottom={0} />
        </div>

        {tasks.map((t, i) => {
          const p = platforms[i];
          const { left, bottom } = pct(p);
          // A couple of the platforms are stretched into longer ledges so the
          // run reads as varied terrain, not a row of identical blocks.
          const wide = total >= 4 && (i === 1 || i === total - 2);
          // The bonus x5 coin sits on the second-to-last platform.
          const bonus = total >= 3 && i === total - 2;
          return (
            <div key={t.id}>
              <Platform left={left} bottom={bottom} cleared={t.done} title={t.title} wide={wide} />
              <Coin
                left={left}
                bottom={bottom + 6}
                visible={i >= safeVisualIndex}
                multiplier={bonus ? 5 : undefined}
              />
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
          data-runin={runInPhase && atStartRest ? runInPhase : undefined}
          style={{ left: `${pct(displayPoint).left}%`, bottom: `${pct(displayPoint).bottom}%` }}
        >
          <Panda anim={anim} character={character} />
        </div>
      </div>

      <div className="forest-fg" aria-hidden="true" />
    </div>
  );
}
