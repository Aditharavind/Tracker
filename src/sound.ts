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
let companionAudio: AudioContext | undefined;
let lastCompanionGiggle = 0;

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

/** A gentle rising two-note chime for a Pomodoro phase ending (work-> break
 * or break->work). Shares companionAudio's AudioContext -- both are short,
 * one-shot synthesized tones, no reason to keep two contexts alive. */
export function playPomodoroChime() {
  playSfx("start", 0.45);
}

export type SfxName =
  | "alarm" | "breath" | "check" | "click" | "coin" | "crunch" | "drop" | "fanfare" | "firework"
  | "footstep" | "gulp" | "heartbeat" | "lift" | "night" | "page" | "phone" | "rain" | "start"
  | "swoosh" | "thud" | "whoosh_big";

export type ThemeName =
  | "01_melancholic_old_routine" | "02_reflective_realization" | "03_hopeful_day_one"
  | "04_energetic_the_grind" | "05_struggle_rain_and_resolve" | "06_triumphant_day_75"
  | "07_resolution_final_message";

const sfxTemplates = new Map<SfxName, HTMLAudioElement>();

/** Play a clip from public/audio/sfx. No-op when muted; cloned per call so rapid hits overlap. */
export function playSfx(name: SfxName, volume = 0.5) {
  if (muted || typeof Audio === "undefined") return;
  try {
    let tpl = sfxTemplates.get(name);
    if (!tpl) {
      tpl = new Audio(`/audio/sfx/sfx_${name}.mp3`);
      tpl.preload = "auto";
      sfxTemplates.set(name, tpl);
    }
    const a = tpl.cloneNode() as HTMLAudioElement;
    a.volume = volume;
    void a.play().catch(() => {});
  } catch {
    /* autoplay blocked / decode error -- not worth surfacing */
  }
}

let theme: HTMLAudioElement | undefined;

/** Play one music theme at a time (a new one replaces the old). Muting stops it. */
export function playTheme(name: ThemeName, volume = 0.35) {
  stopTheme();
  if (muted || typeof Audio === "undefined") return;
  try {
    theme = new Audio(`/audio/themes/${name}.mp3`);
    theme.volume = volume;
    void theme.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function stopTheme() {
  try {
    theme?.pause();
  } catch {
    /* ignore */
  }
  theme = undefined;
}

listeners.add((m) => {
  if (m) stopTheme();
});

/** A bright "ding" for a collected coin (sfx_coin). */
export function playCoinCollect() {
  playSfx("coin", 0.5);
}

/** A tiny, warm two-note laugh for a direct tap on the forest companion. */
export function playCompanionGiggle() {
  if (muted || typeof AudioContext === "undefined") return;
  const now = Date.now();
  if (now - lastCompanionGiggle < 500) return;
  lastCompanionGiggle = now;

  try {
    companionAudio ??= new AudioContext();
    void companionAudio.resume();
    const start = companionAudio.currentTime + 0.01;
    [0, 0.14, 0.28].forEach((offset, index) => {
      const osc = companionAudio!.createOscillator();
      const gain = companionAudio!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(620 + index * 75, start + offset);
      osc.frequency.exponentialRampToValueAtTime(920 + index * 85, start + offset + 0.11);
      gain.gain.setValueAtTime(0.001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.075, start + offset + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.13);
      osc.connect(gain).connect(companionAudio!.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.14);
    });
  } catch {
    // Audio is a flourish; an unavailable context must not block the reaction.
  }
}
