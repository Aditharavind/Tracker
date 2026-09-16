import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Maximize, Minimize, Pause, Play, Settings as SettingsIcon } from "lucide-react";
import { CHARACTERS, CHARACTER_SPRITE, type CharacterId } from "../../game/characters";
import { FINAL_LEVEL_ID, LEVELS_PER_WORLD, MAIN_LEVELS, POWERS, WISDOM, WORLDS, firstLevelForWorld, levelIdsForWorld, makeLevel, wisdomUrl, type Power } from "../../game/adventure/content";
import { createState, FIXED_STEP, HEIGHT, snapshot, step, WIDTH } from "../../game/adventure/engine";
import { Controls, PerformanceGovernor } from "../../game/adventure/controls";
import { canPlay, completeLevel, emptySave, parseSave, penaltyActive, recordAttempt, recordFailure, resumeLevelForWorld, saveKey, type Attempt, type Save } from "../../game/adventure/save";
import { artImages, loadArt, newCamera, prepareArt, render } from "../../game/adventure/render";
import { viewportSize } from "../../game/adventure/viewport";
import { AdventureAudio } from "../../game/adventure/audio";
import AdventureSettings from "./AdventureSettings";
import AdventureTouch from "./AdventureTouch";
import AdventureCinema from "./AdventureCinema";
import AdventureBoss from "./AdventureBoss";
import { CoinIcon } from "./Coin";
import "../../adventure.css";

type Phase = "map" | "intro" | "loading" | "play" | "paused" | "dead" | "reflection" | "reward" | "ending" | "settings";
const asScene = (phase: Phase): Attempt["scene"] => ["intro", "reflection", "reward", "ending"].includes(phase) ? phase as Attempt["scene"] : "play";
const ENDING = ["The old shadow loosens its grip. It fades into the trees. For a moment, there is only silence.", "Sunlight returns to the original trail. Same forest. Same panda. A different way of seeing.", "I thought I had to become someone else. You helped me find my way back to myself.", "The journey doesn't end here."];

