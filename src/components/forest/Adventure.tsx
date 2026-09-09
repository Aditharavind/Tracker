import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHARACTER_SPRITE, type CharacterId } from "../../game/characters";
import { MAIN_LEVELS, POWERS, WISDOM, WORLDS, makeLevel, storyWorldUnlockDay, wisdomUrl, type Power } from "../../game/adventure/content";
import { createState, HEIGHT, snapshot, step, WIDTH } from "../../game/adventure/engine";
import { Controls, PerformanceGovernor, type InputMethod } from "../../game/adventure/controls";
import { canPlay, completeLevel, emptySave, parseSave, recordAttempt, saveKey, type Attempt, type Save } from "../../game/adventure/save";
import { loadArt, newCamera, render } from "../../game/adventure/render";
import { AdventureAudio } from "../../game/adventure/audio";
import AdventureSettings from "./AdventureSettings";
import AdventureTouch from "./AdventureTouch";
import AdventureCinema from "./AdventureCinema";
import "../../adventure.css";

type Phase = "map" | "intro" | "play" | "paused" | "dead" | "reflection" | "reward" | "ending" | "settings";
const asScene = (phase: Phase): Attempt["scene"] => ["intro", "reflection", "reward", "ending"].includes(phase) ? phase as Attempt["scene"] : "play";
const ENDING = ["The old shadow loosens its grip. It fades into the trees. For a moment, there is only silence.", "Sunlight returns to the original trail. Same forest. Same panda. A different way of seeing.", "I thought I had to become someone else. You helped me find my way back to myself.", "The journey doesn't end here."];

