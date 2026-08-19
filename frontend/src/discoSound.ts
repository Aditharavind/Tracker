// Fully synthesized via Web Audio -- no external audio files, so no
// licensing question like the avatar models had. Both functions must be
// called from inside a user-gesture handler (click/tap) or the browser's
// autoplay policy will silently block them.

let ctx: AudioContext | null = null;

const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;

/**
 * A context created outside a gesture starts suspended and stays that way, so
 * an alarm that fires at 6am on a page nobody has touched since last night is
 * silent. Latch onto the next gesture and resume there. A suspended context's
 * clock is frozen, so anything already scheduled still plays once it wakes.
 */
let waitingForGesture = false;

function unlockOnGesture(c: AudioContext) {
  if (waitingForGesture) return;
  waitingForGesture = true;
  function off() {
    waitingForGesture = false;
    for (const ev of GESTURES) window.removeEventListener(ev, resume);
  }
  function resume() {
    c.resume().then(() => {
      if (c.state === "running") off();
    });
  }
  for (const ev of GESTURES) window.addEventListener(ev, resume);
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
    unlockOnGesture(ctx);
  }
  return ctx;
}

/**
 * Call from a real click/tap to build (and unlock) the context ahead of time.
 * The alarm can't do it for itself -- it fires on a timer, not a gesture.
 */
export function primeAudio() {
  try {
    getCtx();
  } catch {
    // no Web Audio here; the overlay still shows
  }
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

const SWEEP = 0.4; // seconds per half-cycle of the siren
const QUEUE = 90; // seconds of sweeps kept scheduled ahead

export function playAlarmSiren(): () => void {
  let c: AudioContext;
  try {
    c = getCtx();
  } catch {
    return () => {}; // no Web Audio -- the overlay is still the alarm
  }
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  gain.gain.value = 0.18;
  osc.connect(gain).connect(c.destination);
  osc.frequency.setValueAtTime(600, c.currentTime);
  osc.start();

  // Ramps have to be scheduled in advance, and a single fixed batch runs out:
  // the old 200-step loop covered ~2m40s and then held a flat 600Hz tone for
  // ever after, which is neither a siren nor something that stops. Top the
  // queue up on a timer so it keeps sweeping for as long as the alarm is up.
  let scheduled = c.currentTime;
  const topUp = () => {
    // A suspended or throttled context can leave us behind; scheduling into
    // the past would fire the whole backlog at once.
    if (scheduled < c.currentTime) scheduled = c.currentTime;
    const until = c.currentTime + QUEUE;
    while (scheduled < until) {
      scheduled += SWEEP;
      osc.frequency.linearRampToValueAtTime(1100, scheduled);
      scheduled += SWEEP;
      osc.frequency.linearRampToValueAtTime(600, scheduled);
    }
  };
  topUp();
  const timer = window.setInterval(topUp, (QUEUE / 3) * 1000);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    try {
      osc.frequency.cancelScheduledValues(c.currentTime);
      gain.gain.cancelScheduledValues(c.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
      osc.stop(c.currentTime + 0.2);
    } catch {
      // already stopped
    }
    // A context that was still suspended when we scheduled that stop has a
    // frozen clock, so the 0.2s of siren sits queued and squawks the instant
    // the tap that dismissed the alarm resumes it. Tearing the nodes out on a
    // wall clock is the only thing a frozen audio clock can't outlive.
    window.setTimeout(() => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // already gone
      }
    }, 250);
  };
}
