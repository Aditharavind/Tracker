import { useCallback, useEffect, useRef } from "react";
import { WORLDS } from "../../game/adventure/content";
import { CHARACTER_SPRITE, type CharacterId } from "../../game/characters";
import { worldBackground } from "../../game/worldTheme";
import "../../world-transition.css";

type Props = {
  fromWorld: number;
  toWorld: number;
  character: CharacterId;
  onComplete: () => void;
  reducedMotion?: boolean;
};

export default function WorldTransition({ fromWorld, toWorld, character, onComplete, reducedMotion = false }: Props) {
  const complete = useRef(onComplete);
  const finished = useRef(false);
  const enterButton = useRef<HTMLButtonElement>(null);
  const reduced = reducedMotion || (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const destination = WORLDS[toWorld] ?? WORLDS[0];

  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    complete.current();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(finish, reduced ? 150 : 1250);
    return () => window.clearTimeout(timer);
  }, [finish, reduced]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const button = enterButton.current;
    button?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); finish();
      } else if (event.key === "Tab") {
        event.preventDefault(); event.stopPropagation(); button?.focus();
      }
    };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => { if (motion.matches) finish(); };
    window.addEventListener("keydown", onKey, true);
    motion.addEventListener("change", onMotion);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      motion.removeEventListener("change", onMotion);
      if (document.activeElement === button && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [finish]);

  return <div className="world-transition world-theme" data-world={toWorld} data-reduced-motion={reduced} role="dialog" aria-modal="true" aria-label={`Entering ${destination.name}`}>
    <div className="world-transition-landscape world-transition-departure" style={{ backgroundImage: `url("${worldBackground(fromWorld)}")` }} aria-hidden="true" />
    <div className="world-transition-landscape world-transition-arrival" style={{ backgroundImage: `url("${worldBackground(toWorld)}")` }} aria-hidden="true" />
    <div className="world-transition-shade" aria-hidden="true" />
    <div className="world-transition-scene" aria-hidden="true">
      <div className="world-transition-portal"><i /><i /></div>
      <div className="world-transition-companion"><img src={CHARACTER_SPRITE[character]} alt="" /></div>
    </div>
    <div className="world-transition-copy" role="status" aria-live="polite" aria-atomic="true">
      <p>Through the portal</p>
      <h2>{destination.name}</h2>
      <span>A new place to explore together.</span>
    </div>
    <button ref={enterButton} type="button" className="world-transition-enter" onClick={finish}>Enter world <span aria-hidden="true">→</span></button>
  </div>;
}
