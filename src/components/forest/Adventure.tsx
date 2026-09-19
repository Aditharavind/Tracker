import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Maximize, Minimize, Pause, Play, Settings as SettingsIcon } from "lucide-react";
import { CHARACTERS, CHARACTER_SPRITE, type CharacterId } from "../../game/characters";
import { FINAL_LEVEL_ID, LEVELS_PER_WORLD, POWERS, WISDOM, WORLDS, makeLevel, wisdomUrl, type Power } from "../../game/adventure/content";
import { createState, FIXED_STEP, HEIGHT, snapshot, step, WIDTH } from "../../game/adventure/engine";
import { Controls, PerformanceGovernor, type InputMethod } from "../../game/adventure/controls";
import { nextGuideStep, type GuideStep } from "../../game/adventure/guide";
import { nextWorldForTrail } from "../../game/adventure/trail";
import { canPlay, completeLevel, emptySave, parseSave, recordAttempt, recordFailure, saveKey, type Attempt, type Save } from "../../game/adventure/save";
import { artImages, loadArt, newCamera, prepareArt, render } from "../../game/adventure/render";
import { viewportSize } from "../../game/adventure/viewport";
import { AdventureAudio } from "../../game/adventure/audio";
import AdventureSettings from "./AdventureSettings";
import AdventureTouch from "./AdventureTouch";
import AdventureCinema from "./AdventureCinema";
import AdventureTrail from "./AdventureTrail";
import AdventureGuide from "./AdventureGuide";
import AdventurePuzzle from "./AdventurePuzzle";
import WorldTransition from "./WorldTransition";
import { CoinIcon } from "./Coin";
import "../../adventure.css";

type Phase = "map" | "collection" | "puzzle" | "intro" | "loading" | "play" | "paused" | "dead" | "reflection" | "reward" | "ending" | "settings";
const asScene = (phase: Phase): Attempt["scene"] => ["intro", "puzzle", "reflection", "reward", "ending"].includes(phase) ? phase as Attempt["scene"] : "play";
const ENDING = ["The old shadow loosens its grip. It fades into the trees. For a moment, there is only silence.", "Sunlight returns to the original trail. Same forest. Same panda. A different way of seeing.", "I thought I had to become someone else. You helped me find my way back to myself.", "The journey doesn't end here."];