export default function Adventure({ userId, dayNumber, onClose }: { character: CharacterId; userId: number | null; dayNumber: number; onClose: () => void }) {
  const key = saveKey(userId);
  const [initial] = useState(() => { try { return { save: parseSave(localStorage.getItem(key)), failed: false }; } catch { return { save: emptySave(), failed: true }; } });
  const [save, setSave] = useState<Save>(initial.save); const saved = useRef(save);
  const [saveError, setSaveError] = useState(initial.failed);
  const [phase, setPhase] = useState<Phase>("map"); const phaseRef = useRef<Phase>("map");
  const [page, setPage] = useState(0); const pageRef = useRef(0);
  const [levelId, setLevelId] = useState(initial.save.lastLevel ?? 0); const idRef = useRef(levelId);
  const [worldIndex, setWorldIndex] = useState(Math.floor(Math.min(levelId, 23) / 3));
  const level = useMemo(() => makeLevel(levelId), [levelId]);
  const [initialState] = useState(() => createState(level, save));
  const state = useRef(initialState);
  const controls = useRef(new Controls()); const audio = useRef(new AdventureAudio());
  const [selected, setSelected] = useState<Power>(save.powers.find(p => ["focus", "shield", "strength", "hope"].includes(p)) ?? "focus"); const selectedRef = useRef(selected);
  const [inputMethod, setInputMethod] = useState<InputMethod>("keyboard");
  const [hud, setHud] = useState({ health: 5, coins: 0, checkpoint: 0, resolve: 0, momentum: 0, cooldown: 0, bossHp: 0, bossMax: 0, bossPhase: 1, fps: 60 });
  const [toast, setToast] = useState(""); const toastUntil = useRef(0);
  const [journal, setJournal] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null); const root = useRef<HTMLDivElement>(null);
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
  const refreshHud = useCallback((fps = 60) => {
    const s = state.current; setHud({ health: s.health, coins: s.coins.size, checkpoint: s.checkpoint, resolve: s.resolve, momentum: s.rush > 0 ? 100 : s.momentum, cooldown: s.abilityCooldown, bossHp: s.boss?.active ? s.boss.hp : 0, bossMax: s.boss?.maxHp ?? 0, bossPhase: s.boss?.phase ?? 1, fps });
  }, []);
  const selectPower = useCallback((power: Power) => { selectedRef.current = power; setSelected(power); }, []);
  const pause = useCallback(() => { if (phaseRef.current === "play") { storeAttempt("play"); moveTo("paused"); } }, [moveTo, storeAttempt]);
  const leaveLevel = () => { storeAttempt(); moveTo("map"); };
  const begin = (id: number, fresh = false) => {
    if (!canPlay(saved.current, id, dayNumber)) return;
    const nextLevel = makeLevel(id); const attempt = fresh ? undefined : saved.current.attempts[id];
    idRef.current = id; setLevelId(id); setWorldIndex(nextLevel.world); state.current = createState(nextLevel, saved.current, attempt);
    active.current = true; revision.current = state.current.revision; camera.current = { x: Math.max(0, state.current.x - 200), zoom: 1 }; refreshHud();
    const nextPhase = attempt?.scene ?? "intro"; storeAttempt(nextPhase, attempt?.page ?? 0);
    moveTo(nextPhase === "play" ? "paused" : nextPhase, attempt?.page ?? 0);
  };
  const play = () => { storeAttempt("play", 0); moveTo("play"); void audio.current.start(); };
  const retry = () => { state.current = createState(level, saved.current, snapshot(state.current)); revision.current = 0; camera.current = { x: Math.max(0, state.current.x - 200), zoom: 1 }; refreshHud(); play(); };
  const finishMoment = () => {
    const attempts = { ...saved.current.attempts }; delete attempts[idRef.current];
    persist({ ...saved.current, attempts, lastLevel: null }); active.current = false;
    setWorldIndex(Math.min(7, Math.floor(Math.min(23, levelId + 1) / 3))); moveTo("map");
  };
  const openSettings = () => { storeAttempt(); previousPhase.current = phaseRef.current === "play" ? "paused" : phaseRef.current; moveTo("settings"); };

  useEffect(() => { if (phase === "play") canvas.current?.focus({ preventScroll: true }); else root.current?.querySelector<HTMLButtonElement>("[data-story-primary]")?.focus({ preventScroll: true }); }, [phase, page]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (phaseRef.current === "settings") return;
        e.preventDefault();
        if (phaseRef.current === "play") pause();
        else if (phaseRef.current === "map") onClose();
        else if (phaseRef.current === "paused") { moveTo("play"); void audio.current.start(); }
        else { storeAttempt(); moveTo("map"); }
        return;
      }
      if (phaseRef.current !== "play" || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.target instanceof HTMLButtonElement && [" ", "Enter"].includes(e.key)) return;
      const action = controls.current.key(e.key, saved.current.settings);
      if (action) { e.preventDefault(); if (!e.repeat) controls.current.press(action); }
    };
    const onUp = (e: KeyboardEvent) => { const action = controls.current.key(e.key, saved.current.settings); if (action) controls.current.release(action); };
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
      if (controls.current.consumePause()) { moveTo("play"); void audio.current.start(); }
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
    if (!art.current || artWorld.current !== level.world) { art.current = loadArt(level.world); artWorld.current = level.world; }
    let raf = 0; let last = 0; let accumulator = 0; let lastHud = 0; let lastSave = 0; let ended = false; let victoryAt: number | null = null; let viewWidth = WIDTH;
    const systemMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => {
      const config = saved.current.settings;
      viewWidth = window.innerWidth < 650 && window.innerHeight > window.innerWidth ? 580 : Math.min(1280, Math.max(800, window.innerWidth / Math.max(300, window.innerHeight - 150) * HEIGHT));
      const dpr = Math.min(config.performance ? 1 : 2, window.devicePixelRatio || 1) * (config.quality === "auto" ? governor.current.resolution : config.quality === "low" ? .75 : 1);
      const width = Math.round(viewWidth * dpr); const height = Math.round(HEIGHT * dpr);
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
      governor.current.sample(rawDt, saved.current.settings.quality === "auto"); accumulator += Math.min(.1, rawDt);
      controls.current.pollGamepad();
      if (controls.current.consumePause()) { pause(); return; }
      if (controls.current.consumeCycle()) { const available = saved.current.powers.filter(p => ["focus", "shield", "strength", "hope"].includes(p)); if (available.length) selectPower(available[(available.indexOf(selectedRef.current) + 1) % available.length]); }
      while (accumulator >= 1 / 120 && state.current.status === "playing") {
        step(state.current, level, controls.current.input(selectedRef.current)); accumulator -= 1 / 120;
        for (const event of state.current.events) { audio.current.event(event); if (event.text) { setToast(event.text); toastUntil.current = now + (event.kind === "lore" ? 6000 : 3000); } if (event.kind === "hit" && saved.current.settings.vibration) navigator.vibrate?.(30); }
      }
      const s = state.current;
      audio.current.tick(level.world, s.health <= 1 ? "low" : s.boss?.active ? "boss" : "explore", s.focus > 0, saved.current.settings);
      if (now - lastHud > 120) { refreshHud(rawDt > 0 ? Math.min(120, Math.round(1 / rawDt)) : 60); setInputMethod(controls.current.method); lastHud = now; if (now > toastUntil.current) setToast(""); }
      if (s.status === "won") {
        if (victoryAt === null) { victoryAt = now; persist(completeLevel(saved.current, level.id, snapshot(s))); refreshHud(); controls.current.clear(); }
        if (s.boss) s.boss.animationTime += Math.min(.1, rawDt);
        if (!s.boss || saved.current.settings.reducedMotion || systemMotion.matches || now - victoryAt >= 850) {
          ended = true; moveTo(level.id === 23 ? "ending" : "reflection");
        }
      }
      else { if (s.revision !== revision.current || now - lastSave > 2000) { storeAttempt("play"); revision.current = s.revision; lastSave = now; } if (s.status === "dead") { ended = true; moveTo("dead"); } }
      draw(Math.min(.1, rawDt || 1 / 60)); if (!ended) raf = requestAnimationFrame(frame);
    };
    const redraw = () => draw(); window.addEventListener("resize", redraw); Object.values(art.current).forEach(image => image.onload = redraw); draw();
    if (phase === "play") raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", redraw); if (art.current) Object.values(art.current).forEach(image => image.onload = null); };
  }, [phase, level, refreshHud, persist, moveTo, storeAttempt, selectPower, pause]);

  const world = WORLDS[level.world]; const mapWorld = WORLDS[worldIndex];
  const wisdom = WISDOM[level.world === 5 ? 3 : level.world]; const reward = world.reward;
  const available = save.powers.filter(p => ["focus", "shield", "strength", "hope"].includes(p));
  const totalCoins = Object.values(save.collectibles).reduce((n, ids) => n + ids.length, 0); const totalLore = Object.values(save.lore).reduce((n, ids) => n + ids.length, 0);
  const continueReflection = () => { if (level.boss && reward && levelId < MAIN_LEVELS) { storeAttempt("reward", 0); moveTo("reward"); } else finishMoment(); };

  return <div ref={root} className="story-mode panda-adventure" role="dialog" aria-modal="true" aria-label="Panda Story Mode: Find the path again" style={{ "--adventure-ui": settings.uiScale, "--world-accent": (phase === "map" ? mapWorld : world).color } as React.CSSProperties}>
    {phase === "map" ? <div className="adventure-map">
      <header className="adventure-map-top"><button className="story-text-button" onClick={onClose}>← Forest</button><span className="story-eyebrow">PANDA / STORY MODE</span><button className="story-text-button" onClick={openSettings}>Settings</button></header>
      <div className="adventure-map-hero"><div><p className="story-eyebrow">A JOURNEY BACK TO YOURSELF</p><h1>Find the<br /><em>path again.</em></h1><p>Not a different panda.<br />The one you were always becoming.</p>
        {save.lastLevel !== null && save.attempts[save.lastLevel] && <button className="story-button adventure-resume" data-story-primary onClick={() => begin(save.lastLevel!)}>Continue your journey →<small>{makeLevel(save.lastLevel).title} · {save.attempts[save.lastLevel].checkpoint > 0 ? `Lantern ${save.attempts[save.lastLevel].checkpoint}` : "The first steps"}</small></button>}
        <div className="adventure-totals"><span><b>{save.bosses.length}/8</b> worlds healed</span><span><b>{totalCoins}</b> coins</span><span><b>{totalLore}</b> memories</span></div>
      </div><div className="adventure-map-panda"><img src={CHARACTER_SPRITE.panda} alt="A young panda, ready to begin again" /><span>{save.bosses.length === 8 ? "THE PATH IS YOURS" : "ONE STEP AT A TIME"}</span></div></div>
      <nav className="adventure-world-path" aria-label="Worlds">{WORLDS.map((w, i) => {
        const dayLocked = dayNumber < storyWorldUnlockDay(i);
        const sequenceLocked = i > 0 && !save.bosses.includes(i - 1);
        return <button key={w.name} className={`${worldIndex === i ? "selected" : ""} ${save.bosses.includes(i) ? "healed" : ""}`} disabled={sequenceLocked || dayLocked} onClick={() => setWorldIndex(i)} style={{ "--node-color": w.color } as React.CSSProperties}><span>{save.bosses.includes(i) ? "✦" : `0${i + 1}`}</span><b>{w.emotion}</b>{!sequenceLocked && dayLocked && <small>Day {storyWorldUnlockDay(i)}</small>}</button>;
      })}</nav>
      <section className="adventure-world-detail"><div className="adventure-world-heading"><div><p className="story-eyebrow">WORLD {worldIndex + 1} / {mapWorld.emotion}</p><h2>{mapWorld.name}</h2><p>“{mapWorld.motto}”</p></div><button className="story-text-button" onClick={() => setJournal(!journal)}>{journal ? "Close journal" : "Powers & memories"}</button></div>
        {journal && <div className="adventure-journal"><h3>What you've learned</h3><div className="adventure-power-grid">{Object.entries(POWERS).map(([id, p]) => <div key={id} className={save.powers.includes(id as Power) ? "earned" : "locked"}><b>{p.icon} {p.name}</b><p>{save.powers.includes(id as Power) ? p.help : p.meaning}</p></div>)}</div><p>Memories unlock Extended Dash (2), Air Dash (4), Reflect (6), and Wall Jump (8). Return to earlier paths with new powers.</p>{Object.entries(save.lore).flatMap(([id, ids]) => makeLevel(Number(id)).things.filter(t => ids.includes(t.id)).map(t => <blockquote key={`${id}-${t.id}`}>{t.text}</blockquote>))}</div>}
        <div className="adventure-levels">{[0, 1, 2].map(stage => {
          const id = worldIndex * 3 + stage; const chapter = makeLevel(id); const attempt = save.attempts[id]; const done = save.completed.includes(id);
          const playable = canPlay(save, id, dayNumber);
          const dayLocked = !playable && dayNumber < storyWorldUnlockDay(worldIndex);
          return <div className={`adventure-level ${done ? "finished" : ""}`} key={id}><span className="story-eyebrow">{stage === 2 ? "BOSS ENCOUNTER" : `TRAIL ${stage + 1}`}</span><h3>{chapter.title}</h3><p>{stage === 2 ? `Face ${mapWorld.boss}. ${mapWorld.reward ? `Earn ${POWERS[mapWorld.reward].name}.` : "Find the way forward."}` : stage === 0 ? "Learn the trail. Find a small promise worth keeping." : "Put your practice to work. Explore the paths between."}</p>{done && <small>{save.collectibles[id]?.length ?? 0}/{chapter.things.filter(t => t.kind === "coin").length} coins · Best {Math.round(save.bestTimes[id] ?? 0)}s</small>}
            <button className="story-button" data-story-primary={save.lastLevel === null && playable && !done ? "" : undefined} disabled={!playable} onClick={() => begin(id)}>{attempt ? `Resume ${attempt.checkpoint ? "checkpoint" : "journey"} →` : done ? "Walk this path again →" : playable ? "Begin →" : dayLocked ? `Unlocks on Day ${storyWorldUnlockDay(worldIndex)}` : "Complete the previous trail"}</button></div>;
        })}</div>
        {save.completed.includes(23) && <div className="adventure-master"><h3>The journey continues</h3><p>Optional mastery trails · Beat the par time, explore high routes, or face your old self again.</p>{[24, 25, 26].map(id => <button className="story-text-button" key={id} onClick={() => begin(id)}>{makeLevel(id).title} · {makeLevel(id).par}s</button>)}</div>}
      </section><p className="story-footnote">Lanterns, powers, memories and settings save on this device. Your habit challenge has its own path.</p>
    </div> : phase === "settings" ? <AdventureSettings settings={settings} onChange={next => persist({ ...saved.current, settings: next })} onClose={() => moveTo(previousPhase.current)} />
      : ["intro", "reflection", "reward", "ending"].includes(phase) ? <div className={`adventure-story-moment moment-${phase}`}>
        <header className="adventure-map-top"><button className="story-text-button" onClick={leaveLevel}>← World map</button><span className="story-eyebrow">{world.emotion} / {level.title}</span>{phase === "intro" && <button className="story-text-button" onClick={play}>Skip to trail →</button>}</header>
        <AdventureCinema world={phase === "ending" ? 0 : level.world} mood={phase === "intro" ? "intro" : phase === "reward" ? "power" : "peace"} endingPage={phase === "ending" ? page : undefined} reducedMotion={settings.reducedMotion} />
        <div className="adventure-dialogue">{phase === "intro" ? <><p className="story-eyebrow">PANDA / {page + 1} OF {world.intro.length}</p><h2>{world.motto}</h2><p className="adventure-spoken" aria-live="polite">{world.intro[page]}</p><p className="adventure-mechanic">{world.mechanic}</p><button className="story-button" data-story-primary onClick={() => { if (page + 1 < world.intro.length) { storeAttempt("intro", page + 1); moveTo("intro", page + 1); } else play(); }}>{page + 1 < world.intro.length ? "I'm with you →" : "Take the first step →"}</button></>
          : phase === "reflection" ? <><p className="story-eyebrow">A QUIET MOMENT / BHAGAVAD GITA {wisdom.verse}</p><blockquote className="adventure-verse">“{wisdom.quote}”</blockquote><a className="adventure-source" href={wisdomUrl(wisdom.verse)} target="_blank" rel="noreferrer">Translation excerpt · Swami Mukundananda · Read the full verse ↗</a><p className="story-eyebrow adventure-panda-label">PANDA'S REFLECTION</p><p className="adventure-spoken">{world.reflection[level.stage]}</p><p className="story-footnote">{hud.coins} coins · {Math.round(state.current.elapsed)}s {level.mastery && state.current.elapsed <= level.par ? "· Mastery time achieved ✦" : ""}</p><button className="story-button" data-story-primary onClick={continueReflection}>Keep walking →</button></>
          : phase === "reward" && reward ? <><p className="story-eyebrow">YOU EARNED THIS</p><h2>{POWERS[reward].icon} {POWERS[reward].name}</h2><p className="adventure-spoken">{POWERS[reward].meaning}</p><p className="adventure-mechanic">{POWERS[reward].help}</p><button className="story-button" data-story-primary onClick={finishMoment}>A new way forward →</button></>
          : <><p className="story-eyebrow">BACK ON THE ORIGINAL TRAIL</p><h2>{page === 3 ? "The journey doesn't end here." : "A little light returns."}</h2>{page !== 3 && <p className="adventure-spoken" aria-live="polite">{ENDING[page]}</p>}<button className="story-button" data-story-primary onClick={() => { if (page < 3) { storeAttempt("ending", page + 1); moveTo("ending", page + 1); } else { storeAttempt("reflection", 0); moveTo("reflection"); } }}>{page < 3 ? "…" : "Walk forward →"}</button></>}</div>
      </div> : <div className="adventure-play">
        <header className="adventure-hud"><div className="adventure-health" aria-label={`${hud.health} of 5 health`}>{"♥".repeat(Math.max(0, hud.health))}<span>{"♡".repeat(Math.max(0, 5 - hud.health))}</span><small>{world.emotion} · {level.title}</small></div><div className="adventure-hud-right"><b>✦ {hud.coins}</b><button className="story-text-button" onClick={openSettings} aria-label="Settings">⚙</button><button className="story-text-button" onClick={phase === "play" ? pause : play} disabled={phase === "dead"}>{phase === "play" ? "Ⅱ Pause" : "Resume"}</button></div></header>
        <div className="adventure-objective"><span>{levelId === 0 ? `${settings.keys.attack.toUpperCase()} / Smash clears fallen wood · Hold jump for height` : world.motto}</span><small>{inputMethod === "gamepad" ? "A jump · X smash · B dash · Y ability" : inputMethod === "touch" ? "Joystick down to crouch · Hold Jump for height" : `${settings.keys.jump === " " ? "Space" : settings.keys.jump} jump · ${settings.keys.attack.toUpperCase()} smash · ${settings.keys.dash} dash · ${settings.keys.ability.toUpperCase()} ability`}</small></div>
        <div className="adventure-viewport"><canvas ref={canvas} className="adventure-canvas" tabIndex={0} aria-label="Panda adventure. Move, jump and smash. Escape pauses. Control bindings are available in Settings." onPointerDown={e => { if (phase !== "play" || e.pointerType === "touch") return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); controls.current.press(e.button === 2 ? "ability" : "attack"); }} onPointerUp={() => { controls.current.release("attack"); controls.current.release("ability"); }} onLostPointerCapture={() => { controls.current.release("attack"); controls.current.release("ability"); }} onContextMenu={e => e.preventDefault()} />
          {hud.bossHp > 0 && <div className="adventure-boss-bar"><div><span>{world.boss}</span><small>Phase {hud.bossPhase}</small></div><progress max={hud.bossMax} value={hud.bossHp} aria-label={`${world.boss} health`} /></div>}
          {toast && phase === "play" && <div className="adventure-toast" role="status">{toast}</div>}
          {(phase === "paused" || phase === "dead") && <div className="adventure-overlay"><div className="adventure-pause"><p className="story-eyebrow">{phase === "dead" ? "TRY AGAIN" : "REST IS PART OF THE JOURNEY"}</p><h2>{phase === "dead" ? "The path is still here." : "Take a breath."}</h2><p>{phase === "dead" ? state.current.reason : "Your progress is saved at the last lantern. Continue when you're ready."}</p><button className="story-button" data-story-primary onClick={phase === "dead" ? retry : play}>{phase === "dead" ? "Return to the lantern →" : "I'm ready →"}</button>{phase === "paused" && <button className="story-text-button" onClick={retry}>Retry from lantern {state.current.checkpoint}</button>}<button className="story-text-button" onClick={leaveLevel}>World map</button></div></div>}
        </div>
        <div className="adventure-power-strip"><span className="adventure-rotate">Rotate your device for the best adventure.</span>{available.length > 0 && <label>Power<select aria-label="Current power" value={selected} onChange={e => selectPower(e.target.value as Power)}>{available.map(p => <option key={p} value={p}>{POWERS[p].name}</option>)}</select></label>}<div className="adventure-meters">{save.powers.includes("momentum") && <label>Momentum<progress max="100" value={hud.momentum} /></label>}{save.powers.includes("strength") && <label>Resolve<progress max="100" value={hud.resolve} /></label>}{available.length > 0 && <small>{hud.cooldown > 0 ? `${hud.cooldown.toFixed(1)}s` : (selected === "strength" || selected === "hope") && hud.resolve < 60 ? "Need 60 resolve" : "Ready"}</small>}</div></div>
        <AdventureTouch controls={controls.current} settings={settings} disabled={phase !== "play"} dash={save.powers.includes("dash")} ability={available.length > 0} />
      </div>}
    {saveError && <div className="adventure-save-error" role="alert">This browser couldn't save your progress. Keep this page open and allow local storage to save your journey.</div>}
  </div>;
}
