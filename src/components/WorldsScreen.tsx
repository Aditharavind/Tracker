import { useState } from "react";
import { WORLDS } from "../game/adventure/content";
import { ARC_COUNT, journeyProgress } from "../game/weekSystem";
import type { DayCell } from "../types";
import "../worlds-screen.css";

/**
 * The 5-world select grid, opened by tapping the topbar's WORLD label.
 * Unlocked cards use that world's real backdrop (WORLD_SCENERY's
 * --world-background, via .world-theme[data-world]); locked ones show a
 * generic "?" and a hook instead of the art, since there's nothing to
 * preview yet. Tapping an unlocked card opens a paginated comic-style
 * retelling of that world's intro (WORLDS[i].intro, the same copy
 * StoryLauncher already uses) with a Continue button bottom-center.
 */
export default function WorldsScreen({
  calendar,
  onClose,
}: {
  calendar: DayCell[];
  onClose: () => void;
}) {
  const journey = journeyProgress(calendar);
  const unlockedCount = journey.complete ? ARC_COUNT : journey.worldIndex + 1;
  const [openWorld, setOpenWorld] = useState<number | null>(null);

  if (openWorld !== null) {
    return <WorldComicStory worldIndex={openWorld} onClose={() => setOpenWorld(null)} />;
  }

  return (
    <div className="worlds-screen" role="dialog" aria-modal="true" aria-labelledby="worlds-screen-title">
      <header className="worlds-screen-head">
        <h1 id="worlds-screen-title" className="pixel-font">WORLDS</h1>
        <button type="button" className="worlds-screen-close" onClick={onClose} aria-label="Close" title="Close">
          ×
        </button>
      </header>

      <div className="worlds-grid" role="list">
        {Array.from({ length: ARC_COUNT }, (_, i) => {
          const unlocked = i < unlockedCount;
          const world = WORLDS[i];
          const label = unlocked
            ? `World ${i + 1}: ${world.name}. Open its story.`
            : `World ${i + 1}: locked. Discover after 15 days of consistency.`;
          return (
            <button
              key={i}
              type="button"
              role="listitem"
              className={`world-card world-theme${unlocked ? "" : " locked"}`}
              data-world={i}
              disabled={!unlocked}
              onClick={() => setOpenWorld(i)}
              aria-label={label}
              title={label}
            >
              {unlocked ? (
                <span className="world-card-name pixel-font">
                  WORLD {i + 1}
                  <br />
                  {world.name.toUpperCase()}
                </span>
              ) : (
                <>
                  <span className="world-card-mark pixel-font" aria-hidden="true">?</span>
                  <span className="world-card-hook">Discover after 15 days of consistency</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorldComicStory({ worldIndex, onClose }: { worldIndex: number; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const world = WORLDS[worldIndex];
  const lastPage = page >= world.intro.length - 1;

  return (
    <div
      className="world-comic world-theme"
      data-world={worldIndex}
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-comic-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="world-comic-art" aria-hidden="true" />
      <div className="world-comic-caption">
        <p id="world-comic-title" className="world-comic-eyebrow pixel-font">
          WORLD {worldIndex + 1} · {world.name.toUpperCase()}
        </p>
        <p className="world-comic-text" aria-live="polite">
          {world.intro[page]}
        </p>
        <button type="button" className="world-comic-continue pixel-font" onClick={() => (lastPage ? onClose() : setPage((p) => p + 1))} autoFocus>
          {lastPage ? "CONTINUE →" : `CONTINUE (${page + 1}/${world.intro.length})`}
        </button>
      </div>
    </div>
  );
}