export default function Adventure({ character, userId, dayNumber, initialWorld, unlockedWorlds = WORLDS.length, onClose }: { character: CharacterId; userId: number | null; dayNumber: number; initialWorld?: number; unlockedWorlds?: number; onClose: () => void }) {
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
  const [worldIndex, setWorldIndex] = useState(Math.max(0, Math.min(unlockedWorlds - 1, initialWorld ?? Math.floor(Math.min(levelId, FINAL_LEVEL_ID) / LEVELS_PER_WORLD))));
  const [travel, setTravel] = useState<{ fromWorld: number; toWorld: number } | null>(null);
  const level = useMemo(() => makeLevel(levelId), [levelId]);
  const levelLength = useRef(level.length);
  const [initialState] = useState(() => createState(level, save));
  const state = useRef(initialState);
  const [guideStep, setGuideStep] = useState<GuideStep | null>(initial.save.completed.length === 0 ? 0 : null);
  const guideRef = useRef(guideStep);
  const guideOrigin = useRef(initialState.x);
  const [inputMethod, setInputMethod] = useState<InputMethod>(() => matchMedia("(any-pointer: coarse)").matches ? "touch" : "keyboard");
  const controls = useRef(new Controls()); const audio = useRef(new AdventureAudio());
  const [selected, setSelected] = useState<Power>(save.powers.find(p => ["focus", "shield", "strength", "hope"].includes(p)) ?? "focus"); const selectedRef = useRef(selected);
  const [hud, setHud] = useState({ health: 5, coins: 0, checkpoint: 0, resolve: 0, momentum: 0, cooldown: 0, bossHp: 0, bossMax: 0, bossPhase: 1, progress: 0, elapsed: 0 });
  const [assetError, setAssetError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState(""); const toastUntil = useRef(0);
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
    if (!scene && ["map", "collection", "settings"].includes(phaseRef.current)) return;
    return persist(recordAttempt(saved.current, idRef.current, snapshot(state.current, scene ?? asScene(phaseRef.current), nextPage ?? pageRef.current)));
  }, [persist]);
  const refreshHud = useCallback(() => {
    const s = state.current; setHud({ health: s.health, coins: s.coins.size, checkpoint: s.checkpoint, resolve: s.resolve, momentum: s.rush > 0 ? 100 : s.momentum, cooldown: s.abilityCooldown, bossHp: s.boss?.active ? s.boss.hp : 0, bossMax: s.boss?.maxHp ?? 0, bossPhase: s.boss?.phase ?? 1, progress: Math.min(100, s.x / levelLength.current * 100), elapsed: s.elapsed });
    setInputMethod(controls.current.method);
  }, []);
  const hideGuide = () => { guideRef.current = null; setGuideStep(null); canvas.current?.focus({ preventScroll: true }); };
  const showGuide = () => { guideOrigin.current = state.current.x; guideRef.current = 0; setGuideStep(0); canvas.current?.focus({ preventScroll: true }); };
  const selectPower = useCallback((power: Power) => { selectedRef.current = power; setSelected(power); }, []);
  const pause = useCallback(() => {
    if (phaseRef.current !== "play") return;
    // A blur during the boss's defeat animation must still show the earned
    // piece, rather than treating the already-saved win as another replay.
    if (state.current.status === "won") {
      moveTo(saved.current.attempts[idRef.current]?.scene ?? "reflection");
      return;
    }
    storeAttempt("play"); moveTo("paused");
  }, [moveTo, storeAttempt]);
  const leaveLevel = () => { storeAttempt(); moveTo("map"); };
  const begin = (id: number, fresh = false) => {
    if (!canPlay(saved.current, id, dayNumber, unlockedWorlds)) return;
    const nextLevel = makeLevel(id); const attempt = fresh ? undefined : saved.current.attempts[id];
    levelLength.current = nextLevel.length;
    idRef.current = id; setLevelId(id); setWorldIndex(nextLevel.world); state.current = createState(nextLevel, saved.current, attempt);
    guideOrigin.current = state.current.x;
    if (id !== 0) { guideRef.current = null; setGuideStep(null); }
    if (matchMedia("(any-pointer: coarse)").matches) controls.current.method = "touch";
    active.current = true; revision.current = state.current.revision; camera.current = { x: Math.max(0, state.current.x - 200), zoom: 1 }; refreshHud();
    const nextPhase = attempt?.scene ?? (nextLevel.stage === 0 || nextLevel.boss ? "intro" : "play"); storeAttempt(nextPhase, attempt?.page ?? 0);
    moveTo(nextPhase === "play" ? attempt ? "paused" : "loading" : nextPhase, attempt?.page ?? 0);
  };
  const play = () => {
    setAssetError(false); storeAttempt("play", 0); moveTo("loading");
    // Unlock audio within the user's gesture, including on mobile Safari.
    void audio.current.start();
  };
  const retry = () => {
    state.current = createState(level, saved.current, snapshot(state.current));
    active.current = true;
    revision.current = state.current.revision;
    guideOrigin.current = state.current.x;
    camera.current = { x: Math.max(0, state.current.x - 200), zoom: 1 };
    refreshHud(); play();
  };
  const finishMoment = () => {
    const finishedId = idRef.current;
    const attempts = { ...saved.current.attempts }; delete attempts[finishedId];
    persist({ ...saved.current, attempts, lastLevel: null }); active.current = false;
    // Stay in the completed world so the player can discover and enter its exit.
    setWorldIndex(Math.floor(finishedId / LEVELS_PER_WORLD)); moveTo("map");
  };
  const enterNextWorld = () => {
    const toWorld = nextWorldForTrail(saved.current, worldIndex, unlockedWorlds);
    if (toWorld !== null) setTravel({ fromWorld: worldIndex, toWorld });
  };
  const changeWorld = (toWorld: number) => {
    if (!canPlay(saved.current, toWorld * LEVELS_PER_WORLD, dayNumber, unlockedWorlds)) return;
    if (toWorld === nextWorldForTrail(saved.current, worldIndex, unlockedWorlds)) enterNextWorld();
    else setWorldIndex(toWorld);
  };
  const openSettings = () => {
    storeAttempt();
    previousPhase.current = phaseRef.current === "play"
      ? state.current.status === "won" ? saved.current.attempts[idRef.current]?.scene ?? "reflection" : "paused"
      : phaseRef.current;
    moveTo("settings");
  };

  useEffect(() => {
    if (phase !== "loading" && phase !== "intro") return;
    const current = loadArt(level.world, character);
    art.current = current; artWorld.current = level.world;
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

  useEffect(() => { if (phase === "play") canvas.current?.focus({ preventScroll: true }); else root.current?.querySelector<HTMLButtonElement>("[data-story-primary]")?.focus({ preventScroll: true }); }, [phase, page, worldIndex]);
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
        const attackSerial = state.current.attackSerial;
        step(state.current, level, controls.current.input(selectedRef.current)); accumulator -= FIXED_STEP;
        if (guideRef.current !== null && state.current.status === "playing") {
          const next = nextGuideStep(guideRef.current, {
            moved: Math.abs(state.current.x - guideOrigin.current) >= 45,
            jumped: state.current.events.some(event => event.kind === "jump"),
            attacked: state.current.attackSerial > attackSerial,
            collected: state.current.events.some(event => event.kind === "coin"),
          });
          if (next !== guideRef.current) { guideRef.current = next; setGuideStep(next); }
        }
        for (const event of state.current.events) { audio.current.event(event); if (event.text) { setToast(event.text); toastUntil.current = now + (event.kind === "lore" ? 6000 : 3000); } if (event.kind === "hit" && saved.current.settings.vibration) navigator.vibrate?.(30); }
      }
      const s = state.current;
      audio.current.tick(level.world, s.health <= 1 ? "low" : s.boss?.active ? "boss" : "explore", s.focus > 0, saved.current.settings);
      if (now - lastHud > 120) { refreshHud(); lastHud = now; if (now > toastUntil.current) setToast(""); }
      if (s.status === "won") {
        if (victoryAt === null) { victoryAt = now; persist(completeLevel(saved.current, level.id, snapshot(s))); refreshHud(); controls.current.clear(); }
        if (s.boss) s.boss.animationTime += Math.min(.1, rawDt);
        if (!s.boss || saved.current.settings.reducedMotion || systemMotion.matches || now - victoryAt >= 850) {
          ended = true; moveTo(saved.current.attempts[level.id]?.scene ?? "reflection");
        }
      }
      else {
        if ((s.revision !== revision.current && now - lastSave > 250) || now - lastSave > 2000) { storeAttempt("play"); revision.current = s.revision; lastSave = now; }
        if (s.status === "dead") {
          persist(recordFailure(recordAttempt(saved.current, level.id, snapshot(s)), dayNumber));
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
  const heroName = CHARACTERS.find(c => c.id === character)!.name;
  const viewingMap = phase === "map" || phase === "collection" || (phase === "settings" && previousPhase.current === "map");
  const continuePuzzle = () => {
    const next = levelId === FINAL_LEVEL_ID ? "ending" : "reflection";
    storeAttempt(next, 0); moveTo(next);
  };
  const continueReflection = () => { if (level.boss && reward && levelId !== FINAL_LEVEL_ID) { storeAttempt("reward", 0); moveTo("reward"); } else finishMoment(); };

  return <div ref={root} className="story-mode panda-adventure world-theme" data-world={viewingMap ? worldIndex : level.world} role="dialog" aria-modal="true" aria-label="Panda Story Mode: Find the path again" style={{ "--adventure-ui": settings.uiScale, "--world-accent": (viewingMap ? mapWorld : world).color } as React.CSSProperties}>
    {travel && <WorldTransition fromWorld={travel.fromWorld} toWorld={travel.toWorld} character={character} reducedMotion={settings.reducedMotion} onComplete={() => { setWorldIndex(travel.toWorld); setTravel(null); moveTo("map"); }} />}
    {phase === "map" ? <AdventureTrail character={character} save={save} worldIndex={worldIndex} dayNumber={dayNumber} unlockedWorlds={unlockedWorlds} onWorldChange={changeWorld} onEnterNextWorld={enterNextWorld} onBegin={begin} onClose={onClose} onSettings={openSettings} onOpenPuzzle={() => moveTo("collection")} /> : phase === "settings" ? <AdventureSettings settings={settings} onChange={next => persist({ ...saved.current, settings: next })} onClose={() => moveTo(previousPhase.current)} />
      : phase === "collection" || phase === "puzzle" ? <AdventurePuzzle key={`${phase}-${phase === "collection" ? worldIndex : levelId}`} save={save} worldIndex={phase === "collection" ? worldIndex : level.world} earnedLevelId={phase === "puzzle" ? levelId : undefined} onClose={phase === "puzzle" ? continuePuzzle : () => moveTo("map")} />
      : ["intro", "reflection", "reward", "ending"].includes(phase) ? <div className={`adventure-story-moment moment-${phase}`}>
        <header className="adventure-map-top"><button className="story-text-button" onClick={leaveLevel}><ArrowLeft size={16} aria-hidden="true" />World map</button><span className="story-eyebrow">{world.emotion} / {level.title}</span>{phase === "intro" && <button className="story-text-button" onClick={play}>Skip to trail →</button>}</header>
        <AdventureCinema character={character} world={phase === "ending" ? 0 : level.world} mood={phase === "intro" ? "intro" : phase === "reward" ? "power" : "peace"} endingPage={phase === "ending" ? page : undefined} reducedMotion={settings.reducedMotion} />
        <div className="adventure-dialogue">{phase === "intro" ? <><p className="story-eyebrow">PANDA / {page + 1} OF {world.intro.length}</p><h2>{world.motto}</h2><p className="adventure-spoken" aria-live="polite">{world.intro[page]}</p><p className="adventure-mechanic">{world.mechanic}</p><button className="story-button" data-story-primary onClick={() => { if (page + 1 < world.intro.length) { storeAttempt("intro", page + 1); moveTo("intro", page + 1); } else play(); }}>{page + 1 < world.intro.length ? "I'm with you →" : "Take the first step →"}</button></>
          : phase === "reflection" ? <><p className="story-eyebrow">A QUIET MOMENT / BHAGAVAD GITA {wisdom.verse}</p><blockquote className="adventure-verse">“{wisdom.quote}”</blockquote><a className="adventure-source" href={wisdomUrl(wisdom.verse)} target="_blank" rel="noreferrer">Translation excerpt · Swami Mukundananda · Read the full verse ↗</a><p className="story-eyebrow adventure-panda-label">PANDA'S REFLECTION</p><p className="adventure-spoken">{world.reflection[level.stage % world.reflection.length]}</p><p className="story-footnote">{hud.coins} coins · {Math.round(state.current.elapsed)}s</p><button className="story-button" data-story-primary onClick={continueReflection}>Keep walking →</button></>
          : phase === "reward" && reward ? <><p className="story-eyebrow">YOU EARNED THIS</p><h2>{POWERS[reward].icon} {POWERS[reward].name}</h2><p className="adventure-spoken">{POWERS[reward].meaning}</p><p className="adventure-mechanic">{POWERS[reward].help}</p><button className="story-button" data-story-primary onClick={finishMoment}>A new way forward →</button></>
          : <><p className="story-eyebrow">BACK ON THE ORIGINAL TRAIL</p><h2>{page === 3 ? "The journey doesn't end here." : "A little light returns."}</h2>{page !== 3 && <p className="adventure-spoken" aria-live="polite">{ENDING[page]}</p>}<button className="story-button" data-story-primary onClick={() => { if (page < 3) { storeAttempt("ending", page + 1); moveTo("ending", page + 1); } else { storeAttempt("reflection", 0); moveTo("reflection"); } }}>{page < 3 ? "…" : "Walk forward →"}</button></>}</div>
      </div> : <div className="adventure-play">
        <header className="adventure-hud"><div className="adventure-health" aria-label={`${hud.health} of 5 health`}>{"♥".repeat(Math.max(0, hud.health))}<span>{"♡".repeat(Math.max(0, 5 - hud.health))}</span><small>{world.name} · {level.stage + 1}/{LEVELS_PER_WORLD}</small></div><div className="adventure-hud-right"><b className="coin-readout"><CoinIcon size={18} /> {hud.coins}</b>{document.fullscreenEnabled && <button className="story-text-button adventure-icon-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"}>{fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button>}<button className="story-text-button adventure-icon-button" onClick={openSettings} aria-label="Settings" title="Settings" disabled={phase === "loading"}><SettingsIcon size={19} /></button><button className="story-text-button adventure-icon-button" onClick={phase === "play" ? pause : play} disabled={phase === "dead" || phase === "loading"} aria-label={phase === "play" ? "Pause" : "Resume"} title={phase === "play" ? "Pause" : "Resume"}>{phase === "play" ? <Pause size={19} /> : <Play size={19} />}</button></div></header>
        <div className="adventure-objective"><span>{level.boss ? `Face ${world.boss}. Watch for an opening.` : "Find coins. Follow the trail to the glowing gate."}</span><progress value={hud.progress} max={100} aria-label="Trail progress" /><button className="story-text-button adventure-guide-toggle" onClick={showGuide} disabled={phase !== "play"} aria-label="Show play guide" title="Learn the controls">?</button></div>
        <div className="adventure-viewport" ref={viewport}><canvas ref={canvas} className="adventure-canvas" tabIndex={0} aria-label={`${heroName}'s adventure. Move, jump and smash. Escape pauses. Control bindings are available in Settings.`} onPointerDown={e => { if (phase !== "play" || e.pointerType === "touch") return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); controls.current.press(e.button === 2 ? "ability" : "attack", "keyboard", "mouse"); }} onPointerUp={e => controls.current.release(e.button === 2 ? "ability" : "attack", "mouse")} onPointerCancel={() => { controls.current.release("attack", "mouse"); controls.current.release("ability", "mouse"); }} onLostPointerCapture={() => { controls.current.release("attack", "mouse"); controls.current.release("ability", "mouse"); }} onContextMenu={e => e.preventDefault()} />
          {phase === "loading" && <div className="adventure-overlay"><div className="adventure-pause" role="status"><img className="adventure-loading-character" src={CHARACTER_SPRITE[character]} alt="" /><h2>{assetError ? "Trail unavailable" : "Entering the trail"}</h2>{assetError ? <><p>Some artwork could not load. Check your connection and try again.</p><button className="story-button" data-story-primary onClick={() => { setAssetError(false); setLoadAttempt(n => n + 1); }}>Retry</button></> : <progress aria-label="Loading trail artwork" />}<button className="story-text-button" onClick={leaveLevel}>World map</button></div></div>}
          {hud.bossHp > 0 && <div className="adventure-boss-bar"><div><span>{world.boss}</span><small>Phase {hud.bossPhase}</small></div><progress max={hud.bossMax} value={hud.bossHp} aria-label={`${world.boss} health`} /></div>}
          {toast && phase === "play" && <div className="adventure-toast" role="status">{toast}</div>}
          {phase === "play" && guideStep !== null && <AdventureGuide step={guideStep} method={inputMethod} keys={settings.keys} onDismiss={hideGuide} />}
          {(phase === "paused" || phase === "dead") && <div className="adventure-overlay"><div className="adventure-pause">
            <p className="story-eyebrow">{phase === "dead" ? "LET'S TRY THAT AGAIN" : "REST IS PART OF THE JOURNEY"}</p>
            <h2>{phase === "dead" ? "One more hop?" : "Take a breath."}</h2>
            <p>{phase === "dead" ? `Your coins and discoveries are safe. ${state.current.checkpoint > 0 ? "Your last lantern is ready" : "The trail entrance is ready"} whenever you are.` : "Your progress is saved at the last lantern. Continue when you're ready."}</p>
            {phase === "dead" && <p className="adventure-retry-tip">{state.current.reason.includes("lantern") ? "Tip: hold Jump a little longer to cross a wider gap." : "Tip: give yourself a little space and watch before your next move."}</p>}
            <button className="story-button" data-story-primary onClick={phase === "dead" ? retry : play}>{phase === "dead" ? "Try again →" : "I'm ready →"}</button>
            {phase === "paused" && <button className="story-text-button" onClick={retry}>Back to {state.current.checkpoint > 0 ? "my lantern" : "the entrance"}</button>}
            <button className="story-text-button" onClick={() => { showGuide(); if (phase === "dead") retry(); else play(); }}>Practice with hints</button>
            <button className="story-text-button" onClick={leaveLevel}>World map</button>
          </div></div>}
        </div>
        <div className="adventure-power-strip">{available.length > 0 && <label>Power<select aria-label="Current power" value={selected} onChange={e => selectPower(e.target.value as Power)}>{available.map(p => <option key={p} value={p}>{POWERS[p].name}</option>)}</select></label>}<div className="adventure-meters">{save.powers.includes("momentum") && <label>Momentum<progress max="100" value={hud.momentum} /></label>}{save.powers.includes("strength") && <label>Resolve<progress max="100" value={hud.resolve} /></label>}{available.length > 0 && <small>{hud.cooldown > 0 ? `${hud.cooldown.toFixed(1)}s` : (selected === "strength" || selected === "hope") && hud.resolve < 60 ? "Need 60 resolve" : "Ready"}</small>}</div></div>
        <AdventureTouch controls={controls.current} settings={settings} disabled={phase !== "play"} dash={save.powers.includes("dash")} ability={available.length > 0} />
      </div>}
    {saveError && <div className="adventure-save-error" role="alert">This browser couldn't save your progress. Keep this page open and allow local storage to save your journey.</div>}
  </div>;
}