export default function Adventure({ character, userId, dayNumber, initialWorld, onClose }: { character: CharacterId; userId: number | null; dayNumber: number; initialWorld?: number; onClose: () => void }) {
  const key = saveKey(userId);
  const [initial] = useState(() => { try { return { save: parseSave(localStorage.getItem(key)), failed: false }; } catch { return { save: emptySave(), failed: true }; } });
  const [save, setSave] = useState<Save>(initial.save); const saved = useRef(save);
  const [saveError, setSaveError] = useState(initial.failed);
  const [phase, setPhase] = useState<Phase>("map"); const phaseRef = useRef<Phase>("map");
  const [page, setPage] = useState(0); const pageRef = useRef(0);
  const [levelId, setLevelId] = useState(initial.save.lastLevel ?? 0); const idRef = useRef(levelId);
  // The week map (skill's WeekMap) opens Adventure with the tapped world
  // pre-selected -- otherwise this falls back to wherever the last session
  // left off, same as always.
  const [worldIndex, setWorldIndex] = useState(Math.max(0, Math.min(WORLDS.length - 1, initialWorld ?? Math.floor(Math.min(levelId, FINAL_LEVEL_ID) / LEVELS_PER_WORLD))));
  const level = useMemo(() => makeLevel(levelId), [levelId]);
  const levelLength = useRef(level.length);
  const [initialState] = useState(() => createState(level, save));
  const state = useRef(initialState);
  const controls = useRef(new Controls()); const audio = useRef(new AdventureAudio());
  const [selected, setSelected] = useState<Power>(save.powers.find(p => ["focus", "shield", "strength", "hope"].includes(p)) ?? "focus"); const selectedRef = useRef(selected);
  const [hud, setHud] = useState({ health: 5, coins: 0, checkpoint: 0, resolve: 0, momentum: 0, cooldown: 0, bossHp: 0, bossMax: 0, bossPhase: 1, progress: 0, elapsed: 0 });
  const [assetError, setAssetError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState(""); const toastUntil = useRef(0);
  const [journal, setJournal] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null); const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const previousPhase = useRef<Phase>("map"); const art = useRef<ReturnType<typeof loadArt> | null>(null);
  const artWorld = useRef<number | undefined>(undefined);
  const active = useRef(false); const revision = useRef(0);
  const governor = useRef(new PerformanceGovernor()); const camera = useRef(newCamera());
  const settings = save.settings;
  const moveTo = useCallback((next: Phase, nextPage = 0) => {
    controls.current.clear(); phaseRef.current = next; pageRef.current = nextPage; setPage(nextPage); setPhase(next);
    if (next !== "play") audio.current.pause();
  }, []);
  const persist = useCallback((next: Save) => {
    saved.current = next; setSave(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setSaveError(false); return true; }
    catch { setSaveError(true); return false; }
  }, [key]);
  const storeAttempt = useCallback((scene?: Attempt["scene"], nextPage?: number) => {
    if (!active.current) return;
    if (state.current.status === "won" && (scene ?? asScene(phaseRef.current)) === "play") return;
    if (!scene && ["map", "settings"].includes(phaseRef.current)) return;
    return persist(recordAttempt(saved.current, idRef.current, snapshot(state.current, scene ?? asScene(phaseRef.current), nextPage ?? pageRef.current)));
  }, [persist]);
  const refreshHud = useCallback(() => {
    const s = state.current; setHud({ health: s.health, coins: s.coins.size, checkpoint: s.checkpoint, resolve: s.resolve, momentum: s.rush > 0 ? 100 : s.momentum, cooldown: s.abilityCooldown, bossHp: s.boss?.active ? s.boss.hp : 0, bossMax: s.boss?.maxHp ?? 0, bossPhase: s.boss?.phase ?? 1, progress: Math.min(100, s.x / levelLength.current * 100), elapsed: s.elapsed });
  }, []);
  const selectPower = useCallback((power: Power) => { selectedRef.current = power; setSelected(power); }, []);
  const pause = useCallback(() => { if (phaseRef.current === "play") { storeAttempt("play"); moveTo("paused"); } }, [moveTo, storeAttempt]);
  const leaveLevel = () => { storeAttempt(); moveTo("map"); };
  const begin = (id: number, fresh = false) => {
    if (!canPlay(saved.current, id, dayNumber)) return;
    const nextLevel = makeLevel(id); const attempt = fresh ? undefined : saved.current.attempts[id];
    levelLength.current = nextLevel.length;
    idRef.current = id; setLevelId(id); setWorldIndex(nextLevel.world); state.current = createState(nextLevel, saved.current, attempt);
    active.current = true; revision.current = state.current.revision; camera.current = { x: Math.max(0, state.current.x - 200), zoom: 1 }; refreshHud();
    const nextPhase = attempt?.scene ?? (nextLevel.stage === 0 || nextLevel.boss ? "intro" : "play"); storeAttempt(nextPhase, attempt?.page ?? 0);
    moveTo(nextPhase === "play" ? attempt ? "paused" : "loading" : nextPhase, attempt?.page ?? 0);
  };
  // Opened from the weekly trail map with a specific world already chosen --
  // that map WAS the world-picker, so this screen's own map/world-select
  // would just be a second, redundant one. Jump straight into the trail
  // instead (resuming it if one's already in progress). Runs once,
  // synchronously before paint, so there's no visible flash of the map
  // phase first. If the world turns out not to be playable yet (e.g. its
  // world's boss-sequence gate isn't cleared even though the calendar says
  // the week is unlocked), begin() is a no-op and this falls back to the map.
  useLayoutEffect(() => {
    if (initialWorld === undefined) return;
    const resumeId = resumeLevelForWorld(saved.current, Math.max(0, Math.min(WORLDS.length - 1, initialWorld)));
    begin(resumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const play = () => {
    setAssetError(false); storeAttempt("play", 0); moveTo("loading");
    // Unlock audio within the user's gesture, including on mobile Safari.
    void audio.current.start();
  };
  const retry = () => { state.current = createState(level, saved.current, snapshot(state.current)); revision.current = 0; camera.current = { x: Math.max(0, state.current.x - 200), zoom: 1 }; refreshHud(); play(); };
  const finishMoment = () => {
    const finishedId = idRef.current; const finishedLevel = makeLevel(finishedId);
    const attempts = { ...saved.current.attempts }; delete attempts[finishedId];
    persist({ ...saved.current, attempts, lastLevel: null }); active.current = false;
    // A world is a 15-level run. Clearing a non-boss level moves straight to
    // the next level in the same world; clearing level 15 returns to the map
    // with the next world unlocked by completion.
    if (!finishedLevel.boss && finishedId + 1 < MAIN_LEVELS && makeLevel(finishedId + 1).world === finishedLevel.world) {
      begin(finishedId + 1, true);
      return;
    }
    setWorldIndex(Math.min(WORLDS.length - 1, Math.floor(Math.min(FINAL_LEVEL_ID, finishedId + 1) / LEVELS_PER_WORLD))); moveTo("map");
  };
  const openSettings = () => { storeAttempt(); previousPhase.current = phaseRef.current === "play" ? "paused" : phaseRef.current; moveTo("settings"); };

  useEffect(() => {
    const current = loadArt(level.world, character);
    art.current = current; artWorld.current = level.world;
    if (phase !== "loading" && phase !== "intro") return;
    let cancelled = false;
    void prepareArt(current).then(() => {
      if (!cancelled && phase === "loading") {
        moveTo(document.hidden ? "paused" : "play");
        if (!document.hidden) void audio.current.start();
      }
    }).catch(() => { if (!cancelled && phase === "loading") setAssetError(true); });
    return () => { cancelled = true; };
  }, [phase, level.world, character, loadAttempt, moveTo]);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch { setToast("Full screen is unavailable in this browser."); toastUntil.current = performance.now() + 3000; }
  };

  useEffect(() => { if (phase === "play") canvas.current?.focus({ preventScroll: true }); else root.current?.querySelector<HTMLButtonElement>("[data-story-primary]")?.focus({ preventScroll: true }); }, [phase, page]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (phaseRef.current === "settings") return;
        e.preventDefault();
        if (phaseRef.current === "play") pause();
        else if (phaseRef.current === "map") onClose();
        else if (phaseRef.current === "paused") { setAssetError(false); moveTo("loading"); void audio.current.start(); }
        else { storeAttempt(); moveTo("map"); }
        return;
      }
      if (phaseRef.current !== "play" || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.target instanceof HTMLButtonElement) return;
      const action = controls.current.key(e.key, saved.current.settings);
      if (action) { e.preventDefault(); if (!e.repeat) controls.current.press(action, "keyboard", e.code); }
    };
    const onUp = (e: KeyboardEvent) => { const action = controls.current.key(e.key, saved.current.settings); if (action) controls.current.release(action, e.code); };
    const hide = () => { if (document.hidden) { storeAttempt(); pause(); } };
    const pagehide = () => { storeAttempt(); pause(); };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onUp); window.addEventListener("blur", pause); window.addEventListener("pagehide", pagehide); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); window.removeEventListener("blur", pause); window.removeEventListener("pagehide", pagehide); document.removeEventListener("visibilitychange", hide); };
  }, [pause, onClose, moveTo, storeAttempt]);
  useEffect(() => () => { storeAttempt(); audio.current.dispose(); art.current = null; }, [storeAttempt]);

  useEffect(() => {
    if (phase !== "paused") return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      controls.current.pollGamepad();
      if (controls.current.consumePause()) { setAssetError(false); moveTo("loading"); void audio.current.start(); }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, moveTo]);

  useEffect(() => {
    if (!["reflection", "reward"].includes(phase) && !(phase === "ending" && page > 0)) return;
    const player = audio.current;
    void player.start();
    const timer = window.setInterval(() => {
      if (document.hidden) { player.pause(); return; }
      void player.start();
      player.tick(level.world, "peace", false, saved.current.settings);
    }, 500);
    return () => { window.clearInterval(timer); player.pause(); };
  }, [phase, page, level.world]);

  useEffect(() => {
    if (!["play", "paused", "dead"].includes(phase)) return;
    const el = canvas.current; const ctx = el?.getContext("2d"); if (!el || !ctx) return;
    if (!art.current || artWorld.current !== level.world || art.current.character !== character) { art.current = loadArt(level.world, character); artWorld.current = level.world; }
    let raf = 0; let last = 0; let accumulator = 0; let lastHud = 0; let lastSave = 0; let ended = false; let victoryAt: number | null = null; let viewWidth = WIDTH;
    const systemMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let bounds = viewport.current!.getBoundingClientRect();
    const resize = () => {
      const config = saved.current.settings;
      const size = viewportSize(bounds.width, bounds.height, window.devicePixelRatio || 1, config, governor.current.resolution);
      viewWidth = size.viewWidth;
      const { width, height } = size;
      if (el.width !== width || el.height !== height) { el.width = width; el.height = height; ctx.setTransform(width / viewWidth, 0, 0, height / HEIGHT, 0, 0); }
    };
    const draw = (dt = 1 / 60) => {
      resize(); const config = saved.current.settings;
      const q = config.performance ? 0 : config.quality === "auto" ? governor.current.level : ["low", "medium", "high", "ultra"].indexOf(config.quality);
      render(ctx, state.current, level, art.current!, camera.current, { ...config, reducedMotion: config.reducedMotion || systemMotion.matches }, viewWidth, q, dt);
    };
    const frame = (now: number) => {
      if (ended || document.hidden) return;
      if (!last) last = now; const rawDt = (now - last) / 1000; last = now;
      governor.current.sample(rawDt, saved.current.settings.quality === "auto"); accumulator = Math.min(FIXED_STEP * 8, accumulator + rawDt);
      controls.current.pollGamepad();
      if (controls.current.consumePause()) { pause(); return; }
      if (controls.current.consumeCycle()) { const available = saved.current.powers.filter(p => ["focus", "shield", "strength", "hope"].includes(p)); if (available.length) selectPower(available[(available.indexOf(selectedRef.current) + 1) % available.length]); }
      while (accumulator >= FIXED_STEP && state.current.status === "playing") {
        step(state.current, level, controls.current.input(selectedRef.current)); accumulator -= FIXED_STEP;
        for (const event of state.current.events) { audio.current.event(event); if (event.text) { setToast(event.text); toastUntil.current = now + (event.kind === "lore" ? 6000 : 3000); } if (event.kind === "hit" && saved.current.settings.vibration) navigator.vibrate?.(30); }
      }
      const s = state.current;
      audio.current.tick(level.world, s.health <= 1 ? "low" : s.boss?.active ? "boss" : "explore", s.focus > 0, saved.current.settings);
      if (now - lastHud > 120) { refreshHud(); lastHud = now; if (now > toastUntil.current) setToast(""); }
      if (s.status === "won") {
        if (victoryAt === null) { victoryAt = now; persist(completeLevel(saved.current, level.id, snapshot(s))); refreshHud(); controls.current.clear(); }
        if (s.boss) s.boss.animationTime += Math.min(.1, rawDt);
        if (!s.boss || saved.current.settings.reducedMotion || systemMotion.matches || now - victoryAt >= 850) {
          ended = true; moveTo(level.id === FINAL_LEVEL_ID ? "ending" : "reflection");
        }
      }
      else {
        if ((s.revision !== revision.current && now - lastSave > 250) || now - lastSave > 2000) { storeAttempt("play"); revision.current = s.revision; lastSave = now; }
        if (s.status === "dead") {
          persist(recordFailure(saved.current, dayNumber));
          active.current = false;
          ended = true;
          moveTo("dead");
        }
      }
      draw(Math.min(.1, rawDt || 1 / 60)); if (!ended) raf = requestAnimationFrame(frame);
    };
    const redraw = () => { bounds = viewport.current!.getBoundingClientRect(); draw(); };
    const observer = new ResizeObserver(redraw); observer.observe(viewport.current!);
    const images = artImages(art.current);
    images.forEach(image => image.addEventListener("load", redraw)); draw();
    if (phase === "play") raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); images.forEach(image => image.removeEventListener("load", redraw)); };
  }, [phase, level, character, dayNumber, refreshHud, persist, moveTo, storeAttempt, selectPower, pause]);

  const world = WORLDS[level.world]; const mapWorld = WORLDS[worldIndex];
  const wisdom = WISDOM[level.world === 5 ? 3 : level.world]; const reward = world.reward;
  const available = save.powers.filter(p => ["focus", "shield", "strength", "hope"].includes(p));
  const totalCoins = Object.values(save.collectibles).reduce((n, ids) => n + ids.length, 0); const totalLore = Object.values(save.lore).reduce((n, ids) => n + ids.length, 0);
  const lockedByPenalty = penaltyActive(save, dayNumber);
  const penaltyDays = save.penaltyUntilDay === null ? 0 : Math.max(0, save.penaltyUntilDay - dayNumber);
  const heroName = CHARACTERS.find(c => c.id === character)!.name;
  const nextLevel = levelIdsForWorld(worldIndex).find(id => !save.completed.includes(id)) ?? firstLevelForWorld(worldIndex);
  const continueReflection = () => { if (level.boss && reward && levelId !== FINAL_LEVEL_ID) { storeAttempt("reward", 0); moveTo("reward"); } else finishMoment(); };

  return <div ref={root} className="story-mode panda-adventure" role="dialog" aria-modal="true" aria-label="Panda Story Mode: Find the path again" style={{ "--adventure-ui": settings.uiScale, "--world-accent": (phase === "map" ? mapWorld : world).color } as React.CSSProperties}>
    {phase === "map" ? <div className="adventure-map">
      <header className="adventure-map-top"><button className="story-text-button" onClick={onClose}><ArrowLeft size={16} aria-hidden="true" />Forest</button><span className="story-eyebrow">PANDA / STORY MODE</span><button className="story-text-button adventure-icon-button" onClick={openSettings} aria-label="Settings" title="Settings"><SettingsIcon size={19} /></button></header>
      <div className="adventure-map-hero"><div><p className="story-eyebrow">{heroName.toUpperCase()}'S JOURNEY</p><h1>Story Mode</h1><p>Find the path again.</p>
        {save.lastLevel !== null && save.attempts[save.lastLevel] && <button className="story-button adventure-resume" data-story-primary onClick={() => begin(save.lastLevel!)}>Continue your journey →<small><span>{makeLevel(save.lastLevel).title}</span><span>{save.attempts[save.lastLevel].checkpoint > 0 ? `Lantern ${save.attempts[save.lastLevel].checkpoint}` : "The first steps"}</span></small></button>}
        {(save.lastLevel === null || !save.attempts[save.lastLevel]) && <button className="story-button adventure-resume" data-story-primary disabled={!canPlay(save, nextLevel, dayNumber)} onClick={() => begin(nextLevel)}>Enter the trail →<small><span>{mapWorld.name}</span><span>Level {nextLevel % LEVELS_PER_WORLD + 1}</span></small></button>}
        <div className="adventure-totals"><span><b>{save.bosses.length}/{WORLDS.length}</b> worlds healed</span><span><b>{totalCoins}</b> coins</span><span><b>{totalLore}</b> memories</span></div>
      </div><div className="adventure-map-panda"><img src={CHARACTER_SPRITE[character]} alt={`${heroName}, ready for the trail`} /><span>{save.bosses.length === WORLDS.length ? "THE PATH IS YOURS" : lockedByPenalty ? "REST, THEN RETURN" : "ONE STEP AT A TIME"}</span></div></div>
      <nav className="adventure-world-path" aria-label="Worlds">{WORLDS.map((w, i) => {
        const sequenceLocked = i > 0 && !save.completed.includes(firstLevelForWorld(i) - 1);
        return <button key={w.name} className={`${worldIndex === i ? "selected" : ""} ${save.bosses.includes(i) ? "healed" : ""}`} disabled={sequenceLocked || lockedByPenalty} onClick={() => setWorldIndex(i)} style={{ "--node-color": w.color } as React.CSSProperties}><span>{save.bosses.includes(i) ? "✦" : `0${i + 1}`}</span><b>{w.emotion}</b>{sequenceLocked && <small>Clear World {i}</small>}{lockedByPenalty && !sequenceLocked && <small>Day {save.penaltyUntilDay}</small>}</button>;
      })}</nav>
      <section className="adventure-world-detail"><div className="adventure-world-heading"><div><p className="story-eyebrow">WORLD {worldIndex + 1} / {mapWorld.emotion}</p><h2>{mapWorld.name}</h2><p>“{mapWorld.motto}”</p></div><button className="story-text-button adventure-icon-button" onClick={() => setJournal(!journal)} aria-expanded={journal} aria-label={journal ? "Close journal" : "Powers & memories"} title={journal ? "Close journal" : "Powers & memories"}><BookOpen size={19} /></button></div>
        <div className="adventure-guardian"><AdventureBoss world={worldIndex} reducedMotion={settings.reducedMotion} /><div><p className="story-eyebrow">WORLD GUARDIAN</p><h3>{mapWorld.boss}</h3><p>{save.bosses.includes(worldIndex) ? "Defeated" : "Waiting at the end of the trail"}</p>{mapWorld.reward && <span>{POWERS[mapWorld.reward].name}</span>}</div><progress value={levelIdsForWorld(worldIndex).filter(id => save.completed.includes(id)).length} max={LEVELS_PER_WORLD} aria-label="World progress" /></div>
        {lockedByPenalty && <div className="adventure-penalty" role="status"><b>Story penalty active</b><span>Try again on Day {save.penaltyUntilDay}. {penaltyDays} day{penaltyDays === 1 ? "" : "s"} left.</span></div>}
        {journal && <div className="adventure-journal"><h3>What you've learned</h3><div className="adventure-power-grid">{Object.entries(POWERS).map(([id, p]) => <div key={id} className={save.powers.includes(id as Power) ? "earned" : "locked"}><b>{p.icon} {p.name}</b><p>{save.powers.includes(id as Power) ? p.help : p.meaning}</p></div>)}</div><p>Memories unlock Extended Dash (2), Air Dash (4), Reflect (6), and Wall Jump (8). Return to earlier paths with new powers.</p>{Object.entries(save.lore).flatMap(([id, ids]) => makeLevel(Number(id)).things.filter(t => ids.includes(t.id)).map(t => <blockquote key={`${id}-${t.id}`}>{t.text}</blockquote>))}</div>}
        <div className="adventure-levels">
          {levelIdsForWorld(worldIndex).map((id) => {
            const chapter = makeLevel(id); const attempt = save.attempts[id]; const done = save.completed.includes(id);
            const playable = canPlay(save, id, dayNumber);
            const coinsDone = save.collectibles[id]?.length ?? 0;
            const coinsTotal = chapter.things.filter(t => t.kind === "coin").length;
            return <div className={`adventure-level ${done ? "finished" : ""}`} key={id}>
              <span className="story-eyebrow">{chapter.boss ? "LEVEL 15 / BOSS" : `LEVEL ${chapter.stage + 1}`}</span>
              <h3>{chapter.title}</h3>
              <p>{chapter.boss ? `Face ${mapWorld.boss}. Clear it to open the next world.` : "Clear this stretch to unlock the next level in the world."}</p>
              {done && <small>{coinsDone}/{coinsTotal} coins · Best {Math.round(save.bestTimes[id] ?? 0)}s</small>}
              <button className="story-button" data-story-primary={save.lastLevel === null && playable && !done ? "" : undefined} disabled={!playable} onClick={() => begin(id)}>{attempt ? `Resume ${attempt.checkpoint ? "checkpoint" : "journey"} →` : done ? "Walk this path again →" : playable ? "Begin →" : lockedByPenalty ? `Locked until Day ${save.penaltyUntilDay}` : id > 0 ? "Clear the previous level" : "Begin →"}</button>
            </div>;
          })}
        </div>
      </section><p className="story-footnote">Lanterns, powers, memories and settings save on this device. Your habit challenge has its own path.</p>
    </div> : phase === "settings" ? <AdventureSettings settings={settings} onChange={next => persist({ ...saved.current, settings: next })} onClose={() => moveTo(previousPhase.current)} />
      : ["intro", "reflection", "reward", "ending"].includes(phase) ? <div className={`adventure-story-moment moment-${phase}`}>
        <header className="adventure-map-top"><button className="story-text-button" onClick={leaveLevel}><ArrowLeft size={16} aria-hidden="true" />World map</button><span className="story-eyebrow">{world.emotion} / {level.title}</span>{phase === "intro" && <button className="story-text-button" onClick={play}>Skip to trail →</button>}</header>
        <AdventureCinema character={character} world={phase === "ending" ? 0 : level.world} mood={phase === "intro" ? "intro" : phase === "reward" ? "power" : "peace"} endingPage={phase === "ending" ? page : undefined} reducedMotion={settings.reducedMotion} />
        <div className="adventure-dialogue">{phase === "intro" ? <><p className="story-eyebrow">PANDA / {page + 1} OF {world.intro.length}</p><h2>{world.motto}</h2><p className="adventure-spoken" aria-live="polite">{world.intro[page]}</p><p className="adventure-mechanic">{world.mechanic}</p><button className="story-button" data-story-primary onClick={() => { if (page + 1 < world.intro.length) { storeAttempt("intro", page + 1); moveTo("intro", page + 1); } else play(); }}>{page + 1 < world.intro.length ? "I'm with you →" : "Take the first step →"}</button></>
          : phase === "reflection" ? <><p className="story-eyebrow">A QUIET MOMENT / BHAGAVAD GITA {wisdom.verse}</p><blockquote className="adventure-verse">“{wisdom.quote}”</blockquote><a className="adventure-source" href={wisdomUrl(wisdom.verse)} target="_blank" rel="noreferrer">Translation excerpt · Swami Mukundananda · Read the full verse ↗</a><p className="story-eyebrow adventure-panda-label">PANDA'S REFLECTION</p><p className="adventure-spoken">{world.reflection[level.stage % world.reflection.length]}</p><p className="story-footnote">{hud.coins} coins · {Math.round(state.current.elapsed)}s</p><button className="story-button" data-story-primary onClick={continueReflection}>Keep walking →</button></>
          : phase === "reward" && reward ? <><p className="story-eyebrow">YOU EARNED THIS</p><h2>{POWERS[reward].icon} {POWERS[reward].name}</h2><p className="adventure-spoken">{POWERS[reward].meaning}</p><p className="adventure-mechanic">{POWERS[reward].help}</p><button className="story-button" data-story-primary onClick={finishMoment}>A new way forward →</button></>
          : <><p className="story-eyebrow">BACK ON THE ORIGINAL TRAIL</p><h2>{page === 3 ? "The journey doesn't end here." : "A little light returns."}</h2>{page !== 3 && <p className="adventure-spoken" aria-live="polite">{ENDING[page]}</p>}<button className="story-button" data-story-primary onClick={() => { if (page < 3) { storeAttempt("ending", page + 1); moveTo("ending", page + 1); } else { storeAttempt("reflection", 0); moveTo("reflection"); } }}>{page < 3 ? "…" : "Walk forward →"}</button></>}</div>
      </div> : <div className="adventure-play">
        <header className="adventure-hud"><div className="adventure-health" aria-label={`${hud.health} of 5 health`}>{"♥".repeat(Math.max(0, hud.health))}<span>{"♡".repeat(Math.max(0, 5 - hud.health))}</span><small>{world.name} · {level.stage + 1}/{LEVELS_PER_WORLD}</small></div><div className="adventure-hud-right"><b className="coin-readout"><CoinIcon size={18} /> {hud.coins}</b>{document.fullscreenEnabled && <button className="story-text-button adventure-icon-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"}>{fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button>}<button className="story-text-button adventure-icon-button" onClick={openSettings} aria-label="Settings" title="Settings" disabled={phase === "loading"}><SettingsIcon size={19} /></button><button className="story-text-button adventure-icon-button" onClick={phase === "play" ? pause : play} disabled={phase === "dead" || phase === "loading"} aria-label={phase === "play" ? "Pause" : "Resume"} title={phase === "play" ? "Pause" : "Resume"}>{phase === "play" ? <Pause size={19} /> : <Play size={19} />}</button></div></header>
        <div className="adventure-objective"><span>{level.title}</span><progress value={hud.progress} max={100} aria-label="Trail progress" /><small>{Math.floor(hud.elapsed / 60)}:{String(Math.floor(hud.elapsed % 60)).padStart(2, "0")}</small></div>
        <div className="adventure-viewport" ref={viewport}><canvas ref={canvas} className="adventure-canvas" tabIndex={0} aria-label={`${heroName}'s adventure. Move, jump and smash. Escape pauses. Control bindings are available in Settings.`} onPointerDown={e => { if (phase !== "play" || e.pointerType === "touch") return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); controls.current.press(e.button === 2 ? "ability" : "attack", "keyboard", "mouse"); }} onPointerUp={e => controls.current.release(e.button === 2 ? "ability" : "attack", "mouse")} onPointerCancel={() => { controls.current.release("attack", "mouse"); controls.current.release("ability", "mouse"); }} onLostPointerCapture={() => { controls.current.release("attack", "mouse"); controls.current.release("ability", "mouse"); }} onContextMenu={e => e.preventDefault()} />
          {phase === "loading" && <div className="adventure-overlay"><div className="adventure-pause" role="status"><img className="adventure-loading-character" src={CHARACTER_SPRITE[character]} alt="" /><h2>{assetError ? "Trail unavailable" : "Entering the trail"}</h2>{assetError ? <><p>Some artwork could not load. Check your connection and try again.</p><button className="story-button" data-story-primary onClick={() => { setAssetError(false); setLoadAttempt(n => n + 1); }}>Retry</button></> : <progress aria-label="Loading trail artwork" />}<button className="story-text-button" onClick={leaveLevel}>World map</button></div></div>}
          {hud.bossHp > 0 && <div className="adventure-boss-bar"><div><span>{world.boss}</span><small>Phase {hud.bossPhase}</small></div><progress max={hud.bossMax} value={hud.bossHp} aria-label={`${world.boss} health`} /></div>}
          {toast && phase === "play" && <div className="adventure-toast" role="status">{toast}</div>}
          {(phase === "paused" || phase === "dead") && <div className="adventure-overlay"><div className="adventure-pause"><p className="story-eyebrow">{phase === "dead" ? "7-DAY PENALTY" : "REST IS PART OF THE JOURNEY"}</p><h2>{phase === "dead" ? "The path will wait." : "Take a breath."}</h2><p>{phase === "dead" ? `${state.current.reason} Story Mode reopens on Day ${save.penaltyUntilDay}.` : "Your progress is saved at the last lantern. Continue when you're ready."}</p>{phase === "paused" && <button className="story-button" data-story-primary onClick={play}>I'm ready →</button>}{phase === "paused" && <button className="story-text-button" onClick={retry}>Retry from lantern {state.current.checkpoint}</button>}<button className="story-text-button" onClick={leaveLevel}>World map</button></div></div>}
        </div>
        <div className="adventure-power-strip">{available.length > 0 && <label>Power<select aria-label="Current power" value={selected} onChange={e => selectPower(e.target.value as Power)}>{available.map(p => <option key={p} value={p}>{POWERS[p].name}</option>)}</select></label>}<div className="adventure-meters">{save.powers.includes("momentum") && <label>Momentum<progress max="100" value={hud.momentum} /></label>}{save.powers.includes("strength") && <label>Resolve<progress max="100" value={hud.resolve} /></label>}{available.length > 0 && <small>{hud.cooldown > 0 ? `${hud.cooldown.toFixed(1)}s` : (selected === "strength" || selected === "hope") && hud.resolve < 60 ? "Need 60 resolve" : "Ready"}</small>}</div></div>
        <AdventureTouch controls={controls.current} settings={settings} disabled={phase !== "play"} dash={save.powers.includes("dash")} ability={available.length > 0} />
      </div>}
    {saveError && <div className="adventure-save-error" role="alert">This browser couldn't save your progress. Keep this page open and allow local storage to save your journey.</div>}
  </div>;
}
