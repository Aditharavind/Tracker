import { useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import type { CharacterId } from "../../game/characters";
import type { DayCell } from "../../types";
import { WORLDS } from "../../game/adventure/content";
import { TRAIL_ART, TRAIL_STONES } from "../../game/adventure/trail";
import { ARC_COUNT, ARC_DAYS, arcDayRange, journeyProgress } from "../../game/weekSystem";
import { usePrefersReducedMotion } from "./ForestScene";
import "../../story.css";
import "../../adventure-trail.css";
import "../../weekmap.css";

const BACK_CHARACTER: Record<CharacterId, string> = {
  panda: "/assets/story/panda-back.png",
  koala: "/assets/story/koala-back.png",
  redpanda: "/assets/story/redpanda-back.png",
};

// The same 15-stone trail art and stone anchors the Adventure minigame's own
// level-select screen uses (game/adventure/trail.ts) -- but every stone here
// stands for a REAL daily-goal day from `calendar`, not an optional
// platformer mission, and clicking any of them just closes this map and
// returns to today's forest scene. No game launches from here.
export default function WeekMap({
  character,
  calendar,
  onClose,
}: {
  character: CharacterId;
  calendar: DayCell[];
  onClose: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const progress = useMemo(() => journeyProgress(calendar), [calendar]);
  const world = WORLDS[progress.worldIndex];
  const { start: worldStart } = arcDayRange(progress.worldIndex + 1);
  const currentDay = Math.min(progress.completedDays + 1, 75);
  const currentStage = Math.min(Math.max(currentDay - worldStart, 0), ARC_DAYS - 1);
  const currentStone = TRAIL_STONES[currentStage];

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

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
    const scroll = scrollRef.current;
    const scene = sceneRef.current;
    if (!scroll || !scene) return;
    const target = (currentStone.y / TRAIL_ART.height) * scene.clientHeight - scroll.clientHeight * 0.57;
    scroll.scrollTo({ top: Math.max(0, target), behavior: reducedMotion ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage, reducedMotion]);

  return (
    <div
      ref={rootRef}
      className="weekmap panda-adventure world-theme"
      data-world={progress.worldIndex}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekmap-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key !== "Tab") return;
        const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
    >
      <header className="weekmap-header">
        <button type="button" className="weekmap-close" onClick={onClose} aria-label="Return to your world">
          Back
        </button>
        <div className="weekmap-intro">
          <p className="weekmap-eyebrow">WORLD MAP · WORLD {progress.worldIndex + 1} OF {ARC_COUNT}</p>
          <h1 id="weekmap-title">{world.name}</h1>
          <p className="weekmap-motto">{world.motto}</p>
          <div className="weekmap-progress-heading" aria-live="polite">
            <strong>{progress.worldCompletedDays} / {ARC_DAYS} days complete</strong>
            <span>{progress.complete ? "Journey complete" : `Day ${progress.dayInWorld} in this world`}</span>
          </div>
          <progress className="weekmap-progress" value={progress.worldCompletedDays} max={ARC_DAYS} aria-label="Completed daily goals in this world" />
        </div>
      </header>

      <div ref={scrollRef} className="adventure-trail-scroll" role="region" aria-label={`${world.name}: 15 daily-goal stones`} tabIndex={0}>
        <div ref={sceneRef} className="adventure-trail-scene" style={{ aspectRatio: `${TRAIL_ART.width} / ${TRAIL_ART.height}` }}>
          <img className="adventure-trail-art" src={TRAIL_ART.src} width={TRAIL_ART.width} height={TRAIL_ART.height} alt="" draggable={false} />
          {TRAIL_STONES.map((stone, stage) => {
            const day = worldStart + stage;
            const done = day <= progress.completedDays;
            const current = !progress.complete && day === currentDay;
            const cellStatus = calendar[day - 1]?.status;
            const status = done ? "complete" : cellStatus === "missed" ? "missed" : current ? "today" : "upcoming";
            const label = `Day ${day}: ${status}. Return to your forest.`;
            return (
              <button
                key={`day-${day}`}
                type="button"
                className={`adventure-level-stone${current ? " current" : ""}${done ? " completed" : ""}`}
                style={{ left: `${(stone.x / TRAIL_ART.width) * 100}%`, top: `${(stone.y / TRAIL_ART.height) * 100}%` }}
                aria-current={current ? "step" : undefined}
                title={label}
                aria-label={label}
                onClick={onClose}
              >
                <span className="adventure-level-number" aria-hidden="true">{stage + 1}</span>
                <span className="adventure-level-badge" aria-hidden="true">{done ? <Check size={13} /> : null}</span>
              </button>
            );
          })}
          <img
            className="adventure-trail-character"
            src={BACK_CHARACTER[character]}
            alt=""
            draggable={false}
            style={{
              left: `${((currentStone.x + (currentStone.x < TRAIL_ART.width / 2 ? 145 : -145)) / TRAIL_ART.width) * 100}%`,
              top: `${((currentStone.y + 110) / TRAIL_ART.height) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
