import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Flag, Footprints, Play } from "lucide-react";
import { CHARACTERS, CHARACTER_SPRITE, type CharacterId } from "../../game/characters";
import type { DayCell } from "../../types";
import { ARC_COUNT, ARC_DAYS, journeyProgress } from "../../game/weekSystem";
import { WORLDS } from "../../game/adventure/content";
import { CoinIcon } from "./Coin";
import "../../story.css";
import "../../journey-play.css";

const Adventure = lazy(() => import("./Adventure"));
const MILESTONES = [5, 10, ARC_DAYS];
const COMPANION_HELLOS = [
  ["One little step can wake a whole forest.", "Race you to the next patch of sunshine!"],
  ["We can find our way, one glowing stone at a time.", "A little curious? Me too. Let's explore."],
  ["So many sparkles! Let's follow one trail together.", "The quiet path has surprises, too."],
  ["Tiny paws, big mountain. We've got this.", "Let's stop and enjoy the view on our way."],
  ["Another lantern, another little adventure.", "Glad you're here. Let's keep walking together."],
  ["A breath, a step, and a new adventure.", "Let's see what we discover together."],
];

class StoryBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="minigame-picker" role="alert"><div className="minigame-menu"><h2>The trail couldn't open.</h2><p>Check your connection and reload to try again.</p><button className="story-button" onClick={this.props.onClose}>← Forest</button></div></div>;
  }
}

// A world's story leads into the daily goals. Optional adventure levels
// have their own save and unlock their worlds by completing story missions.
export default function StoryLauncher({
  character,
  userId,
  dayNumber,
  calendar,
  initialWorld,
  onOpenGoals,
  onOpenMap,
  onClose,
}: {
  character: CharacterId;
  userId: number | null;
  dayNumber: number;
  calendar: DayCell[];
  // The selected world's introduction opens before goals or optional play.
  initialWorld?: number;
  onOpenGoals: () => void;
  onOpenMap: () => void;
  onClose: () => void;
}) {
  const [adventureOpen, setAdventureOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [helloCount, setHelloCount] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const journey = journeyProgress(calendar);
  const unlockedWorlds = journey.complete ? WORLDS.length : journey.worldIndex + 1;
  const worldIndex = Math.max(0, Math.min(unlockedWorlds - 1, initialWorld ?? journey.worldIndex));
  const world = WORLDS[worldIndex];
  const bonus = worldIndex >= ARC_COUNT;
  const completed = Math.min(ARC_DAYS, Math.max(0, journey.completedDays - worldIndex * ARC_DAYS));
  const nextMilestone = MILESTONES.find(milestone => milestone > completed);
  const companionName = CHARACTERS.find(item => item.id === character)!.name;
  const greetings = COMPANION_HELLOS[worldIndex];

  useEffect(() => {
    if (adventureOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector<HTMLButtonElement>("[data-story-primary]")?.focus({ preventScroll: page === 0 });
    return () => { document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, [adventureOpen, page]);

  if (!adventureOpen) return (
    <div ref={root} className="world-story world-theme" data-world={worldIndex} role="dialog" aria-modal="true" aria-labelledby="world-story-title" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = root.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <div className="world-story-card">
        <header className="world-story-actions">
          <button className="story-text-button" onClick={onClose}>← Home</button>
          <span className="story-eyebrow">{bonus ? "BONUS CHAPTER" : `WORLD ${worldIndex + 1} / ${ARC_COUNT}`}</span>
          <button className="story-text-button" onClick={onOpenMap}>World map</button>
        </header>
        <div className="world-story-art journey-scene">
          <button type="button" className="journey-companion" onClick={() => setHelloCount(count => count + 1)} aria-label={`Say hello to ${companionName}`}>
            <img key={helloCount} className={helloCount ? "journey-companion-wave" : ""} src={CHARACTER_SPRITE[character]} alt="" />
            <span>Say hello ♡</span>
          </button>
          <p className="journey-greeting" role="status">{helloCount ? greetings[(helloCount - 1) % greetings.length] : "Ready for a little adventure?"}</p>
        </div>
        <div className="world-story-copy">
          <p className="story-eyebrow">{world.motto}</p>
          <h1 id="world-story-title">{world.name}</h1>
          <p aria-live="polite">{world.intro[page]}</p>
          {page < world.intro.length - 1 && <div className="world-story-actions journey-story-next"><button className="story-text-button" data-story-primary onClick={() => setPage(page + 1)}>Continue story → <span className="journey-page-count">{page + 1}/{world.intro.length}</span></button></div>}
          {!bonus && <ol className="journey-how" aria-label="How your daily journey works">
            <li><span className="journey-step-icon" aria-hidden="true"><Check size={20} /></span><div><strong>Finish a real goal</strong><span>Mark it in Daily goals.</span></div></li>
            <li><span className="journey-step-icon journey-step-reward" aria-hidden="true"><Footprints size={19} /><CoinIcon size={18} /></span><div><strong>{companionName} hops ahead</strong><span>You earn a coin!</span></div></li>
            <li><span className="journey-step-icon" aria-hidden="true"><Flag size={20} /></span><div><strong>Complete all 15 days</strong><span>{worldIndex < ARC_COUNT - 1 ? "Open a whole new world." : "Finish your 75-day journey."}</span></div></li>
          </ol>}
          <p className="world-story-progress">{bonus ? "Your 75-day journey is complete. A bonus adventure awaits." : `Days ${worldIndex * ARC_DAYS + 1}–${(worldIndex + 1) * ARC_DAYS} · ${completed} / ${ARC_DAYS} days complete`}</p>
          {!bonus && <>
            <progress value={completed} max={ARC_DAYS} aria-label="Days of daily goals completed in this world" />
            <div className="journey-milestones" aria-label="World milestones">{MILESTONES.map(milestone => <span key={milestone} className={completed >= milestone ? "is-complete" : ""} aria-current={milestone === nextMilestone ? "step" : undefined}>{completed >= milestone && <Check size={12} aria-label="Reached" />}{milestone} days</span>)}</div>
          </>}
          <p className="world-story-rule">{bonus ? "Enjoy the adventure at your own pace." : nextMilestone ? `${nextMilestone - completed} more ${nextMilestone - completed === 1 ? "completed day" : "completed days"} to your ${nextMilestone}-day milestone${nextMilestone === ARC_DAYS ? worldIndex < ARC_COUNT - 1 ? ` — then ${WORLDS[worldIndex + 1].name} opens!` : " — and your journey is complete!" : ". One day at a time."}` : "All 15 days complete. This world is yours to revisit."}</p>
          <div className="journey-choices">
            <div><button className="story-button" data-story-primary={page === world.intro.length - 1 ? true : undefined} onClick={onOpenGoals}>{journey.complete ? "Return to daily goals" : "Go to daily goals →"}</button><small>{journey.complete ? "Revisit the goals that brought you here." : "Real goals move your daily journey forward."}</small></div>
            <div><button className="story-button journey-play-button" onClick={() => setAdventureOpen(true)}><Play size={17} aria-hidden="true" />Play adventure</button><small>Jump, explore & collect coins for fun.<br />Optional play; daily goals stay separate.</small></div>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <StoryBoundary onClose={() => setAdventureOpen(false)}>
      <Suspense fallback={<div className="minigame-picker" role="status">Finding the trail…</div>}>
        <Adventure key={userId} character={character} userId={userId} dayNumber={dayNumber} initialWorld={worldIndex} onClose={() => setAdventureOpen(false)} />
      </Suspense>
    </StoryBoundary>
  );
}
