/* Run with Node.js from any directory. Writes only this folder's original WAV files. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { score } = require('../../audio.js');
const RATE = 22050;
const TAU = Math.PI * 2;
const STEP = 60 / score.bpm / 2;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
let seed = 1937;
function random() {
  seed = seed * 16807 % 2147483647;
  return seed / 1073741823.5 - 1;
}
function envelope(t, length) {
  return Math.min(t / 0.012, 1) * Math.exp(-7.4 * t / length);
}
function tone(buffer, frequency, at, duration, level, glide = frequency) {
  const offset = Math.round(at * RATE);
  let phase = 0;
  for (let i = 0; i < duration * RATE && offset + i < buffer.length; i++) {
    const t = i / RATE;
    const f = frequency * (glide / frequency) ** (t / duration);
    phase += TAU * f / RATE;
    buffer[offset + i] += Math.sin(phase) * envelope(t, duration) * level;
  }
}
function piano(buffer, note, at, duration, level) {
  const f = hz(note);
  tone(buffer, f, at, duration, level);
  tone(buffer, f * 2.003, at, duration * .45, level * .25);
  tone(buffer, f * 3, at, duration * .23, level * .055);
}
function brush(buffer, at, duration, level, center = 1800, end = 1000, q = .8) {
  const offset = Math.round(at * RATE);
  let low = 0, band = 0;
  for (let i = 0; i < duration * RATE && offset + i < buffer.length; i++) {
    const t = i / RATE;
    const cutoff = center * (end / center) ** (t / duration);
    const f = Math.min(.9, 2 * Math.sin(Math.PI * cutoff / RATE));
    low += f * band;
    const high = random() - low - Math.min(1.5, 1 / q) * band;
    band += f * high;
    buffer[offset + i] += band * envelope(t, duration) * level;
  }
}
function wav(name, buffer) {
  // Gentle headroom; no hard clipping. Final short fade avoids a loop-edge click.
  const result = Buffer.alloc(44 + buffer.length * 2);
  result.write('RIFF', 0);
  result.writeUInt32LE(result.length - 8, 4);
  result.write('WAVEfmt ', 8);
  result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20);
  result.writeUInt16LE(1, 22);
  result.writeUInt32LE(RATE, 24);
  result.writeUInt32LE(RATE * 2, 28);
  result.writeUInt16LE(2, 32);
  result.writeUInt16LE(16, 34);
  result.write('data', 36);
  result.writeUInt32LE(buffer.length * 2, 40);
  let peak = 0, square = 0;
  for (let i = 0; i < buffer.length; i++) {
    const fade = Math.min(1, i / (RATE * .005), (buffer.length - i - 1) / (RATE * .018));
    const value = Math.tanh(buffer[i] * 1.45) * .84 * fade;
    peak = Math.max(peak, Math.abs(value));
    square += value * value;
    result.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(__dirname, name), result);
  console.log(`${name}: ${(buffer.length / RATE).toFixed(2)}s, peak ${peak.toFixed(3)}, RMS ${Math.sqrt(square / buffer.length).toFixed(3)}`);
}
const music = new Float32Array(Math.round(128 * STEP * RATE));
for (let n = 0; n < 128; n++) {
  const bar = Math.floor(n / 8) % 8;
  const beat = n % 8;
  const at = n * STEP;
  if (beat === 0) score.chords[bar].slice(1).forEach((note, i) => piano(music, note, at + i * .024, 2.15, .033));
  if (beat === 0 || beat === 4) {
    tone(music, hz(score.chords[bar][0] + (beat === 4 ? 12 : 0)), at, .76, .085);
    tone(music, 82, at, .13, .032, 48);
  }
  const note = score.melody[bar][beat];
  if (note !== null) piano(music, note + (n >= 64 && beat === 2 ? 12 : 0), at + (beat % 2 ? .024 : 0), .56, .051);
  if (beat === 2 || beat === 6) brush(music, at, .11, .029, 1500, 900);
  if (beat % 2) brush(music, at + .022, .045, .015, 4100, 3100);
}
wav('little-bowl-cafe-100bpm.wav', music);

const bite = new Float32Array(Math.round(.28 * RATE));
tone(bite, 1250, 0, .035, .052, 780);
brush(bite, .025, .17, .12, 780, 1650, 5);
tone(bite, 310, .035, .13, .027, 490);
wav('slurp-and-chopsticks.wav', bite);

const drink = new Float32Array(Math.round(.9 * RATE));
[0, .12, .26].forEach((delay, i) => tone(drink, 480 + i * 75, delay, .1, .06, 230 + i * 35));
brush(drink, .4, .38, .06, 950, 380, 1.2);
wav('broth-and-happy-sigh.wav', drink);

const victory = new Float32Array(Math.round(1.25 * RATE));
[72, 76, 79, 84, 83, 84].forEach((note, i) => {
  tone(victory, hz(note), i * .145, .42, .075);
  tone(victory, hz(note - 12), i * .145, .3, .024);
});
wav('happy-bowl-fanfare.wav', victory);

const countdown = new Float32Array(Math.round(.2 * RATE));
tone(countdown, hz(72), 0, .13, .06);
wav('countdown.wav', countdown);
