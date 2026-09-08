import { isMuted } from "../../sound";
import { WORLDS } from "./content";
import type { Event } from "./engine";
import type { Settings } from "./save";

// Original, procedural score: no downloaded music, no decoding on the main loop.
export class AdventureAudio {
  private ctx: AudioContext | null = null;
  private nextBeat = 0;
  private beat = 0;
  private active = false;
  private filter: BiquadFilterNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  async start() {
    try {
      if (this.active && this.ctx?.state === "running") return;
      if (!this.ctx) {
        this.ctx = new AudioContext(); this.filter = this.ctx.createBiquadFilter(); this.filter.type = "lowpass"; this.filter.frequency.value = 7000;
        this.music = this.ctx.createGain(); this.effects = this.ctx.createGain();
        this.music.connect(this.filter); this.effects.connect(this.filter); this.filter.connect(this.ctx.destination);
      }
      await this.ctx.resume(); this.active = true; this.nextBeat = this.ctx.currentTime;
    } catch { /* Audio is optional; autoplay restrictions never block a level. */ }
  }
  pause() { this.active = false; if (this.ctx?.state === "running") void this.ctx.suspend().catch(() => {}); }
  dispose() { this.active = false; if (this.ctx) void this.ctx.close().catch(() => {}); this.ctx = null; }
  private tone(note: number, duration: number, gain: number, kind: OscillatorType, effects = false, delay = 0) {
    if (!this.ctx || !this.music || !this.effects || !this.active || isMuted()) return;
    const ctx = this.ctx; const osc = ctx.createOscillator(); const env = ctx.createGain(); const when = ctx.currentTime + delay;
    osc.type = kind; osc.frequency.value = 440 * 2 ** ((note - 69) / 12);
    env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(gain, when + .018); env.gain.exponentialRampToValueAtTime(.001, when + duration);
    osc.connect(env); env.connect(effects ? this.effects : this.music); osc.start(when); osc.stop(when + duration + .02);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }
  tick(world: number, danger: "explore" | "boss" | "low" | "peace", focus: boolean, settings: Settings) {
    const ctx = this.ctx; if (!ctx || !this.active || !this.music || !this.effects || !this.filter) return;
    this.music.gain.setTargetAtTime(isMuted() ? 0 : settings.music * .22, ctx.currentTime, .1);
    this.effects.gain.setTargetAtTime(isMuted() ? 0 : settings.effects * .3, ctx.currentTime, .03);
    this.filter.frequency.setTargetAtTime(focus ? 1200 : 7000, ctx.currentTime, .2);
    if (ctx.currentTime < this.nextBeat) return;
    const fast = danger === "boss" || danger === "low";
    const interval = fast ? .23 : danger === "peace" ? .65 : .43 + world * .017;
    this.nextBeat = ctx.currentTime + interval;
    const notes = WORLDS[world].notes; const note = notes[this.beat % notes.length];
    this.tone(note + (danger === "peace" ? 12 : 0), interval * 2, .32, "sine");
    if (this.beat % 4 === 0) this.tone(notes[0] - 12, interval * 4, .2, "triangle");
    if (fast) this.tone(29 + this.beat % 2 * 7, .09, .2, "triangle");
    this.beat++;
  }
  event(event: Event) {
    const sounds: Record<Event["kind"], [number, number, OscillatorType]> = {
      jump: [72, .13, "sine"], land: [38, .08, "triangle"], attack: [48, .09, "triangle"], hit: [28, .18, "sawtooth"],
      dash: [62, .16, "triangle"], coin: [88, .13, "sine"], checkpoint: [76, .5, "sine"], power: [64, .65, "sine"],
      boss: [34, .27, "triangle"], win: [72, .6, "sine"], block: [83, .13, "triangle"], lore: [81, .45, "sine"], break: [42, .12, "triangle"],
    };
    const [note, length, type] = sounds[event.kind]; this.tone(note, length, .3, type, true);
    if (["win", "power", "checkpoint"].includes(event.kind)) { this.tone(note + 4, .5, .22, "sine", true, .13); this.tone(note + 7, .7, .2, "sine", true, .25); }
  }
}
