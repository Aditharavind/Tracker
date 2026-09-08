import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { CharacterId } from "../game/characters";
import PandaRunner from "./forest/PandaRunner";
import "../story.css";
const StoryMode = lazy(() => import("./forest/Adventure"));

class StoryBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="minigame-picker" role="alert"><div className="minigame-menu"><h2>The trail couldn't open.</h2><p>Check your connection and reload to try again.</p><button className="story-button" onClick={this.props.onClose}>← Minigames</button></div></div>;
  }
}

export default function Minigames({ character, userId, onClose }: { character: CharacterId; userId: number | null; onClose: () => void }) {
  const [mode, setMode] = useState<"choose" | "dash" | "story">("choose");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [mode]);
  return <div ref={root} onKeyDown={e => {
    if (e.key === "Escape" && mode === "choose") { e.stopPropagation(); onClose(); }
    if (e.key !== "Tab") return;
    const buttons = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
    const first = buttons[0]; const last = buttons[buttons.length - 1];
    if (e.shiftKey && (document.activeElement === first || !root.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }}>
    {mode === "dash" ? <PandaRunner character={character} userId={userId} onClose={() => setMode("choose")} />
      : mode === "story" ? <StoryBoundary onClose={() => setMode("choose")}><Suspense fallback={<div className="minigame-picker" role="status">Finding the trail…</div>}><StoryMode key={userId} character={character} userId={userId} onClose={() => setMode("choose")} /></Suspense></StoryBoundary>
        : <div className="minigame-picker" role="dialog" aria-modal="true" aria-labelledby="minigame-title">
          <div className="minigame-menu">
            <button className="story-text-button minigame-close" onClick={onClose}>✕ Close</button>
            <p className="story-eyebrow">A LITTLE ADVENTURE</p>
            <h2 id="minigame-title">Choose your path</h2>
            <p>A quick run, or a forest with a story to tell.</p>
            <div className="minigame-options">
              <button className="minigame-option" onClick={() => setMode("dash")}>
                <span className="minigame-mode-art" aria-hidden="true">➜</span>
                <span className="story-eyebrow">ENDLESS RUNNER</span><strong>Forest Dash</strong>
                <span>Jump the gaps, collect coins, and chase your best score.</span><b>Run →</b>
              </button>
              <button className="minigame-option story-option" onClick={() => setMode("story")}>
                <span className="minigame-mode-art" aria-hidden="true">✦</span>
                <span className="story-eyebrow">8 WORLDS · ONE JOURNEY</span><strong>Story Mode</strong>
                <span>Find the path again. Face your fears, earn new powers, and grow with Panda.</span><b>Explore →</b>
              </button>
            </div>
            <p className="story-footnote">Play for fun. Your 75-day challenge stays separate.</p>
          </div>
        </div>}
  </div>;
}
