import { ARC_COUNT } from "../../game/weekSystem";

/**
 * The arc trail map's entry point inside the main forest game (not the
 * Minigames picker): a small wooden signpost fixed in the corner of the
 * scene, using the same carved sign sprite as StartSign/VictorySign. It
 * doesn't scroll with the follow-cam -- it's a sibling of .forest-path, not
 * a child of it -- so it stays reachable regardless of how far the day's
 * platform run has scrolled. Opens the trail map (skill's WeekMap), not
 * Story Mode directly -- that map is what actually launches a world.
 */
export default function StoryPortal({ unlockedWorlds, onOpen }: { unlockedWorlds: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="story-portal"
      onClick={onOpen}
      aria-label={`Trail map: ${unlockedWorlds} of ${ARC_COUNT} arcs open`}
    >
      <img className="story-portal-sprite" src="/assets/start-sign.webp" alt="" aria-hidden="true" />
      <span className="story-portal-plaque pixel-font">ARCS</span>
      <span className="story-portal-count pixel-font">{unlockedWorlds}/{ARC_COUNT}</span>
    </button>
  );
}
