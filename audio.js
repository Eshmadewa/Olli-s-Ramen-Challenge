/* Original score: Little Bowl Café, 100 BPM. No recorded or third-party samples. */
(function (root) {
  'use strict';

  const BPM = 100;
  const STEP = 60 / BPM / 2;
  const CHORDS = [
    [48, 60, 64, 67, 71], [45, 57, 60, 64, 67],
    [50, 60, 62, 65, 69], [43, 59, 62, 64, 69],
    [40, 55, 59, 62, 67], [45, 55, 59, 62, 64],
    [50, 57, 60, 64, 65], [43, 55, 59, 62, 64]
  ];
  const MELODY = [
    [76, null, 79, 76, null, 74, 72, null],
    [72, null, 76, null, 79, 76, 74, null],
    [77, null, 76, 74, null, 72, 69, null],
    [71, 74, null, 76, null, 74, 71, null],
    [76, null, 79, null, 83, 79, 76, null],
    [74, null, 76, 79, null, 76, 72, null],
    [74, 77, null, 76, null, 74, 72, null],
    [71, null, 74, null, 72, null, null, null]
  ];
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);

  class RamenAudio {
    constructor() {
      this.context = null;
      this.music = true;
      this.effects = true;
      this.paused = false;
      this.timer = null;
      this.step = 0;
      this.nextStep = 0;
      this.lastBite = -Infinity;
      this.fxUntil = [];
      this.sources = new Set();
      this.destroyed = false;
    }

    async unlock() {
      if (this.destroyed) return false;
      if (!this.context) {
        const AudioContext = root.AudioContext || root.webkitAudioContext;
        if (!AudioContext) return false;
        try {
          this.context = new AudioContext();
          const ctx = this.context;
          this.master = ctx.createGain();
          this.master.gain.value = 0.64;
          this.compressor = ctx.createDynamicsCompressor();
          this.compressor.threshold.value = -16;
          this.compressor.knee.value = 14;
          this.compressor.ratio.value = 6;
          this.compressor.attack.value = 0.006;
          this.compressor.release.value = 0.18;
          this.musicGain = ctx.createGain();
          this.fxGain = ctx.createGain();
          this.musicGain.gain.value = this.music && !this.paused ? 0.65 : 0;
          this.fxGain.gain.value = this.effects && !this.paused ? 0.75 : 0;
          this.musicGain.connect(this.compressor);
          this.fxGain.connect(this.compressor);
          this.compressor.connect(this.master);
          this.master.connect(ctx.destination);
          this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
          const samples = this.noiseBuffer.getChannelData(0);
          let seed = 1937;
          for (let i = 0; i < samples.length; i++) {
            seed = (seed * 16807) % 2147483647;
            samples[i] = seed / 1073741823.5 - 1;
          }
        } catch (_) {
          this.context = null;
          return false;
        }
      }
      const context = this.context;
      try {
        if (context.state !== 'running') await context.resume();
      } catch (_) { return false; }
      // A delayed mobile resume must not revive an instance that was disposed.
      if (this.destroyed || this.context !== context) return false;
      if (!this.paused && !this.timer) {
        this.nextStep = this.context.currentTime + 0.05;
        this.schedule();
        this.timer = root.setInterval(() => this.schedule(), 80);
      }
      return this.context.state === 'running';
    }

    gain(node, value) {
      if (!this.context || !node) return;
      const now = this.context.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(value, now, 0.025);
    }

    setMusic(enabled) {
      this.music = !!enabled;
      this.gain(this.musicGain, this.music && !this.paused ? 0.65 : 0);
    }

    setEffects(enabled) {
      this.effects = !!enabled;
      this.gain(this.fxGain, this.effects && !this.paused ? 0.75 : 0);
    }

    setPaused(paused) {
      this.paused = !!paused;
      this.gain(this.musicGain, this.music && !this.paused ? 0.65 : 0);
      this.gain(this.fxGain, this.effects && !this.paused ? 0.75 : 0);
      if (this.paused) {
        root.clearInterval(this.timer);
        this.timer = null;
        for (const source of this.sources) {
          try { source.stop(this.context.currentTime + 0.08); } catch (_) { /* already stopped */ }
        }
      } else if (this.context) {
        this.unlock();
      }
    }

    track(source, end, nodes) {
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
        source.disconnect();
        for (const node of nodes) node.disconnect();
      };
      source.stop(end);
    }

    tone(hz, at, duration, level, target, type = 'sine', glide = null) {
      const ctx = this.context;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(hz, at);
      if (glide) oscillator.frequency.exponentialRampToValueAtTime(glide, at + duration);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), at + Math.min(0.012, duration / 4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(envelope);
      envelope.connect(target);
      oscillator.start(at);
      this.track(oscillator, at + duration + 0.025, [envelope]);
    }

    noise(at, duration, level, hz, endHz, target, q = 0.8) {
      const ctx = this.context;
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      source.buffer = this.noiseBuffer;
      filter.type = 'bandpass';
      filter.Q.value = q;
      filter.frequency.setValueAtTime(hz, at);
      filter.frequency.exponentialRampToValueAtTime(endHz, at + duration);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(level, at + 0.018);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(target);
      source.start(at);
      this.track(source, at + duration + 0.025, [filter, envelope]);
    }

    piano(midi, at, duration, level) {
      const hz = freq(midi);
      this.tone(hz, at, duration, level, this.musicGain);
      this.tone(hz * 2.003, at, duration * 0.45, level * 0.25, this.musicGain);
      this.tone(hz * 3, at, duration * 0.23, level * 0.055, this.musicGain);
    }

    schedule() {
      const ctx = this.context;
      if (!ctx || this.paused || ctx.state !== 'running') return;
      // A sleeping tab must never replay an accumulated queue of old notes.
      if (this.nextStep < ctx.currentTime - STEP) this.nextStep = ctx.currentTime + 0.025;
      while (this.nextStep < ctx.currentTime + 0.18) {
        const n = this.step % 128;
        const bar = Math.floor(n / 8) % 8;
        const beat = n % 8;
        const at = this.nextStep;
        if (this.music) {
          if (beat === 0) {
            CHORDS[bar].slice(1).forEach((note, i) => this.piano(note, at + i * 0.024, 2.15, 0.033));
          }
          if (beat === 0 || beat === 4) {
            this.tone(freq(CHORDS[bar][0] + (beat === 4 ? 12 : 0)), at, 0.76, 0.085, this.musicGain);
            this.tone(82, at, 0.13, 0.032, this.musicGain, 'sine', 48);
          }
          const note = MELODY[bar][beat];
          if (note !== null) {
            const variation = n >= 64 && beat === 2 ? 12 : 0;
            this.piano(note + variation, at + (beat % 2 ? 0.024 : 0), 0.56, 0.051);
          }
          if (beat === 2 || beat === 6) this.noise(at, 0.11, 0.029, 1500, 900, this.musicGain);
          if (beat % 2) this.noise(at + 0.022, 0.045, 0.015, 4100, 3100, this.musicGain);
        }
        this.step++;
        this.nextStep += STEP;
      }
    }

    canEffect() {
      return this.context && this.context.state === 'running' && this.effects && !this.paused;
    }

    bite(kind = 'ollie') {
      if (!this.canEffect()) return;
      const now = this.context.currentTime;
      this.fxUntil = this.fxUntil.filter(end => end > now);
      if (now - this.lastBite < 0.105 || this.fxUntil.length >= 3) return;
      this.lastBite = now;
      this.fxUntil.push(now + 0.23);
      const pitch = kind === 'chick' ? 1.2 : kind === 'cat' ? 1.1 : 1;
      this.tone(1250, now, 0.035, 0.052, this.fxGain, 'sine', 780);
      this.noise(now + 0.025, 0.17, 0.12, 780 * pitch, 1650 * pitch, this.fxGain, 5);
      this.tone(310 * pitch, now + 0.035, 0.13, 0.027, this.fxGain, 'sine', 490 * pitch);
    }

    drink() {
      if (!this.canEffect()) return;
      const now = this.context.currentTime;
      [0, 0.12, 0.26].forEach((delay, i) => this.tone(480 + i * 75, now + delay, 0.10, 0.06, this.fxGain, 'sine', 230 + i * 35));
      this.noise(now + 0.4, 0.38, 0.06, 950, 380, this.fxGain, 1.2);
    }

    victory() {
      if (!this.canEffect()) return;
      const now = this.context.currentTime;
      [72, 76, 79, 84, 83, 84].forEach((note, i) => {
        this.tone(freq(note), now + i * 0.145, 0.42, 0.075, this.fxGain);
        this.tone(freq(note - 12), now + i * 0.145, 0.30, 0.024, this.fxGain);
      });
    }

    count(last = false) {
      if (!this.canEffect()) return;
      this.tone(freq(last ? 79 : 72), this.context.currentTime, last ? 0.30 : 0.13, 0.06, this.fxGain);
    }

    async destroy() {
      this.destroyed = true;
      root.clearInterval(this.timer);
      this.timer = null;
      if (this.context) {
        for (const source of this.sources) { try { source.stop(); } catch (_) {} }
        await this.context.close();
      }
      this.sources.clear();
      this.context = null;
    }
  }

  root.RamenAudio = RamenAudio;
  // The note score is shared with the offline WAV renderer; it contains no browser state.
  RamenAudio.score = { bpm: BPM, chords: CHORDS, melody: MELODY };
  if (typeof module !== 'undefined' && module.exports) module.exports = RamenAudio;
})(typeof window !== 'undefined' ? window : globalThis);
