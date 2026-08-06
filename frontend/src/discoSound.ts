// Fully synthesized via Web Audio -- no external audio files, so no
// licensing question like the avatar models had. Both functions must be
// called from inside a user-gesture handler (click/tap) or the browser's
// autoplay policy will silently block them.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function kick(c: AudioContext, at: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  gain.gain.setValueAtTime(0.9, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.2);
}

function hat(c: AudioContext, at: number) {
  const bufSize = c.sampleRate * 0.05;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.25, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
  noise.connect(filter).connect(gain).connect(c.destination);
  noise.start(at);
}

export function playDiscoBeat(durationMs: number) {
  const c = getCtx();
  const start = c.currentTime + 0.05;
  const beat = 0.4; // ~150bpm four-on-the-floor
  const beats = Math.ceil(durationMs / 1000 / beat);
  for (let i = 0; i < beats; i++) {
    const at = start + i * beat;
    kick(c, at);
    hat(c, at + beat / 2);
  }
}

export function playAlarmSiren(): () => void {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  gain.gain.value = 0.18;
  osc.connect(gain).connect(c.destination);
  const now = c.currentTime;
  osc.frequency.setValueAtTime(600, now);
  let t = now;
  for (let i = 0; i < 200; i++) {
    t += 0.4;
    osc.frequency.linearRampToValueAtTime(1100, t);
    t += 0.4;
    osc.frequency.linearRampToValueAtTime(600, t);
  }
  osc.start(now);
  return () => {
    try {
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
      osc.stop(c.currentTime + 0.2);
    } catch {
      // already stopped
    }
  };
}
