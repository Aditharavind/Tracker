import { ArrowLeftRight, ArrowUp, Check, Swords, X } from "lucide-react";
import type { InputMethod } from "../../game/adventure/controls";
import type { GuideStep } from "../../game/adventure/guide";
import type { Settings } from "../../game/adventure/save";
import { CoinIcon } from "./Coin";
import "../../adventure-guide.css";

type Props = {
  step: GuideStep;
  method: InputMethod;
  keys: Settings["keys"];
  onDismiss: () => void;
};

function keyLabel(key: string) {
  const names: Record<string, string> = { " ": "Space", arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓", control: "Ctrl" };
  return names[key] ?? (key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1));
}

export default function AdventureGuide({ step, method, keys, onDismiss }: Props) {
  const arrowsAvailable = !Object.entries(keys).some(([action, key]) =>
    (key === "arrowleft" && action !== "left") || (key === "arrowright" && action !== "right"));
  const moveKeys = `${keyLabel(keys.left)} / ${keyLabel(keys.right)}`;
  const arrowHint = arrowsAvailable && !(keys.left === "arrowleft" && keys.right === "arrowright") ? " or ← / →" : "";
  const instructions = {
    keyboard: [
      `Use ${moveKeys}${arrowHint} to take a few steps.`,
      `Press ${keyLabel(keys.jump)} to jump. Hold it for a higher hop.`,
      `Press ${keyLabel(keys.attack)} to try a smash.`,
    ],
    touch: [
      "Drag the left joystick to take a few steps.",
      "Tap the ↑ button to jump. Hold it for a higher hop.",
      "Tap the crossed swords button to try a smash.",
    ],
    gamepad: [
      "Use the left stick or D-pad to take a few steps.",
      "Press A to jump. Hold it for a higher hop.",
      "Press X to try a smash.",
    ],
  };
  const title = ["Let's explore", "Nice move! Try a jump", "Good jump! Try a smash", "That's it! Find a coin", "You've got this!"][step];
  const instruction = step < 3 ? instructions[method][step] : step === 3
    ? "Walk or jump into a golden coin to collect it."
    : "Follow the trail, try things out, and explore at your own pace.";
  const Icon = step === 0 ? ArrowLeftRight : step === 1 ? ArrowUp : step === 2 ? Swords : Check;

  return <aside className={`adventure-guide${step === 4 ? " adventure-guide-complete" : ""}`} aria-label="Play guide">
    <div className="adventure-guide-status" role="status" aria-live="polite" aria-atomic="true">
      <span className="adventure-guide-icon" aria-hidden="true">{step === 3 ? <CoinIcon size={24} /> : <Icon size={22} />}</span>
      <div className="adventure-guide-copy">
        <span className="adventure-guide-label">{step === 4 ? "Ready to explore" : `Learn as you play · ${step + 1} of 4`}</span>
        <strong>{title}</strong>
        <p>{instruction}</p>
      </div>
    </div>
    <button type="button" className="adventure-guide-dismiss" onClick={onDismiss} aria-label="Hide play guide" title="Hide play guide"><X size={16} aria-hidden="true" /></button>
  </aside>;
}
