import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DayDetail } from "../../types";
import { generatePlatforms, goalPoint, startPoint, type Point } from "../../game/platformGenerator";
import { getStage, type StageMeta } from "../../game/stageSystem";
import { pandaPlatformIndex } from "../../game/progress";
import { ARC_DAYS } from "../../game/weekSystem";
import Panda, { type PandaAnim } from "./Panda";
import Platform from "./Platform";
import Coin from "./Coin";
import GoalFlag from "./GoalFlag";
import { MysteryPuzzlePiece, RevealedPuzzlePiece } from "./DayPuzzlePiece";
import PuzzleRevealOverlay from "./PuzzleRevealOverlay";
import StartSign from "./StartSign";
import VictorySign from "./VictorySign";
import ZombiePlant from "./ZombiePlant";
import GuardianCreature from "./GuardianCreature";
import Clouds from "./Clouds";
import Scenery from "./Scenery";
import { worldScenery } from "../../game/worldScenery";
import { DEFAULT_CHARACTER, type CharacterId } from "../../game/characters";
import { playCompanionGiggle, playJump } from "../../sound";

const COMPANION_IDLE_MS = 45_000;

// The floating world-puzzle piece waiting on the victory lane (see
// showPuzzleCard below). The panda "touches" it automatically partway
// through the victory dash -- no tap needed to trigger that -- which zooms
// it fullscreen (PuzzleRevealOverlay); tapping THAT enlarged card is what
// actually flips it, then the revealed single piece is shown briefly before
// DayPuzzlePiece's frame-pop + delayed snap-into-place take it from there.
const PUZZLE_TOUCH_DELAY_MS = 500;
const PUZZLE_FLIP_MS = 420;
const PUZZLE_REVEALED_DISPLAY_MS = 1300;
// Time from starting board placement to the frame's pop-in and the piece's
// delayed snap-into-place (adventure-puzzle.css) fully settling.
const PUZZLE_PLACEMENT_SETTLE_MS = 1600;

/**
 * Width of the forest viewport, in px. Platform spacing is defined as a
 * fraction of a fixed REFERENCE width, then divided by however wide the
 * scene actually is -- so the gap between two platforms stays the SAME
 * number of pixels on a phone as on a desktop (the follow-cam just scrolls
 * more of the level into view). Without this the spacing is a % of the
 * container and the stairs bunch together on narrow screens.
 */
