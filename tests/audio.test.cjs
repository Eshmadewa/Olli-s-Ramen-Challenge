'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'audio.js'), 'utf8');

// A small time-driven audio double: verifies lifetime/limits, not sound quality.
function environment(options = {}) {
  const timers = new Map();
  const contexts = [];
  let timerId = 0;
  class Param {
    constructor(value = 0) { this.value = value; }
    setValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
    setTargetAtTime(value) { this.value = value; }
    cancelScheduledValues() {}
  }
  class Node {
    constructor(ctx, kind) {
      this.ctx = ctx;
      this.kind = kind;
      this.connected = false;
      this.ended = false;
      this.stopAt = Infinity;
      for (const name of ['gain', 'frequency', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[name] = new Param();
      ctx.nodes.push(this);
    }
    connect() { this.connected = true; }
    disconnect() { this.connected = false; }
    start(at) { this.startAt = at; }
    stop(at = this.ctx.currentTime) { this.stopAt = at; }
  }
  class Context {
    constructor() {
      this.nodes = [];
      this.state = 'suspended';
      this.sampleRate = 8000;
      this.currentTime = 0;
      this.destination = {};
      this.resumeAttempts = 0;
      contexts.push(this);
    }
    createGain() { return new Node(this, 'gain'); }
    createDynamicsCompressor() { return new Node(this, 'compressor'); }
    createOscillator() { return new Node(this, 'oscillator'); }
    createBufferSource() { return new Node(this, 'buffer-source'); }
    createBiquadFilter() { return new Node(this, 'filter'); }
    createBuffer(channels, size) { return { getChannelData: () => new Float32Array(size) }; }
    async resume() {
      this.resumeAttempts++;
      if (options.resume) await options.resume(this);
      if (this.state !== 'closed') this.state = 'running';
    }
    async close() { this.state = 'closed'; }
    advance(dt) {
      this.currentTime += dt;
      for (const node of this.nodes) {
        if (!node.ended && node.stopAt <= this.currentTime) {
          node.ended = true;
          if (node.onended) node.onended();
        }
      }
    }
  }
  const window = {
    AudioContext: Context,
    setInterval(callback) { timers.set(++timerId, callback); return timerId; },
    clearInterval(id) { timers.delete(id); }
  };
  vm.runInNewContext(source, { window });
  return { audio: new window.RamenAudio(), contexts, timers };
}

test('no audio context or scheduler exists before a user unlock', async () => {
  const { audio, contexts, timers } = environment();
  audio.setMusic(false);
  audio.setEffects(false);
  audio.bite();
  audio.drink();
  audio.victory();
  assert.equal(contexts.length, 0);
  assert.equal(timers.size, 0);
  assert.equal(await audio.unlock(), true);
  assert.equal(contexts.length, 1);
  assert.equal(audio.sources.size, 0);
});

test('100 rapid bites remain bounded and every transient node is released', async () => {
  const { audio } = environment();
  audio.setMusic(false);
  await audio.unlock();
  let peak = 0;
  for (let i = 0; i < 100; i++) {
    audio.bite(i % 2 ? 'chick' : 'ollie');
    peak = Math.max(peak, audio.sources.size);
    audio.context.advance(0.005);
  }
  assert.ok(peak > 0, 'accepted inputs remain audible');
  assert.ok(peak <= 9, 'no unbounded pile-up of slurps');
  audio.context.advance(1);
  assert.equal(audio.sources.size, 0);
  const transient = audio.context.nodes.slice(4);
  assert.ok(transient.every(node => !node.connected), 'finished envelopes and filters also disconnect');
});

test('pause silences audio, clears scheduler, and repeated resume keeps one scheduler', async () => {
  const { audio, timers } = environment();
  await audio.unlock();
  audio.bite();
  audio.setPaused(true);
  audio.context.advance(0.1);
  assert.equal(audio.sources.size, 0);
  assert.equal(timers.size, 0);
  audio.bite();
  audio.count();
  audio.victory();
  assert.equal(audio.sources.size, 0);
  audio.setPaused(false);
  audio.setPaused(false);
  await audio.unlock();
  assert.equal(timers.size, 1);
});

test('effect mute and music mute remain independent across a pause', async () => {
  const { audio } = environment();
  audio.setMusic(false);
  await audio.unlock();
  audio.setEffects(false);
  audio.bite();
  assert.equal(audio.sources.size, 0);
  audio.setPaused(true);
  audio.setPaused(false);
  audio.setEffects(true);
  audio.bite();
  assert.ok(audio.sources.size > 0);
  assert.equal(audio.musicGain.gain.value, 0);
  assert.ok(audio.fxGain.gain.value > 0);
});

test('an interrupted or denied resume can recover on the next user interaction', async () => {
  const { audio, contexts, timers } = environment({
    resume(ctx) { if (ctx.resumeAttempts === 1) throw new Error('User gesture required'); }
  });
  assert.equal(await audio.unlock(), false);
  assert.equal(timers.size, 0);
  assert.equal(await audio.unlock(), true);
  assert.equal(contexts.length, 1);
  audio.context.state = 'interrupted';
  assert.equal(await audio.unlock(), true);
  assert.equal(timers.size, 1);
});

test('returning from a long inactive tab does not replay the missed music', async () => {
  const { audio } = environment();
  await audio.unlock();
  audio.context.advance(120);
  audio.schedule();
  assert.ok(audio.sources.size < 40, 'only the next beat may be scheduled');
  assert.ok(audio.nextStep >= audio.context.currentTime);
});

test('destroy during pending unlock cannot restart audio or reject later', async () => {
  let release;
  const { audio, timers } = environment({ resume: () => new Promise(resolve => { release = resolve; }) });
  const pending = audio.unlock();
  await audio.destroy();
  release();
  assert.equal(await pending, false);
  assert.equal(timers.size, 0);
  assert.equal(audio.context, null);
  assert.equal(await audio.unlock(), false);
});
