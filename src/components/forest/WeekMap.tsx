import { useEffect, useMemo, useRef, useState } from "react";
import type { DayCell } from "../../types";
import { CHAPTER_ENEMIES, WORLDS, type EnemyKind } from "../../game/adventure/content";
import { isWeekConsistent, unlockedWeekCount, WEEK_COUNT } from "../../game/weekSystem";
import { useModelViewer } from "../../modelViewer";
import { usePrefersReducedMotion } from "./ForestScene";
import "../../story.css";
import "../../weekmap.css";

const NODE_POS: { x: number; y: number }[] = Array.from({ length: WEEK_COUNT }, (_, i) => ({
  x: i % 2 === 0 ? 0.27 : 0.73,
  y: 0.94 - i * (0.88 / (WEEK_COUNT - 1)),
}));
const CANVAS_HEIGHT = WEEK_COUNT * 280;
const ENEMY_LABEL: Record<EnemyKind, string> = { rootling: "ZOMBIE PLANT", shade: "SHADE", moth: "MOTH", armored: "ARMORED" };

function BackPanda({ running }: { running: boolean }) {
  const ready = useModelViewer();
  const ref = useRef<HTMLElement & { loaded?: boolean }>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    const model = ref.current;
    if (!model) return;
    if (model.loaded) {
      setLoaded(true);
      return;
    }
    const onLoad = () => setLoaded(true);
    model.addEventListener("load", onLoad);
    return () => model.removeEventListener("load", onLoad);
  }, [ready]);
  return (
    <div className={`weekmap-panda${running ? " running" : ""}`} aria-hidden="true">
      <img className="weekmap-panda-fallback" src="/assets/characters/panda-back.png" alt="" hidden={loaded} />
      {ready && <model-viewer ref={ref} src="/assets/characters/panda-back.glb" alt="" animation-name={running ? "Run" : "Idle"} autoplay camera-orbit="0deg 90deg 105%" camera-controls={false} disable-zoom interaction-prompt="none" class="weekmap-panda-model" />}
    </div>
  );
}

export default function WeekMap({
  calendar,
  onClose,
  onOpenWorld,
}: {
  character: string;
  calendar: DayCell[];
  onClose: () => void;
  onOpenWorld: (worldIndex: number) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const unlocked = useMemo(() => unlockedWeekCount(calendar), [calendar]);
  const pathRef = useRef<HTMLDivElement>(null);
  const knownUnlocked = useRef<number | null>(null);
  const [visibleUnlocked, setVisibleUnlocked] = useState(unlocked);
  const [displayed, setDisplayed] = useState(unlocked);
  const [releasingWeek, setReleasingWeek] = useState<number | null>(null);

  useEffect(() => {
    const saved = Number(window.sessionStorage.getItem("weekmap:last-unlocked"));
    const known = Number.isFinite(saved) && saved >= 1 ? Math.min(saved, WEEK_COUNT) : unlocked;
    knownUnlocked.current = known;
    setVisibleUnlocked(Math.min(unlocked, known));
    setDisplayed(Math.min(unlocked, known));
  }, []);

  useEffect(() => {
    const known = knownUnlocked.current;
    if (known === null || unlocked <= known) {
      setVisibleUnlocked(unlocked);
      setDisplayed(unlocked);
      return;
    }
    knownUnlocked.current = unlocked;
    window.sessionStorage.setItem("weekmap:last-unlocked", String(unlocked));
    if (reducedMotion) {
      setVisibleUnlocked(unlocked);
      setDisplayed(unlocked);
      return;
    }
    setVisibleUnlocked(unlocked - 1);
    setDisplayed(unlocked - 1);
    setReleasingWeek(unlocked);
    const start = window.setTimeout(() => setDisplayed(unlocked), 40);
    const reveal = window.setTimeout(() => setVisibleUnlocked(unlocked), 680);
    const finish = window.setTimeout(() => setReleasingWeek(null), 1120);
    return () => { window.clearTimeout(start); window.clearTimeout(reveal); window.clearTimeout(finish); };
  }, [reducedMotion, unlocked]);

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const target = NODE_POS[displayed - 1].y * CANVAS_HEIGHT - el.clientHeight / 2;
    el.scrollTo({ top: Math.max(0, Math.min(el.scrollHeight - el.clientHeight, target)), behavior: reducedMotion ? "auto" : "smooth" });
  }, [displayed, reducedMotion]);

  const pandaPos = NODE_POS[displayed - 1];
  return <div className="weekmap" role="dialog" aria-modal="true" aria-label="Weekly trail map">
    <button type="button" className="weekmap-close" onClick={onClose} aria-label="Return to forest">Back</button>
    <div className="weekmap-path" ref={pathRef}><div className="weekmap-canvas" style={{ height: CANVAS_HEIGHT }}>
      <div className="weekmap-bg" aria-hidden="true" />
      {NODE_POS.map((pos, i) => {
        const week = i + 1;
        const locked = week > visibleUnlocked;
        const world = WORLDS[i];
        const cleared = week < unlocked || (week === unlocked && isWeekConsistent(calendar, week));
        return <button key={week} type="button" className={`weekmap-node${locked ? " locked" : ""}${week === unlocked ? " current" : ""}${cleared ? " cleared" : ""}${releasingWeek === week ? " releasing" : ""}`} style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, "--node-color": world.color } as React.CSSProperties} disabled={locked} onClick={() => onOpenWorld(i)} aria-label={locked ? `Week ${week} locked` : `Week ${week}: ${world.name}`}>
          <span className="weekmap-sign pixel-font">{locked ? <>UNLOCK<br />WEEK {week}</> : <>WEEK {week}<small>{CHAPTER_ENEMIES[i].map(enemy => ENEMY_LABEL[enemy]).join(" + ")}</small></>}</span>
          <span className="weekmap-stone" aria-hidden="true"><span className="weekmap-lock" /></span>
        </button>;
      })}
      <div className="weekmap-panda-anchor" style={{ left: `${pandaPos.x * 100}%`, top: `${pandaPos.y * 100}%` }} aria-hidden="true"><BackPanda running={displayed !== unlocked || releasingWeek !== null} /></div>
    </div></div>
  </div>;
}
