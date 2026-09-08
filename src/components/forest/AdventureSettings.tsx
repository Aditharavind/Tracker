import { useState } from "react";
import { DEFAULT_SETTINGS, type Action, type Settings } from "../../game/adventure/save";

export default function AdventureSettings({ settings, onChange, onClose }: { settings: Settings; onChange: (settings: Settings) => void; onClose: () => void }) {
  const [binding, setBinding] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  return <div className="adventure-panel adventure-settings" role="dialog" aria-label="Adventure settings" onKeyDown={e => {
    if (!binding) return;
    e.preventDefault(); e.stopPropagation();
    const key = e.key.toLowerCase();
    if (key === "escape") { setBinding(null); return; }
    if (["tab", "meta", "alt"].includes(key)) { setError("Choose a letter, number, arrow, Space, Shift or Control."); return; }
    if (Object.entries(settings.keys).some(([action, mapped]) => action !== binding && mapped === key)) { setError("That key already belongs to another action."); return; }
    update("keys", { ...settings.keys, [binding]: key }); setBinding(null); setError("");
  }}>
    <div className="adventure-panel-heading"><div><p className="story-eyebrow">MAKE YOURSELF COMFORTABLE</p><h2>Your adventure, your way</h2></div><button className="story-text-button" onClick={onClose}>Done</button></div>
    <div className="adventure-setting-grid">
      <label>Graphics<select value={settings.quality} onChange={e => update("quality", e.target.value as Settings["quality"])}>{["auto", "low", "medium", "high", "ultra"].map(q => <option key={q}>{q}</option>)}</select></label>
      {([['music', 'Music volume', 0, 1, .05], ['effects', 'Effects volume', 0, 1, .05], ['uiScale', 'UI scale', .85, 1.3, .05], ['buttonSize', 'Touch button size', 44, 76, 2], ['buttonOffset', 'Touch controls inset', 0, 60, 5], ['sensitivity', 'Joystick sensitivity', .6, 1.8, .1]] as const).map(([key, label, min, max, step]) => <label key={key}>{label}<span>{key === "buttonSize" || key === "buttonOffset" ? `${settings[key]}px` : `${Math.round(settings[key] * 100)}%`}</span><input type="range" min={min} max={max} step={step} value={settings[key]} onChange={e => update(key, Number(e.target.value))} /></label>)}
      {([['performance', 'Battery / performance mode'], ['reducedMotion', 'Reduced motion'], ['shake', 'Camera shake'], ['vibration', 'Vibration (when supported)']] as const).map(([key, label]) => <label className="adventure-check" key={key}><input type="checkbox" checked={settings[key]} onChange={e => update(key, e.target.checked)} />{label}</label>)}
    </div>
    <h3>Keyboard controls</h3><p className="story-footnote">Select an action, then press a key. Escape always pauses. Mouse: click to smash; right-click for ability.</p>
    <div className="adventure-bindings">{(Object.keys(DEFAULT_SETTINGS.keys) as Action[]).map(action => <button key={action} onClick={() => { setBinding(action); setError(""); }} className={binding === action ? "binding-active" : ""}><span>{action}</span><kbd>{binding === action ? "Press a key…" : settings.keys[action] === " " ? "Space" : settings.keys[action]}</kbd></button>)}</div>
    <p role="status" className="adventure-warning">{error}</p>
    <p className="story-footnote">Gamepad: left stick / D-pad move · A jump · X smash · B dash · Y ability · LB cycle · Start pause / resume.</p>
  </div>;
}
