import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, LockKeyhole, LocateFixed, Settings, Skull, X } from "lucide-react";
import { CHARACTERS, type CharacterId } from "../../game/characters";
import { firstLevelForWorld, LEVELS_PER_WORLD, makeLevel, POWERS, WORLDS, type Power } from "../../game/adventure/content";
import { canPlay, resumeLevelForWorld, type Save } from "../../game/adventure/save";
import { nextWorldForTrail, TRAIL_ART, trailLevels } from "../../game/adventure/trail";
import AdventureBoss from "./AdventureBoss";
import "../../adventure-trail.css";

type Props = {
  character: CharacterId; save: Save; worldIndex: number; dayNumber: number;
  unlockedWorlds?: number;
  onWorldChange: (world: number) => void; onBegin: (id: number) => void;
  onEnterNextWorld?: () => void;
  onClose: () => void; onSettings: () => void;
};

export default function AdventureTrail({ character, save, worldIndex, dayNumber, unlockedWorlds = WORLDS.length, onWorldChange, onBegin, onEnterNextWorld, onClose, onSettings }: Props) {
  const [journal, setJournal] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const journalClose = useRef<HTMLButtonElement>(null);
  const journalToggle = useRef<HTMLButtonElement>(null);
  const world = WORLDS[worldIndex];
  const levels = useMemo(() => trailLevels(save, worldIndex, dayNumber, unlockedWorlds), [save, worldIndex, dayNumber, unlockedWorlds]);
  const complete = levels.filter(level => level.done).length;
  const worldComplete = complete === LEVELS_PER_WORLD;
  const nextWorld = WORLDS[worldIndex + 1];
  const nextWorldReady = nextWorldForTrail(save, worldIndex, unlockedWorlds) !== null;
  const currentId = worldComplete ? levels[levels.length - 1].id : resumeLevelForWorld(save, worldIndex);
  const current = levels.find(level => level.id === currentId)!;
  const characterName = CHARACTERS.find(hero => hero.id === character)!.name;

  const locate = (behavior: ScrollBehavior = "auto") => {
    if (!scroll.current || !scene.current) return;
    // The exit lives above the illustration. Its headroom must never shift
    // the fifteen anchors inside that illustration's coordinate system.
    const sceneTop = scene.current.getBoundingClientRect().top - scroll.current.getBoundingClientRect().top + scroll.current.scrollTop;
    scroll.current.scrollTo({ top: worldComplete ? 0 : sceneTop + current.stone.y / TRAIL_ART.height * scene.current.clientHeight - scroll.current.clientHeight * .57, behavior });
  };
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => locate());
    if (scroll.current) observer.observe(scroll.current);
    locate();
    return () => observer.disconnect();
    // Recenter only on a new destination or viewport resize, not on manual scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, worldComplete]);
  useLayoutEffect(() => { if (journal) journalClose.current?.focus(); }, [journal]);
  const closeJournal = () => { setJournal(false); journalToggle.current?.focus(); };

  return <div className={`adventure-trail${save.settings.reducedMotion ? " reduced-motion" : ""}`}>
    <header className="adventure-trail-header">
      <div className="adventure-trail-toolbar">
        <button className="story-text-button" onClick={onClose}><ArrowLeft size={16} aria-hidden="true" />Trails</button>
        <span className="story-eyebrow">WORLD {worldIndex + 1}</span>
        <div className="adventure-trail-tools">
          <button ref={journalToggle} className="story-text-button adventure-icon-button" onClick={() => journal ? closeJournal() : setJournal(true)} aria-label="Powers & memories" aria-expanded={journal} aria-controls="adventure-trail-journal" title="Powers & memories"><BookOpen size={18} /></button>
          <button className="story-text-button adventure-icon-button" onClick={onSettings} aria-label="Settings" title="Settings"><Settings size={18} /></button>
        </div>
      </div>
      <div className="adventure-trail-heading">
        <h1 className="adventure-trail-world"><select aria-label="Story world" value={worldIndex} onChange={event => onWorldChange(Number(event.target.value))}>{WORLDS.map((item, index) => <option key={item.name} value={index} disabled={index !== worldIndex && !canPlay(save, firstLevelForWorld(index), dayNumber, unlockedWorlds)}>{item.name}{index >= unlockedWorlds ? " · locked" : ""}</option>)}</select></h1>
        <span className="adventure-trail-count">{complete}<small> / {LEVELS_PER_WORLD}</small><Check size={14} aria-label="missions completed" /></span>
      </div>
      <progress value={complete} max={LEVELS_PER_WORLD} aria-label="World progress" />
    </header>

    <div className="adventure-trail-stage">
      <div ref={scroll} className="adventure-trail-scroll" role="region" aria-label={`${world.name}: 15 mission stones`} tabIndex={0}>
        {worldComplete && <section className="adventure-world-exit" aria-labelledby="adventure-world-exit-title">
          {nextWorld ? <>
            <p className="story-eyebrow">ALL 15 MISSIONS COMPLETE</p>
            <button type="button" className="adventure-world-portal" onClick={onEnterNextWorld} disabled={!nextWorldReady || !onEnterNextWorld} aria-label={`Enter ${nextWorld.name}`} aria-describedby="adventure-world-exit-hint">
              <span className="adventure-world-portal-ring" aria-hidden="true" />
              <ArrowRight size={32} aria-hidden="true" />
            </button>
            <h2 id="adventure-world-exit-title">{nextWorld.name}</h2>
            <p id="adventure-world-exit-hint">{nextWorldReady ? "The exit is open. Step through to your next world." : "This exit is not available yet."}</p>
          </> : <div className="adventure-world-finish" role="status">
            <Check size={40} aria-hidden="true" />
            <p className="story-eyebrow">ALL 15 MISSIONS COMPLETE</p>
            <h2 id="adventure-world-exit-title">The journey is complete</h2>
            <p>You have reached the end of the final world. Every mission is yours to revisit.</p>
          </div>}
        </section>}
        <div ref={scene} className="adventure-trail-scene" style={{ aspectRatio: `${TRAIL_ART.width} / ${TRAIL_ART.height}` }}>
          <img className="adventure-trail-art" src={TRAIL_ART.src} width={TRAIL_ART.width} height={TRAIL_ART.height} alt="" draggable={false} />
          {levels.map(level => {
            const status = !level.playable ? "Locked: clear the previous mission" : level.attempt ? "Resume" : level.done ? `Completed: ${level.coins}/${level.totalCoins} coins. Replay` : "Begin";
            return <button key={level.id} type="button" className={`adventure-level-stone${!worldComplete && level.id === currentId ? " current" : ""}${level.done ? " completed" : ""}${level.boss ? " boss" : ""}`} style={{ left: `${level.stone.x / TRAIL_ART.width * 100}%`, top: `${level.stone.y / TRAIL_ART.height * 100}%` }} disabled={!level.playable} onClick={() => onBegin(level.id)} aria-label={`Mission ${level.stage + 1}: ${level.title}${level.boss ? ", boss" : ""}. ${status}`} aria-current={!worldComplete && level.id === currentId ? "step" : undefined} title={`${level.title} - ${status}`} data-level-id={level.id}>
              <span className="adventure-level-number" aria-hidden="true">{level.stage + 1}</span>
              <span className="adventure-level-badge" aria-hidden="true">{!level.playable ? <LockKeyhole size={12} /> : level.done ? <Check size={13} /> : level.boss ? <Skull size={13} /> : null}</span>
            </button>;
          })}
          <img className="adventure-trail-character" src={`/assets/story/${character}-back.png`} alt={`${characterName} at mission ${current.stage + 1}`} draggable={false} style={{ left: `${(current.stone.x + (current.stone.x < TRAIL_ART.width / 2 ? 145 : -145)) / TRAIL_ART.width * 100}%`, top: `${(current.stone.y + 110) / TRAIL_ART.height * 100}%` } as CSSProperties} />
        </div>
      </div>
      <button className="story-text-button adventure-icon-button adventure-trail-locate" onClick={() => locate(save.settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth")} aria-label={worldComplete ? "World exit" : "Current mission"} title={worldComplete ? "World exit" : "Current mission"}><LocateFixed size={19} /></button>
    </div>

    <footer className="adventure-trail-footer">
      <div><span className="story-eyebrow">{worldComplete ? "WORLD COMPLETE" : `MISSION ${current.stage + 1} / ${LEVELS_PER_WORLD}${current.boss ? " / BOSS" : ""}`}</span><p>{worldComplete ? nextWorld ? nextWorldReady ? `Your next world: ${nextWorld.name}` : "This exit is not available yet." : "All worlds complete. You can replay any mission." : !current.playable ? "Finish the earlier missions to reach this trail." : current.title}</p></div>
      {worldComplete ? nextWorld ? <button className="story-button adventure-trail-enter" disabled={!nextWorldReady || !onEnterNextWorld} data-story-primary onClick={onEnterNextWorld}>Enter next world<ArrowRight size={16} aria-hidden="true" /></button> : <button className="story-button adventure-trail-enter" data-story-primary onClick={onClose}>Back to story<ArrowLeft size={16} aria-hidden="true" /></button> : <button className="story-button adventure-trail-enter" disabled={!current.playable} data-story-primary onClick={() => onBegin(currentId)}>{current.attempt ? "Resume" : current.done ? "Replay" : "Begin"}<ArrowRight size={16} aria-hidden="true" /></button>}
      {!worldComplete && <small className="adventure-trail-footer-hint">{nextWorld ? "Finish all 15 missions to reveal the next-world portal." : "Finish all 15 missions to complete the final world."}</small>}
    </footer>

    {journal && <div className="adventure-trail-journal" id="adventure-trail-journal" role="region" aria-label="Powers and memories" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeJournal(); } }}>
      <div className="adventure-panel-heading"><h2>Powers & memories</h2><button ref={journalClose} className="story-text-button adventure-icon-button" onClick={closeJournal} aria-label="Close journal" title="Close journal"><X size={19} /></button></div>
      <div className="adventure-trail-guardian"><AdventureBoss world={worldIndex} reducedMotion={save.settings.reducedMotion} /><div><p className="story-eyebrow">MISSION 15 / GUARDIAN</p><h3>{world.boss}</h3><p>{save.bosses.includes(worldIndex) ? "Defeated" : world.reward ? POWERS[world.reward].name : world.motto}</p></div></div>
      <div className="adventure-power-grid">{Object.entries(POWERS).map(([id, power]) => <div key={id} className={save.powers.includes(id as Power) ? "earned" : "locked"}><b>{power.icon} {power.name}</b><p>{save.powers.includes(id as Power) ? power.help : power.meaning}</p></div>)}</div>
      {Object.entries(save.lore).flatMap(([id, ids]) => makeLevel(Number(id)).things.filter(thing => ids.includes(thing.id)).map(thing => <blockquote key={`${id}-${thing.id}`}>{thing.text}</blockquote>))}
    </div>}
  </div>;
}
