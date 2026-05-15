// Web Audio API beeps — no audio files required.

let _ctx = null;
function getCtx() {
  if (_ctx) return _ctx;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    _ctx = new C();
    return _ctx;
  } catch {
    return null;
  }
}

/**
 * Play a single beep.
 * @param {object} opts
 * @param {number} [opts.frequency] Hz, default 880
 * @param {number} [opts.duration]  ms, default 120
 * @param {number} [opts.volume]    0–1, default 0.15
 * @param {'sine'|'square'|'triangle'|'sawtooth'} [opts.type] default 'square'
 */
export function beep({
  frequency = 880,
  duration = 120,
  volume = 0.15,
  type = 'square',
} = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  // Some browsers suspend the context until user gesture
  if (ctx.state === 'suspended') {
    try { ctx.resume(); } catch {}
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = frequency;

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
  osc.start(now);
  osc.stop(now + duration / 1000 + 0.02);
}

/** Play a short ascending chirp (connection-established style). */
export function chirpUp() {
  beep({ frequency: 660, duration: 90, volume: 0.12, type: 'square' });
  setTimeout(() => beep({ frequency: 990, duration: 140, volume: 0.14, type: 'square' }), 100);
}

/** Soft typewriter key click. */
export function keyClick() {
  beep({ frequency: 1500, duration: 25, volume: 0.04, type: 'square' });
}
