import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, LockKeyhole, LocateFixed, Settings, Skull, X } from "lucide-react";
import { CHARACTERS, type CharacterId } from "../../game/characters";
import { firstLevelForWorld, LEVELS_PER_WORLD, makeLevel, POWERS, WORLDS, type Power } from "../../game/adventure/content";
import { canPlay, penaltyActive, resumeLevelForWorld, type Save } from "../../game/adventure/save";
import { TRAIL_ART, trailLevels } from "../../game/adventure/trail";
import AdventureBoss from "./AdventureBoss";
import "../../adventure-trail.css";

type Props = {
  character: CharacterId; save: Save; worldIndex: number; dayNumber: number;
  onWorldChange: (world: number) => void; onBegin: (id: number) => void;
  onClose: () => void; onSettings: () => void;
};

export default function AdventureTrail({ character, save, worldIndex, dayNumber, onWorldChange, onBegin, onClose, onSettings }: Props) {
  const [journal, setJournal] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const journalClose = useRef<HTMLButtonElement>(null);
  const journalToggle = useRef<HTMLButtonElement>(null);
  const world = WORLDS[worldIndex];
  const levels = useMemo(() => trailLevels(save, worldIndex, dayNumber), [save, worldIndex, dayNumber]);
  const currentId = resumeLevelForWorld(save, worldIndex);
  const current = levels.find(level => level.id === currentId)!;
  const complete = levels.filter(level => level.done).length;
  const penalty = penaltyActive(save, dayNumber);
  const characterName = CHARACTERS.find(hero => hero.id === character)!.name;

  const locate = (behavior: ScrollBehavior = "auto") => {
    if (!scroll.current || !scene.current) return;
    scroll.current.scrollTo({ top: current.stone.y / TRAIL_ART.height * scene.current.clientHeight - scroll.current.clientHeight * .57, behavior });
  };
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => locate());
    if (scroll.current) observer.observe(scroll.current);
    locate();
    return () => observer.disconnect();
    // Recenter only on a new destination or viewport resize, not on manual scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);
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
        <h1 className="adventure-trail-world"><select aria-label="Story world" value={worldIndex} onChange={event => onWorldChange(Number(event.target.value))}>{WORLDS.map((item, index) => <option key={item.name} value={index} disabled={index !== worldIndex && !canPlay(save, firstLevelForWorld(index), dayNumber)}>{item.name}</option>)}</select></h1>
        <span className="adventure-trail-count">{complete}<small> / {LEVELS_PER_WORLD}</small><Check size={14} aria-label="levels completed" /></span>
      </div>
      <progress value={complete} max={LEVELS_PER_WORLD} aria-label="World progress" />
    </header>

    <div className="adventure-trail-stage">
      <div ref={scroll} className="adventure-trail-scroll" role="region" aria-label={`${world.name}: 15 level portals`} tabIndex={0}>
        <div ref={scene} className="adventure-trail-scene" style={{ aspectRatio: `${TRAIL_ART.width} / ${TRAIL_ART.height}` }}>
          <img className="adventure-trail-art" src={TRAIL_ART.src} width={TRAIL_ART.width} height={TRAIL_ART.height} alt="" draggable={false} />
          {levels.map(level => {
            const status = penalty ? `Locked until Day ${save.penaltyUntilDay}` : !level.playable ? "Locked: clear the previous level" : level.attempt ? "Resume" : level.done ? `Completed: ${level.coins}/${level.totalCoins} coins` : "Enter";
            return <button key={level.id} type="button" className={`adventure-level-portal${level.id === currentId ? " current" : ""}${level.done ? " completed" : ""}${level.boss ? " boss" : ""}`} style={{ left: `${level.stone.x / TRAIL_ART.width * 100}%`, top: `${level.stone.y / TRAIL_ART.height * 100}%` }} disabled={!level.playable} onClick={() => onBegin(level.id)} aria-label={`Level ${level.stage + 1}: ${level.title}${level.boss ? ", boss" : ""}. ${status}`} aria-current={level.id === currentId ? "step" : undefined} title={`${level.title} - ${status}`} data-level-id={level.id}>
              <span className="adventure-level-vortex" aria-hidden="true" />
              <span className="adventure-level-number" aria-hidden="true">{level.stage + 1}</span>
              <span className="adventure-level-badge" aria-hidden="true">{!level.playable ? <LockKeyhole size={12} /> : level.done ? <Check size={13} /> : level.boss ? <Skull size={13} /> : null}</span>
              <span className="adventure-level-sign" aria-hidden="true">{level.boss ? "BOSS" : level.attempt ? "RESUME" : level.done ? "CLEARED" : `LEVEL ${String(level.stage + 1).padStart(2, "0")}`}</span>
            </button>;
          })}
          <img className="adventure-trail-character" src={`/assets/story/${character}-back.png`} alt={`${characterName} at level ${current.stage + 1}`} draggable={false} style={{ left: `${(current.stone.x + (current.stone.x < TRAIL_ART.width / 2 ? 145 : -145)) / TRAIL_ART.width * 100}%`, top: `${(current.stone.y + 110) / TRAIL_ART.height * 100}%` } as CSSProperties} />
        </div>
      </div>
      <button className="story-text-button adventure-icon-button adventure-trail-locate" onClick={() => locate(save.settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth")} aria-label="Current level" title="Current level"><LocateFixed size={19} /></button>
    </div>

    <footer className="adventure-trail-footer">
      <div><span className="story-eyebrow">{penalty ? `LOCKED UNTIL DAY ${save.penaltyUntilDay}` : `LEVEL ${current.stage + 1} / ${LEVELS_PER_WORLD}${current.boss ? " / BOSS" : ""}`}</span><p>{!current.playable && !penalty ? "Clear the previous world to open this trail." : current.title}</p></div>
      <button className="story-button adventure-trail-enter" disabled={!current.playable} data-story-primary onClick={() => onBegin(currentId)}>{current.attempt ? "Resume" : current.done ? "Replay" : "Enter"}<ArrowRight size={16} aria-hidden="true" /></button>
    </footer>

    {journal && <div className="adventure-trail-journal" id="adventure-trail-journal" role="region" aria-label="Powers and memories" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeJournal(); } }}>
      <div className="adventure-panel-heading"><h2>Powers & memories</h2><button ref={journalClose} className="story-text-button adventure-icon-button" onClick={closeJournal} aria-label="Close journal" title="Close journal"><X size={19} /></button></div>
      <div className="adventure-trail-guardian"><AdventureBoss world={worldIndex} reducedMotion={save.settings.reducedMotion} /><div><p className="story-eyebrow">LEVEL 15 / GUARDIAN</p><h3>{world.boss}</h3><p>{save.bosses.includes(worldIndex) ? "Defeated" : world.reward ? POWERS[world.reward].name : world.motto}</p></div></div>
      <div className="adventure-power-grid">{Object.entries(POWERS).map(([id, power]) => <div key={id} className={save.powers.includes(id as Power) ? "earned" : "locked"}><b>{power.icon} {power.name}</b><p>{save.powers.includes(id as Power) ? power.help : power.meaning}</p></div>)}</div>
      {Object.entries(save.lore).flatMap(([id, ids]) => makeLevel(Number(id)).things.filter(thing => ids.includes(thing.id)).map(thing => <blockquote key={`${id}-${thing.id}`}>{thing.text}</blockquote>))}
    </div>}
  </div>;
}
