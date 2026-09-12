import { useState } from "react";
import { CHARACTER_SPRITE } from "../game/characters";
import { dismissPrompt, requestPermission } from "../notifications";

/**
 * The notification opt-in -- a sliver of the panda's own sprite peeking up
 * over the bottom edge of the screen (cropped to just the ears/eyes band,
 * like it's sneaking a look), that opens into the actual permission ask on
 * tap. Reuses CHARACTER_SPRITE.panda directly -- no new art -- just a crop
 * window over it.
 */
export default function PandaPeekPrompt({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);

  const decide = async (allow: boolean) => {
    if (allow) await requestPermission();
    else dismissPrompt();
    onDone();
  };

  return (
    <div className={`panda-peek${open ? " panda-peek-open" : ""}`}>
      {open && (
        <div className="panda-peek-card" role="dialog" aria-label="Turn on reminders">
          <p className="panda-peek-text">
            Let the panda nudge you if today's tasks are still open tonight?
          </p>
          <div className="panda-peek-actions">
            <button type="button" className="btn ghost" onClick={() => decide(false)}>
              Not now
            </button>
            <button type="button" className="btn primary" onClick={() => decide(true)}>
              Allow
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="panda-peek-crop"
        onClick={() => setOpen(true)}
        aria-label="Turn on reminders"
        aria-expanded={open}
      >
        <img src={CHARACTER_SPRITE.panda} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}
