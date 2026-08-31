// Small SFX layer: the jump sound + a global mute switch. Separate from
// discoSound.ts (the synthesized alarm siren), but that respects the same
// mute flag -- see isMuted() below.

const MUTE_KEY = "75hard.muted";

let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

const listeners = new Set<(m: boolean) => void>();

export const isMuted = () => muted;

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* private mode */
  }
  listeners.forEach((fn) => fn(muted));
}

export function toggleMuted() {
  setMuted(!muted);
}

/** Subscribe to mute changes (for the toggle button's label). Returns an unsub. */
export function onMuteChange(fn: (m: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const JUMP_SRC = "/jump_sound.mp3";
let jumpTemplate: HTMLAudioElement | undefined;
let lastJump = 0;

/** Warm the audio element from inside a user gesture so the first jump isn't silent. */
export function primeJump() {
  if (jumpTemplate || typeof Audio === "undefined") return;
  try {
    jumpTemplate = new Audio(JUMP_SRC);
    jumpTemplate.preload = "auto";
    jumpTemplate.load();
  } catch {
    /* ignore */
  }
}

/** Play the hop sound. No-op when muted. Cloned per call so rapid hops overlap. */
export function playJump() {
  if (muted || typeof Audio === "undefined") return;
  // A hard cap so a key held down (auto-repeat) can't machine-gun the sound.
  const now = Date.now();
  if (now - lastJump < 70) return;
  lastJump = now;
  primeJump();
  try {
    const a = (jumpTemplate?.cloneNode() as HTMLAudioElement) ?? new Audio(JUMP_SRC);
    a.volume = 0.4;
    void a.play().catch(() => {});
  } catch {
    /* autoplay blocked / decode error -- not worth surfacing */
  }
}
