import { useRef, useState } from "react";
import type { Controls } from "../../game/adventure/controls";
import type { Action, Settings } from "../../game/adventure/save";

export default function AdventureTouch({ controls, settings, disabled, dash, ability }: { controls: Controls; settings: Settings; disabled: boolean; dash: boolean; ability: boolean }) {
  const joystick = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const release = () => { activePointer.current = null; controls.touchDown = false; controls.touchAxis = 0; controls.release("crouch"); setKnob({ x: 0, y: 0 }); };
  const move = (clientX: number, clientY: number) => {
    const rect = joystick.current!.getBoundingClientRect();
    const x = Math.max(-36, Math.min(36, clientX - rect.left - rect.width / 2));
    const y = Math.max(-30, Math.min(30, clientY - rect.top - rect.height / 2));
    controls.touchAxis = Math.abs(x) < 5 ? 0 : Math.max(-1, Math.min(1, x / 32 * settings.sensitivity));
    if (y > 22) controls.press("crouch", "touch"); else controls.release("crouch");
    setKnob({ x, y });
  };
  const button = (action: Action, text: string, enabled = true) => <button className={`adventure-touch-${action}`} disabled={disabled || !enabled} aria-label={text}
    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); controls.press(action, "touch"); }}
    onPointerUp={() => controls.release(action)} onPointerCancel={() => controls.release(action)} onLostPointerCapture={() => controls.release(action)}
    onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); controls.press(action); } }}
    onKeyUp={e => { if (e.key === " " || e.key === "Enter") controls.release(action); }} onBlur={() => controls.release(action)}>{text}</button>;
  return <div className="adventure-touch" style={{ "--touch-size": `${settings.buttonSize}px`, "--touch-offset": `${settings.buttonOffset}px` } as React.CSSProperties}>
    <div ref={joystick} className="adventure-joystick" role="group" aria-label="Movement joystick. Drag left or right to move; down to crouch."
      onPointerDown={e => { if (disabled || activePointer.current !== null) return; e.preventDefault(); activePointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); controls.touchDown = true; controls.method = "touch"; move(e.clientX, e.clientY); }}
      onPointerMove={e => { if (activePointer.current === e.pointerId) move(e.clientX, e.clientY); }}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      <span className="adventure-joystick-label">MOVE</span><i style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
    <span className="adventure-touch-note">Move with intention.<br />Every step counts.</span>
    <div className="adventure-touch-actions">{button("attack", "Smash")}{button("dash", "Dash", dash)}{button("ability", "Ability", ability)}{button("jump", "Jump")}</div>
  </div>;
}
