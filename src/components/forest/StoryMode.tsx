import { useCallback, useEffect, useRef, useState } from "react";
import { CHARACTER_SPRITE, type CharacterId } from "../../game/characters";
import { createStory, parseStoryProgress, restartStory, stepStory, STORY_H, STORY_LEVELS, STORY_W, storyCoins, type StoryProgress } from "../../game/storyEngine";
import { drawStory, loadStoryArt } from "../../game/storyRenderer";
import { isMuted, onMuteChange, playJump, toggleMuted } from "../../sound";

type Phase = "map" | "intro" | "playing" | "paused" | "dead" | "outro";
export default function StoryMode({ character, userId, onClose }: { character: CharacterId; userId: number | null; onClose: () => void }) {
  const saveKey = `75hard.story.v1:${userId ?? "guest"}`;
  const [progress, setProgress] = useState<StoryProgress>(() => {
    try { return parseStoryProgress(localStorage.getItem(saveKey)); } catch { return parseStoryProgress(null); }
  });
  const [saveError, setSaveError] = useState(false);
  const [phase, setPhase] = useState<Phase>("map");
  const [levelIndex, setLevelIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [muted, setMuted] = useState(isMuted);
  const [hud, setHud] = useState({ coins: 0, shard: false, checkpoint: false, nearGate: false });
  const state = useRef(createStory());
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const pointers = useRef(new Map<number, number>());
  const jumpQueued = useRef(false);
  const level = STORY_LEVELS[levelIndex];
  const clearInput = useCallback(() => { keys.current.clear(); pointers.current.clear(); jumpQueued.current = false; }, []);
  useEffect(() => { const unsubscribe = onMuteChange(setMuted); return () => { unsubscribe(); }; }, []);

  const finishLevel = useCallback(() => {
    const completed = [...new Set([...progress.completed, levelIndex])].sort((a, b) => a - b);
    const bestCoins = [...progress.bestCoins];
    bestCoins[levelIndex] = Math.max(bestCoins[levelIndex] ?? 0, state.current.coins.length);
    const next = { completed, bestCoins };
    try { localStorage.setItem(saveKey, JSON.stringify(next)); setSaveError(false); }
    catch { setSaveError(true); }
    setProgress(next);
    setSceneIndex(0);
    setPhase("outro");
  }, [levelIndex, progress, saveKey]);

  useEffect(() => {
    clearInput();
    if (phase === "playing") canvas.current?.focus();
    else container.current?.querySelector<HTMLButtonElement>("[data-story-primary]")?.focus();
  }, [phase, sceneIndex, clearInput]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault(); clearInput();
        if (phase === "playing") setPhase("paused");
        else if (phase === "paused") setPhase("playing");
        else if (phase === "map") onClose();
        else setPhase("map");
        return;
      }
      if (phase !== "playing") return;
      const key = e.key.toLowerCase();
      if (!["arrowleft", "arrowright", "a", "d", "arrowup", "w", " "].includes(key)) return;
      if (e.target instanceof HTMLButtonElement && key === " ") return;
      e.preventDefault(); keys.current.add(key);
      if (["arrowup", "w", " "].includes(key) && !e.repeat) jumpQueued.current = true;
    };
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const pause = () => { clearInput(); setPhase(p => p === "playing" ? "paused" : p); };
    const onVisibility = () => { if (document.hidden) pause(); };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onUp);
    window.addEventListener("blur", pause); document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, onClose, clearInput]);

  useEffect(() => {
    if (!["playing", "paused", "dead"].includes(phase)) return;
    const el = canvas.current; const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const art = loadStoryArt(character);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let viewWidth = STORY_W;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      viewWidth = window.innerWidth < 650 && window.innerHeight > window.innerWidth ? 560 : STORY_W;
      el.width = viewWidth * dpr; el.height = STORY_H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);
    let raf = 0; let last = 0; let accumulator = 0; let lastHud = 0; let ended = false;
    const frame = (now: number) => {
      if (ended) return;
      if (!last) last = now;
      accumulator += Math.min(0.1, (now - last) / 1000); last = now;
      if (phase === "playing") {
        while (accumulator >= 1 / 120 && state.current.status === "playing") {
          const held = keys.current;
          const touchDirections = [...pointers.current.values()];
          const right = held.has("arrowright") || held.has("d") || touchDirections.includes(1);
          const left = held.has("arrowleft") || held.has("a") || touchDirections.includes(-1);
          const jump = jumpQueued.current; jumpQueued.current = false;
          const oldJumps = state.current.jumps;
          stepStory(state.current, level, 1 / 120, Number(right) - Number(left), jump);
          if (state.current.jumps > oldJumps) playJump();
          accumulator -= 1 / 120;
        }
        if (now - lastHud > 90 || state.current.status !== "playing") {
          setHud({ coins: state.current.coins.length, shard: state.current.shard, checkpoint: state.current.checkpoint, nearGate: state.current.x > level.length - 270 });
          lastHud = now;
        }
        if (state.current.status === "dead") { ended = true; setPhase("dead"); }
        else if (state.current.status === "won") { ended = true; finishLevel(); }
      }
      drawStory(ctx, state.current, level, art, motion.matches, viewWidth);
      if (!ended) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [phase, level, character, finishLevel]);

  const chooseLevel = (index: number) => {
    state.current = createStory(); setHud({ coins: 0, shard: false, checkpoint: false, nearGate: false });
    setLevelIndex(index); setSceneIndex(0); setPhase("intro");
  };
  const finishScene = () => setPhase(phase === "intro" ? "playing" : "map");
  const retry = () => {
    state.current = restartStory(state.current, level);
    setHud({ coins: state.current.coins.length, shard: state.current.shard, checkpoint: state.current.checkpoint, nearGate: false });
    setPhase("playing");
  };
  const scene = (phase === "outro" ? level.outro : level.intro)[sceneIndex];
  const scenes = phase === "outro" ? level.outro : level.intro;
  const finished = progress.completed.length === STORY_LEVELS.length;

  return <div ref={container} className="story-mode" role="dialog" aria-modal="true" aria-label="Story Mode: The Lost Light">
    {phase === "map" ? <div className="story-map">
      <header className="story-map-header"><span className="story-eyebrow">STORY MODE</span><button className="story-text-button" onClick={onClose}>← Modes</button></header>
      <div className="story-map-intro"><span className="story-map-star" aria-hidden="true">✦</span><p className="story-eyebrow">{finished ? "THE BEACON SHINES AGAIN" : "THREE FRAGMENTS. ONE WAY HOME."}</p>
        <h1>The Lost Light</h1><p>A broken beacon. A forest lost in darkness.<br />Follow Wisp, recover the stars, and bring the light home.</p>
      </div>
      <div className="story-chapters">{STORY_LEVELS.map((chapter, i) => {
        const unlocked = i <= progress.completed.length; const complete = progress.completed.includes(i);
        return <button key={chapter.title} className={`story-chapter${complete ? " complete" : ""}`} disabled={!unlocked} onClick={() => chooseLevel(i)} style={{ "--chapter-color": chapter.color } as React.CSSProperties} data-story-primary={i === Math.min(progress.completed.length, 2) ? "" : undefined}>
          <span className="story-chapter-number">{complete ? "✦" : unlocked ? `0${i + 1}` : "⌑"}</span>
          <span className="story-eyebrow">{chapter.subtitle}</span><strong>{chapter.title}</strong>
          <span>{complete ? `Fragment recovered · ${progress.bestCoins[i]}/${storyCoins(chapter).length} coins` : unlocked ? "Find the fragment. Reach the lantern gate." : `Complete chapter ${i} to unlock`}</span>
          <b>{complete ? "Replay chapter →" : unlocked ? "Begin chapter →" : "Locked"}</b>
        </button>;
      })}</div>
      <p className="story-footnote" role="status">{saveError ? "Couldn't save on this device. Keep this window open to retain your chapter progress." : `${progress.completed.length}/3 fragments restored · Chapter progress saves on this device.`}</p>
    </div> : phase === "intro" || phase === "outro" ? <div className={`story-cutscene story-mood-${scene.mood}`}>
      <header className="story-scene-header"><span className="story-eyebrow">{level.subtitle}</span><button className="story-text-button" onClick={finishScene}>{phase === "intro" ? "Skip to play" : "Skip to chapters"} →</button></header>
      <div className="story-cinema" aria-hidden="true">
        <div className="story-cinema-moon" /><div className="story-cinema-beacon"><span>✦</span><i /></div>
        <div className="story-cinema-ground" /><img className="story-cinema-hero" src={CHARACTER_SPRITE[character]} alt="" />
        <div className="story-wisp" /><div className="story-cinema-stars">✧ <span>✦</span> ✧</div>
        <span className="story-cinema-caption">{scene.mood === "storm" ? "A FOREST WAITING FOR DAWN" : scene.mood === "light" ? "A LITTLE LIGHT GOES A LONG WAY" : "YOU DON'T HAVE TO WALK ALONE"}</span>
      </div>
      <div className="story-dialogue" key={`${phase}-${sceneIndex}`}>
        <div aria-live="polite" aria-atomic="true"><p className="story-eyebrow">{scene.speaker}</p><p className="story-dialogue-text">{scene.text}</p></div>
        <div className="story-dialogue-footer"><span>{sceneIndex + 1} / {scenes.length}</span><button className="story-button" data-story-primary onClick={() => sceneIndex + 1 < scenes.length ? setSceneIndex(sceneIndex + 1) : finishScene()}>{sceneIndex + 1 < scenes.length ? "Continue →" : phase === "intro" ? "Let's go →" : "Return to chapters →"}</button></div>
      </div>
    </div> : <div className="story-play">
      <header className="story-hud"><div><span className="story-eyebrow">{level.subtitle}</span><strong>{level.title}</strong></div>
        <span aria-label={`${hud.coins} coins`}>● {hud.coins}</span><span className={hud.shard ? "story-has-star" : ""}>✦ {hud.shard ? "1/1" : "0/1"}</span>
        <button className="story-text-button" aria-label={muted ? "Unmute sound" : "Mute sound"} onClick={toggleMuted}>{muted ? "Sound off" : "Sound on"}</button>
        <button className="story-text-button" onClick={() => setPhase(phase === "paused" ? "playing" : "paused")} disabled={phase === "dead"}>{phase === "paused" ? "Resume" : "Ⅱ Pause"}</button>
      </header>
      <p className="story-objective" role="status">{hud.nearGate && !hud.shard ? "Still need the star! Head back, or pause and retry from your checkpoint to restore the bridge." : hud.shard ? "Fragment found! Reach the golden lantern gate →" : "Find the glowing star fragment, then reach the lantern gate →"}{hud.checkpoint && " · Checkpoint lit"}</p>
      <div className="story-viewport">
        <canvas ref={canvas} className="story-canvas" tabIndex={0} aria-label="Forest platform adventure. Move with left and right arrows or A and D. Jump with Space or up arrow; press again to double jump. Escape pauses." />
        {(phase === "paused" || phase === "dead") && <div className="story-play-overlay"><div className="story-pause-card">
          <p className="story-eyebrow">{phase === "paused" ? "TAKE A BREATHER" : "EVERY HERO TRIES AGAIN"}</p><h2>{phase === "paused" ? "Adventure paused" : "A little stumble"}</h2>
          <p>{phase === "paused" ? "Your place is safe. Continue when you're ready." : state.current.reason}</p>
          {phase === "dead" && <p className="story-footnote">{state.current.checkpoint ? "You'll return to the blue lantern with your collected items." : "Try again from the beginning of this chapter."}</p>}
          <button className="story-button" data-story-primary onClick={phase === "paused" ? () => setPhase("playing") : retry}>{phase === "paused" ? "Continue adventure" : state.current.checkpoint ? "Retry from checkpoint" : "Try again"}</button>
          {phase === "paused" && <button className="story-text-button" onClick={retry}>{state.current.checkpoint ? "Retry from checkpoint" : "Restart chapter"}</button>}
          <button className="story-text-button" onClick={() => setPhase("map")}>Back to chapters</button>
        </div></div>}
      </div>
      <div className="story-controls"><div className="story-direction-controls">{[-1, 1].map(direction => <button key={direction} aria-label={direction < 0 ? "Move left" : "Move right"} disabled={phase !== "playing"}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, direction); }}
        onPointerUp={e => pointers.current.delete(e.pointerId)} onPointerCancel={e => pointers.current.delete(e.pointerId)} onLostPointerCapture={e => pointers.current.delete(e.pointerId)}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); pointers.current.set(direction, direction); } }}
        onKeyUp={e => { if (e.key === " " || e.key === "Enter") pointers.current.delete(direction); }} onBlur={() => pointers.current.delete(direction)}>{direction < 0 ? "←" : "→"}</button>)}</div>
        <span className="story-control-hint">← → move · Space to jump<br />Jump twice to go higher</span>
        <button className="story-jump" disabled={phase !== "playing"} onPointerDown={e => { e.preventDefault(); jumpQueued.current = true; }} onClick={e => { if (e.detail === 0) jumpQueued.current = true; }}>Jump ↑</button>
      </div>
      {saveError && <p className="story-footnote" role="status">Progress couldn't be saved on this device.</p>}
    </div>}
  </div>;
}
