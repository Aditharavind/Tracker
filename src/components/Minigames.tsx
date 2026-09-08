import { useEffect, useRef, useState } from "react";
import type { CharacterId } from "../game/characters";
import PandaRunner from "./forest/PandaRunner";
import StoryMode from "./forest/StoryMode";
import "../story.css";

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
    const buttons = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
    const first = buttons[0]; const last = buttons[buttons.length - 1];
    if (e.shiftKey && (document.activeElement === first || !root.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }}>
    {mode === "dash" ? <PandaRunner character={character} userId={userId} onClose={() => setMode("choose")} />
      : mode === "story" ? <StoryMode character={character} userId={userId} onClose={() => setMode("choose")} />
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
                <span className="story-eyebrow">3 CHAPTER ADVENTURE</span><strong>Story Mode</strong>
                <span>Restore the forest’s light. Explore, dodge traps, and follow Wisp home.</span><b>Explore →</b>
              </button>
            </div>
            <p className="story-footnote">Play for fun. Your 75-day challenge stays separate.</p>
          </div>
        </div>}
  </div>;
}
