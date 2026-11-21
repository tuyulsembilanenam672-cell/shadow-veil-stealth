// Shadow Veil — sound.
// Every sound is synthesized with WebAudio: no audio files, no network.
// Footsteps are filtered noise, the alert is a rising sting, pickups chime,
// and a low ambient hum sits under the game. Audio starts on the first user
// gesture, as browsers require, and M mutes everything.

let ctx = null;
let master = null;
let muted = false;
let humNodes = null;

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  return ctx;
}

// Call from any user gesture (click, key press) so the browser unlocks audio.
export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume();
  startHum();
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

// A short tone: frequency glide from `from` to `to` over `dur` seconds.
function tone(from, to, dur, type, vol, when = 0) {
  const c = ensureContext();
  if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// A burst of filtered noise: footsteps, pebble ticks, the caught thud.
function noiseBurst(dur, filterFreq, vol, type = 'lowpass', when = 0) {
  const c = ensureContext();
  if (!c) return;
  const t = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
}

// The quiet room tone: two detuned low oscillators through a low-pass
// filter, barely audible, so the museum never feels silent.
function startHum() {
  const c = ensureContext();
  if (!c || humNodes) return;
  const gain = c.createGain();
  gain.gain.value = 0.035;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  const o1 = c.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55;
  const o2 = c.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 55.7;
  o1.connect(filter);
  o2.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  o1.start();
  o2.start();
  humNodes = { o1, o2, gain };
}

// One footstep. Alternate feet get a slightly different pitch so walking
// sounds like walking, not a metronome.
export function playStep(alternate, sneaking) {
  if (!ctx) return;
  noiseBurst(0.07, alternate ? 420 : 340, sneaking ? 0.05 : 0.11);
}

// A guard's suspicion tick: a soft blip that quickens as suspicion rises.
export function playSuspicionBlip(suspicion) {
  if (!ctx) return;
  tone(620 + suspicion * 3, 620 + suspicion * 3, 0.07, 'sine', 0.06);
}

// The alert sting: two rising tones, then a low warning pulse.
export function playAlert() {
  if (!ctx) return;
  tone(392, 587, 0.16, 'square', 0.12);
  tone(587, 784, 0.2, 'square', 0.12, 0.14);
  tone(98, 82, 0.4, 'sawtooth', 0.1, 0.3);
}

// A pebble lands: a light tick, then a faint ring.
export function playPebble() {
  if (!ctx) return;
  noiseBurst(0.05, 2400, 0.14, 'highpass');
  tone(1320, 990, 0.12, 'sine', 0.05, 0.02);
}

// An artifact is stolen: a bright three-note chime.
export function playPickup() {
  if (!ctx) return;
  tone(660, 660, 0.1, 'sine', 0.12);
  tone(880, 880, 0.1, 'sine', 0.12, 0.09);
  tone(1320, 1320, 0.18, 'sine', 0.12, 0.18);
}

// Caught: a descending thud and a low drone.
export function playCaught() {
  if (!ctx) return;
  noiseBurst(0.25, 180, 0.3);
  tone(220, 55, 0.5, 'sawtooth', 0.16, 0.05);
}

// A level is cleared: a rising fanfare.
export function playLevelClear() {
  if (!ctx) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.13, i * 0.11));
}

// The whole job is done: a longer fanfare.
export function playVictory() {
  if (!ctx) return;
  [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.24, 'triangle', 0.13, i * 0.12));
}

// Game over: a slow descending line.
export function playGameOver() {
  if (!ctx) return;
  [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.94, 0.34, 'triangle', 0.12, i * 0.22));
}

// A UI click: a short blip.
export function playClick() {
  if (!ctx) return;
  tone(880, 740, 0.06, 'sine', 0.08);
}
