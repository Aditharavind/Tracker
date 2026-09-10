import { Component, lazy, Suspense, type ReactNode } from "react";
import type { CharacterId } from "../../game/characters";
import "../../story.css";

const Adventure = lazy(() => import("./Adventure"));

class StoryBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="minigame-picker" role="alert"><div className="minigame-menu"><h2>The trail couldn't open.</h2><p>Check your connection and reload to try again.</p><button className="story-button" onClick={this.props.onClose}>← Forest</button></div></div>;
  }
}

// Story Mode's own entry point (skill/App wiring): a chapter of the same
// 75-day run, opened from a portal in ForestScene rather than the Minigames
// picker, gated by dayNumber (see content.ts's storyWorldUnlockDay).
export default function StoryLauncher({
  character,
  userId,
  dayNumber,
  initialWorld,
  onClose,
}: {
  character: CharacterId;
  userId: number | null;
  dayNumber: number;
  // Set when opened by tapping an unlocked stone on the week map -- lands
  // straight on that world's detail section instead of wherever the last
  // session left off.
  initialWorld?: number;
  onClose: () => void;
}) {
  return (
    <StoryBoundary onClose={onClose}>
      <Suspense fallback={<div className="minigame-picker" role="status">Finding the trail…</div>}>
        <Adventure key={userId} character={character} userId={userId} dayNumber={dayNumber} initialWorld={initialWorld} onClose={onClose} />
      </Suspense>
    </StoryBoundary>
  );
}