function useSceneWidth(ref: RefObject<HTMLElement>): number {
  const [w, setW] = useState(1040);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 1040);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

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
  stage: activeStage,
  seed,
  resets,
  character = DEFAULT_CHARACTER,
  onDayCleared,
  returnToStart,
  puzzleWorldIndex,
  puzzlePieceIds,
}: {
  detail: DayDetail;
  dayNumber: number;
  stage?: StageMeta;
  seed: string;
  resets: number;
  character?: CharacterId;
  /**
   * Called once the panda finishes the end-of-day run -- final hop, drop into
   * the victory lane, dash to the exit. App uses it to open the "stage clear"
   * board only after the run is actually over, not the instant the last box
   * is ticked.
   */
  onDayCleared?: () => void;
  /** Which of the 6 world puzzles today's piece belongs to (see
   * game/weekSystem.ts's journeyProgress) -- omit to skip the floating
   * puzzle piece on the victory lane entirely. */
  puzzleWorldIndex?: number;
  /** Every day-slot (0-14) ever completed in this world -- see
   * game/weekSystem.ts's worldPuzzlePieces. */
  puzzlePieceIds?: number[];
  /**
   * True once today's tasks are all done AND every overlay/panel App renders
   * on top of the scene (victory board, leaderboard, habits, coach, story
   * map, character picker, minigame, reset-confirm...) is closed again. The
   * end-of-day run parks the follow-cam on the exit bush at the level's far
   * right (see frozenCamX below) so the run-off reads clearly -- left there,
   * anyone coming back to look at the scene after clearing out those windows
   * would just see empty forest and an idle bush, not the game's own start
   * point. This pans the camera back to the START sign / guardian plant, the
   * same resting frame as a fresh day, without touching pandaIndex or any
   * other real progress state -- purely a camera position, per CLAUDE.md
   * §22 (never use animation/visual state as application state).
   */
  returnToStart?: boolean;
}) {
  const tasks = detail.tasks;
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;

  const reducedMotion = usePrefersReducedMotion();
  const stage = activeStage ?? getStage(dayNumber);
  // Some worlds have their own villain standing in for the zombie plant at
  // the START sign (see the start-area render below).
  const guardian = worldScenery(stage.id - 1).guardian;

  const sceneRef = useRef<HTMLDivElement>(null);
  // Spacing is authored against a 1040px-wide reference viewport. Dividing by
  // the real width turns those game-space fractions into a FIXED pixel gap on
  // any screen -- on a phone the level just runs off the sides and the
  // follow-cam scrolls it, instead of the stairs squashing together.
  const sceneW = useSceneWidth(sceneRef);
  const spread = 1040 / Math.max(320, sceneW);

  const start = startPoint();
  const pandaIndex = pandaPlatformIndex(doneCount, total);

  // Deterministic layout, then remapped so (a) the first platform sits a fat
  // run-up past the START sign (~300px, any screen) and (b) platforms keep a
  // consistent px gap regardless of task count or viewport. The level is wider
  // than the viewport -- the follow-cam scrolls it -- so relative spacing +
  // jitter are preserved rather than squashed to fit.
  const rawPlatforms = generatePlatforms(dayNumber, total, seed);
  const LEAD_X = 0.34 * spread; // START sign -> first platform
  // Centre-to-centre gap between platforms. ~230px at any viewport (spread
  // keeps it a fixed pixel distance) -- so even after a WIDE ledge and the
  // layout jitter there is always at least half a large platform of clear
  // air between two stairs, never a squashed cluster.
  const SPACING_X = 0.26 * spread;
  const runLo = start.x + LEAD_X;
  const runHi = runLo + Math.max(1, total - 1) * SPACING_X;
  const platforms = remapPlatformRun(rawPlatforms, runLo, runHi);
  // Shifted further right than the goal's default offset (was 0.16) so the
  // floating mystery piece has real room to sit between the last platform
  // and the flag instead of crowding it.
  const goal = { ...goalPoint(total), x: runHi + 0.3 * spread };
  const reachedGoal = total > 0 && doneCount === total;
  // Ground-level "victory lane": from under the last platform out to an exit
  // past the goal board. The panda drops here after the final hop and runs it.
  const lastPlatform = platforms[platforms.length - 1] ?? start;
  // The ground's two cliff edges are cut against these (see .forest-fg).
  // Neither the first nor the last platform is ever a WIDE ledge -- `wide` is
  // only index 1 and index total-2 -- so half of one --ledge-w is the right
  // overhang for both.
  const firstPlatform = platforms[0];
  // The bush sits well past the goal flag -- a clear stretch of open ground
  // between the last platform and it. After the last task the panda drops off
  // the final platform and runs that ground to the bush at the right edge of
  // the screen; then the stage-clear popup appears.
  const exitPoint: Point = { x: goal.x + 0.34 * spread, y: 0 };
  const pathPoints = [start, ...platforms, goal];

  // The floating mystery puzzle piece, sitting on the ground between the
  // last stair and the goal flag -- the panda "touches" it partway through
  // the victory dash (see startVictory below), automatically, no tap.
  const puzzleEarnedPiece = puzzleWorldIndex === undefined ? -1 : dayNumber - 1 - puzzleWorldIndex * ARC_DAYS;
  const showPuzzleCard =
    puzzleWorldIndex !== undefined &&
    puzzlePieceIds !== undefined &&
    puzzleEarnedPiece >= 0 &&
    puzzleEarnedPiece < ARC_DAYS;
  // Above the last platform rather than down on the ground -- floating at
  // roughly the same height the panda's already climbed to, midway to the
  // flag, so it reads as a reward waiting up there rather than litter on
  // the lane.
  const puzzleCardPoint: Point = { x: (lastPlatform.x + goal.x) / 2, y: lastPlatform.y + 0.05 };

  const [anim, setAnim] = useState<PandaAnim>("idle");
  const [companionSleeping, setCompanionSleeping] = useState(false);
  const [companionDelighted, setCompanionDelighted] = useState(false);
  const companionSleepTimer = useRef<number | undefined>(undefined);
  const companionDelightTimer = useRef<number | undefined>(undefined);
  // Mount flourish (skill §0 / CLAUDE.md §9): the character is parked AT the
  // START sign, then runs to its ready spot next to the first platform. This
  // is the only scripted travel -- everything after is task-driven hops.
  // "parked" snaps it to the sign; "running" lets the position transition
  // carry it forward while .panda-running plays; null = arrived, idle.
  const [runInPhase, setRunInPhase] = useState<"parked" | "running" | null>("parked");
  // End-of-day run: "none" (still climbing) -> "drop" (fell off the last
  // platform onto the lane) -> "run" (dashing to the exit) -> "done" (arrived,
  // celebrating). Cosmetic only; the day is already complete in state before
  // any of this plays.
  const [victoryPhase, setVictoryPhase] = useState<"none" | "drop" | "run" | "puzzle" | "done">(
    reachedGoal ? "done" : "none"
  );
  const clearedFired = useRef(false);
  // Puzzle-piece reveal state -- mirrors victoryPhase's own initial-state
  // pattern: a page load landing on an already-finished day shows the piece
  // already placed, no zoom/flip to replay.
  const [puzzleZoomed, setPuzzleZoomed] = useState(false);
  const [puzzleRevealed, setPuzzleRevealed] = useState(reachedGoal);
  const [puzzlePlacing, setPuzzlePlacing] = useState(reachedGoal);
  const [puzzleFlipping, setPuzzleFlipping] = useState(false);
  const [puzzleSettled, setPuzzleSettled] = useState(reachedGoal);
  const puzzleTouchFired = useRef(reachedGoal);
  // The panda's *visual* position on the staircase -- deliberately decoupled
  // from pandaIndex (the real, state-derived position). pandaIndex can jump
  // by more than one step in a single update (several tasks completed at
  // once, or checked out of order); visualIndex instead catches up to it one
  // platform at a time so the climb always reads as climbing, never
  // teleporting. It is purely cosmetic -- clamped to, and always eventually
  // consistent with, pandaIndex -- so a refresh mid-hop just snaps to the
  // correct real position rather than losing or fabricating progress.
  const [visualIndex, setVisualIndex] = useState(pandaIndex);
  const [dragCamOffset, setDragCamOffset] = useState(0);
  const [draggingScene, setDraggingScene] = useState(false);
  const dragCamera = useRef<{ id: number; startX: number; startOffset: number; base: number; min: number; max: number } | null>(null);
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
  let displayPoint = runInPhase === "parked" && atStartRest ? SIGN_POINT : pandaPoint;
  if (victoryPhase === "drop") displayPoint = { x: lastPlatform.x, y: 0 };
  else if (victoryPhase === "puzzle") displayPoint = { x: puzzleCardPoint.x, y: 0 };
  else if (victoryPhase === "run" || victoryPhase === "done") displayPoint = exitPoint;

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
  // The follow-cam holds the panda near mid-screen while it climbs. Once the
  // day is cleared and the victory run begins the camera FREEZES -- so the
  // character visibly runs across the screen to the bush at the far right edge
  // and vanishes into it, rather than the world sliding to keep it centred.
  const minCam = Math.min(46, 50 - pct(goal).left);
  const maxCam = 46;
  let autoCamX = Math.max(minCam, Math.min(maxCam, 50 - pct(pandaPoint).left));
  const frozenCamX = useRef<number | null>(null);
  if (victoryPhase === "none") {
    frozenCamX.current = null;
  } else {
    if (frozenCamX.current == null) {
      // Park the camera so the bush hugs the right edge of the viewport (~89%)
      // and holds there while the panda runs the last stretch into it.
      frozenCamX.current = Math.min(44, 89 - pct(exitPoint).left);
    }
    autoCamX = frozenCamX.current;
  }
  // Early in the level the character sits near the far-left edge, right where
  // the Day card overlays. Push the pan further so the START sign + character
  // always clear the card's right edge (skill §21 "let task cards cover the
  // gameplay path" -> don't).
  if (atStartRest) autoCamX = Math.max(autoCamX, 40);
  // Overrides the victory freeze above only after the clear callback has
  // fired. App's `returnToStart` prop is already true during the last dash
  // because every task is done and no overlay is open yet; applying it then
  // yanks the camera back to the main/start frame while the character is
  // supposed to be running into the exit bush.
  if (returnToStart && victoryPhase === "done" && clearedFired.current) autoCamX = 40;
  const clampedDragCamOffset = Math.max(minCam - autoCamX, Math.min(maxCam - autoCamX, dragCamOffset));
  const camX = autoCamX + clampedDragCamOffset;

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

  useEffect(() => {
    setDragCamOffset(0);
    setDraggingScene(false);
    dragCamera.current = null;
  }, [dayNumber, doneCount, total]);

  // The character's rest state listens to genuine user activity rather than
  // task state: reading, checking a box, or tapping the companion all count
  // as company. A quiet scene for a while lets them doze off.
  useEffect(() => {
    const keepAwake = () => {
      setCompanionSleeping(false);
      if (companionSleepTimer.current) window.clearTimeout(companionSleepTimer.current);
      companionSleepTimer.current = window.setTimeout(
        () => setCompanionSleeping(true),
        COMPANION_IDLE_MS,
      );
    };
    keepAwake();
    window.addEventListener("pointerdown", keepAwake, { passive: true });
    window.addEventListener("keydown", keepAwake);
    window.addEventListener("focusin", keepAwake);
    return () => {
      window.removeEventListener("pointerdown", keepAwake);
      window.removeEventListener("keydown", keepAwake);
      window.removeEventListener("focusin", keepAwake);
      if (companionSleepTimer.current) window.clearTimeout(companionSleepTimer.current);
      if (companionDelightTimer.current) window.clearTimeout(companionDelightTimer.current);
    };
  }, []);

  const greetCompanion = () => {
    setCompanionSleeping(false);
    setCompanionDelighted(true);
    playCompanionGiggle();
    if (companionDelightTimer.current) window.clearTimeout(companionDelightTimer.current);
    companionDelightTimer.current = window.setTimeout(() => setCompanionDelighted(false), 900);
  };

  const fireCleared = () => {
    if (clearedFired.current) return;
    clearedFired.current = true;
    onDayCleared?.();
  };

  // The panda touches the floating mystery piece partway through the
  // victory dash -- automatically, no tap -- which zooms it fullscreen
  // (PuzzleRevealOverlay). Reduced motion skips the cutscene entirely: the
  // piece is simply placed, and the run proceeds to fireCleared on its
  // normal schedule.
  const touchPuzzle = () => {
    if (puzzleTouchFired.current || !showPuzzleCard) return;
    puzzleTouchFired.current = true;
    if (reducedMotion) {
      setPuzzleRevealed(true);
      setPuzzlePlacing(true);
      setPuzzleSettled(true);
      return;
    }
    setVictoryPhase("puzzle");
    setAnim("idle");
    setPuzzleZoomed(true);
  };

  // Tapping the enlarged card in PuzzleRevealOverlay is what actually flips
  // it; the actual piece shows by itself first, then after a short beat the
  // full board mounts and DayPuzzlePiece's frame-pop + delayed snap-into-place
  // start. The placed piece then stays there -- a Continue button appears
  // once it settles, and the player advances at their own pace rather than
  // the overlay dismissing itself on a timer.
  const flipPuzzle = () => {
    if (puzzleFlipping || puzzleRevealed) return;
    setPuzzleFlipping(true);
    queue(() => {
      setPuzzleFlipping(false);
      setPuzzleRevealed(true);
      queue(() => {
        setPuzzlePlacing(true);
        queue(() => setPuzzleSettled(true), PUZZLE_PLACEMENT_SETTLE_MS);
      }, PUZZLE_REVEALED_DISPLAY_MS);
    }, PUZZLE_FLIP_MS);
  };

  // Continue button in PuzzleRevealOverlay, enabled once the piece has
  // settled -- dismisses the overlay and hands off to the normal
  // "stage clear" board.
  const continuePuzzle = () => {
    if (!puzzleSettled) return;
    setPuzzleZoomed(false);
    if (reducedMotion) {
      fireCleared();
      return;
    }
    setVictoryPhase("run");
    setAnim("running");
    queue(() => {
      setVictoryPhase("done");
      setAnim("celebrating");
      fireCleared();
    }, 2150);
  };

  // Final hop has landed on the last platform. Drop to the lane, dash to the
  // exit, then tell App the day is cleared (which opens the victory board).
  // When there's a fresh world-puzzle piece, fireCleared instead waits for
  // the player to tap through PuzzleRevealOverlay (flipPuzzle calls it) --
  // that reveal is its own moment on the lane, not squeezed inside the
  // board, and it can't run on a fixed timer once it needs a tap.
  const startVictory = () => {
    if (reducedMotion) {
      setVictoryPhase("done");
      setAnim("celebrating");
      touchPuzzle();
      if (!showPuzzleCard) queue(fireCleared, 300);
      return;
    }
    setVictoryPhase("drop");
    setAnim("falling");
    queue(() => setAnim("landing"), 420);
    queue(() => {
      setVictoryPhase("run");
      setAnim("running");
    }, 560);
    if (showPuzzleCard) {
      queue(touchPuzzle, 560 + PUZZLE_TOUCH_DELAY_MS);
    } else {
      // Longer run now -- the bush is a clear stretch of ground past the goal.
      queue(() => {
        setVictoryPhase("done");
        setAnim("celebrating");
        fireCleared();
      }, 560 + 2100);
    }
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
    // Reloaded onto an already-finished day: no run-in, no hops -- the panda is
    // already at the exit. Nudge App to (re)show the victory board.
    if (reachedGoal && prevDone.current === doneCount) {
      setRunInPhase(null);
      setVisualIndex(total);
      setVictoryPhase("done");
      setAnim("celebrating");
      queue(fireCleared, 650);
      return clearQueue;
    }
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
      // is; snap rather than animate a climb-down. Any victory run is off.
      setVictoryPhase("none");
      clearedFired.current = false;
      puzzleTouchFired.current = false;
      setPuzzleZoomed(false);
      setPuzzleRevealed(false);
      setPuzzlePlacing(false);
      setPuzzleFlipping(false);
      setPuzzleSettled(false);
      setVisualIndex(pandaIndex);
      setAnim("idle");
      return;
    }

    if (reducedMotion) {
      setVisualIndex(pandaIndex);
      playJump();
      if (doneCount === total) {
        startVictory();
      } else {
        setAnim("landing");
        queue(() => setAnim("idle"), 220);
      }
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
        playJump();
        setVisualIndex(from + 1);
      }, HOP_MS * 0.42);
      queue(() => setAnim("landing"), HOP_MS * 0.8);
      queue(() => {
        const arrived = from + 1;
        if (arrived < target) {
          hop(arrived);
        } else if (doneCount === total) {
          startVictory();
        } else {
          setAnim("idle");
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
    setVictoryPhase("none");
    clearedFired.current = false;
    puzzleTouchFired.current = false;
    setPuzzleZoomed(false);
    setPuzzleRevealed(false);
    setPuzzlePlacing(false);
    setPuzzleFlipping(false);
    setPuzzleSettled(false);
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

  const companionAtRest = anim === "idle" && victoryPhase === "none" && runInPhase === null;

  const beginSceneDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || sceneW <= 0) return;
    dragCamera.current = {
      id: event.pointerId,
      startX: event.clientX,
      startOffset: clampedDragCamOffset,
      base: autoCamX,
      min: minCam,
      max: maxCam,
    };
    setDraggingScene(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSceneDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragCamera.current;
    if (!drag || drag.id !== event.pointerId) return;
    const width = sceneRef.current?.clientWidth || sceneW || 1;
    const dx = event.clientX - drag.startX;
    const next = drag.startOffset + (dx / width) * 100;
    setDragCamOffset(Math.max(drag.min - drag.base, Math.min(drag.max - drag.base, next)));
  };

  const endSceneDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragCamera.current?.id !== event.pointerId) return;
    dragCamera.current = null;
    setDraggingScene(false);
  };

  return (
    <div
      ref={sceneRef}
      className="forest-scene"
      data-stage={stage.id}
      data-reduced-motion={reducedMotion || undefined}
      // Once the panda reaches the exit board the world stops scrolling -- the
      // pan settles at the end of the level and holds (skill: "freeze once it
      // reaches the end of the race").
      data-frozen={victoryPhase === "done" || undefined}
      data-dragging={draggingScene || undefined}
      onPointerDown={beginSceneDrag}
      onPointerMove={moveSceneDrag}
      onPointerUp={endSceneDrag}
      onPointerCancel={endSceneDrag}
      onLostPointerCapture={endSceneDrag}
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
      {/* The world theme supplies distinct landscape art and terrain.
          The backdrop follows the camera slowly, with weather above it. */}
      <div className="forest-photo" aria-hidden="true" />
      <div className="forest-sky" aria-hidden="true" />
      <div className="forest-mountains" aria-hidden="true" />
      <Clouds seed={seed} />
      <div className="forest-trees-far" aria-hidden="true" />
      <div className="forest-trees-mid" aria-hidden="true" />
      <div className="forest-texture" aria-hidden="true" />
      <div className="forest-fireflies" aria-hidden="true" />

      <div className="forest-path">
        {/* Ground, cut against the run: solid up to the first ledge, gone for
            the whole platform stretch, back one small ledge past the last one.
            The two inner edges are the only thing set here -- .forest-fg runs
            both outer edges off-screen. With no platforms at all there is
            nothing to cut against, so it stays one unbroken strip. */}
        {firstPlatform ? (
          <>
            <div
              className="forest-fg forest-fg-start"
              aria-hidden="true"
              style={{
                right: `calc(${100 - pct(firstPlatform).left}% + var(--ledge-w) / 2)`,
              }}
            />
            <div
              className="forest-fg forest-fg-exit"
              aria-hidden="true"
              style={{
                left: `calc(${pct(lastPlatform).left}% + var(--ledge-w) * 1.5)`,
              }}
            />
          </>
        ) : (
          <div className="forest-fg" aria-hidden="true" />
        )}

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
          {/* Worlds with their own villain (worldScenery.ts's `guardian` --
             same reference sheet PandaRunner's Forest Dash follows for that
             world's hazard kind) swap it in for the zombie plant here. */}
          {guardian
            ? <GuardianCreature left={0} bottom={0} near={atStartRest} sprite={guardian.sprite} taunt={guardian.taunt} />
            : <ZombiePlant left={0} bottom={0} near={atStartRest} />}
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
                bottom={bottom + 14}
                visible={i >= safeVisualIndex}
                multiplier={bonus ? 5 : undefined}
              />
            </div>
          );
        })}

        {/* Victory lane: a mossy ground strip from under the last platform out
            past the goal to the exit. Only rendered once the day is cleared --
            it's the runway for the end-of-day dash. */}
        {reachedGoal && (
          <div
            className={`victory-lane victory-lane-${victoryPhase}`}
            aria-hidden="true"
            style={{
              left: `${pct({ x: lastPlatform.x, y: 0 }).left}%`,
              width: `${pct(exitPoint).left - pct({ x: lastPlatform.x, y: 0 }).left + 6}%`,
            }}
          />
        )}

        {/* The floating world-puzzle piece, sitting between the last stair
            and the goal flag -- the panda touches it automatically partway
            through the victory dash (see startVictory), no tap. Purely
            decorative: it never determines task/day completion, only
            reflects it (CLAUDE.md §9/§22). */}
        {reachedGoal && showPuzzleCard && (
          <div
            className="forest-puzzle-card"
            aria-hidden="true"
            style={{ left: `${pct(puzzleCardPoint).left}%`, bottom: `${pct(puzzleCardPoint).bottom}%` }}
          >
            <div className="forest-puzzle-card-scale">
              {puzzleRevealed ? (
                <RevealedPuzzlePiece
                  worldIndex={puzzleWorldIndex!}
                  pieceIds={puzzlePieceIds!}
                  earnedPiece={puzzleEarnedPiece}
                  reducedMotion={reducedMotion}
                />
              ) : (
                <MysteryPuzzlePiece onReveal={() => {}} flipping={puzzleFlipping} />
              )}
            </div>
          </div>
        )}

        {/* The fullscreen zoom-in the card above hands off to once touched --
            see touchPuzzle/flipPuzzle. Portalled to <body>: .forest-path (an
            ancestor here) has its own transform for the follow-cam pan, which
            would otherwise become this fixed-position overlay's containing
            block -- trapping it inside the scrolling world instead of
            covering the real viewport, and panning it along with the camera. */}
        {puzzleZoomed &&
          showPuzzleCard &&
          createPortal(
            <PuzzleRevealOverlay
              worldIndex={puzzleWorldIndex!}
              pieceIds={puzzlePieceIds!}
              earnedPiece={puzzleEarnedPiece}
              revealed={puzzleRevealed}
              flipping={puzzleFlipping}
              placing={puzzlePlacing}
              settled={puzzleSettled}
              onReveal={flipPuzzle}
              onContinue={continuePuzzle}
              reducedMotion={reducedMotion}
            />,
            document.body
          )}

        <GoalFlag
          left={pct(goal).left}
          bottom={pct(goal).bottom}
          reached={reachedGoal}
          dayNumber={dayNumber}
        />

        <div
          className={`panda-anchor${companionAtRest ? " panda-anchor-companion" : ""}`}
          data-runin={runInPhase && atStartRest ? runInPhase : undefined}
          data-victory={victoryPhase === "none" ? undefined : victoryPhase}
          style={{ left: `${pct(displayPoint).left}%`, bottom: `${pct(displayPoint).bottom}%` }}
        >
          <Panda
            anim={anim}
            character={character}
            sleeping={companionAtRest && companionSleeping}
            delighted={companionAtRest && companionDelighted}
            onCompanionTap={companionAtRest ? greetCompanion : undefined}
          />
        </div>

        {/* Exit set piece at the very end of the lane: a big bush the character
            runs into and vanishes behind (this block sits ABOVE the panda
            anchor's z-index), with the VICTORY signpost beside it. */}
        {reachedGoal && (
          <div
            className={`victory-exit victory-exit-${victoryPhase}`}
            aria-hidden="true"
            style={{ left: `${pct(exitPoint).left}%`, bottom: `${pct(exitPoint).bottom}%` }}
          >
            <img className="victory-bush" src="/assets/bush.webp" alt="" />
            <VictorySign left={0} bottom={0} />
          </div>
        )}
      </div>
    </div>
  );
}
