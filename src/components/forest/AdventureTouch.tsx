import { useEffect, useRef } from "react";
import { ArrowUp, ChevronsRight, Sparkles, Swords } from "lucide-react";
import type { Controls } from "../../game/adventure/controls";
import type { Settings } from "../../game/adventure/save";

export default function AdventureTouch({ controls, settings, disabled, dash, ability }: { controls: Controls; settings: Settings; disabled: boolean; dash: boolean; ability: boolean }) {
  const joystick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLElement>(null);
  const activePointer = useRef<number | null>(null);
  const release = () => { activePointer.current = null; controls.touchDown = false; controls.touchAxis = 0; controls.release("crouch", "joystick"); if (knob.current) knob.current.style.transform = "translate(0, 0)"; };
  useEffect(() => {
    if (disabled) {
      activePointer.current = null;
      controls.touchDown = false;
      controls.touchAxis = 0;
      if (knob.current) knob.current.style.transform = "translate(0, 0)";
    }
  }, [disabled, controls]);
  const move = (clientX: number, clientY: number) => {
    const rect = joystick.current!.getBoundingClientRect();
    const x = Math.max(-36, Math.min(36, clientX - rect.left - rect.width / 2));
    const y = Math.max(-30, Math.min(30, clientY - rect.top - rect.height / 2));
    controls.touchAxis = Math.abs(x) < 5 ? 0 : Math.max(-1, Math.min(1, x / 32 * settings.sensitivity));
    if (y > 22) controls.press("crouch", "touch", "joystick"); else controls.release("crouch", "joystick");
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const icons = { attack: Swords, dash: ChevronsRight, ability: Sparkles, jump: ArrowUp };
  const button = (action: keyof typeof icons, text: string, enabled = true) => {
    const Icon = icons[action];
    return <button type="button" className={`adventure-touch-${action}`} disabled={disabled || !enabled} aria-label={text} title={text}
    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); controls.press(action, "touch", `touch-${e.pointerId}`); }}
    onPointerUp={e => controls.release(action, `touch-${e.pointerId}`)} onPointerCancel={e => controls.release(action, `touch-${e.pointerId}`)} onLostPointerCapture={e => controls.release(action, `touch-${e.pointerId}`)}
    onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); controls.press(action); } }}
    onKeyUp={e => { if (e.key === " " || e.key === "Enter") controls.release(action); }} onBlur={() => controls.release(action)}><Icon size={23} aria-hidden="true" /></button>;
  };
  return <div className="adventure-touch" style={{ "--touch-size": `${settings.buttonSize}px`, "--touch-offset": `${settings.buttonOffset}px` } as React.CSSProperties}>
    <div ref={joystick} className="adventure-joystick" role="group" aria-label="Movement joystick. Drag left or right to move; down to crouch."
      onPointerDown={e => { if (disabled || activePointer.current !== null) return; e.preventDefault(); activePointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); controls.touchDown = true; controls.method = "touch"; move(e.clientX, e.clientY); }}
      onPointerMove={e => { if (!disabled && activePointer.current === e.pointerId) move(e.clientX, e.clientY); }}
      onPointerUp={e => { if (activePointer.current === e.pointerId) release(); }} onPointerCancel={e => { if (activePointer.current === e.pointerId) release(); }} onLostPointerCapture={e => { if (activePointer.current === e.pointerId) release(); }}>
      <i ref={knob} />
    </div>
    <div className="adventure-touch-actions">{button("attack", "Smash")}{button("dash", "Dash", dash)}{button("ability", "Ability", ability)}{button("jump", "Jump")}</div>
  </div>;
}
