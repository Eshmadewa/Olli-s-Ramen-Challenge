/* Ollie's Ramen Challenge — deterministic, rendering-independent race rules. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RamenEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DRINK_SECONDS = 2.8;
  const EPSILON = 1e-8;
  const LEVELS = Object.freeze([
    { name: 'Домашний рамэн', subtitle: 'Солнечная кухня и первая победа', catInterval: 0.635, chickInterval: 0.66, bites: 100 },
    { name: 'Японская рамэнная', subtitle: 'Вкусное приключение под фонариками', catInterval: 0.575, chickInterval: 0.59, bites: 100 },
    { name: 'Рамэн под сакурой', subtitle: 'Лепестки кружатся — палочки спешат', catInterval: 0.53, chickInterval: 0.535, bites: 100 },
    { name: 'Фестиваль рамэна', subtitle: 'Большой праздник и золотая миска', catInterval: 0.49, chickInterval: 0.48, bites: 100 }
  ].map(Object.freeze));

  function createRacer(name) {
    return { name, remaining: 1, stage: 'noodles', bites: 0,
      biteAt: -99, drinkAt: -99, doneAt: -99, nextBite: Infinity };
  }

  class Race {
    constructor(level = 0, options = {}) {
      this.level = Number.isInteger(level) ? Math.max(0, Math.min(3, level)) : 0;
      this.random = typeof options.random === 'function' ? options.random : Math.random;
      this._reset();
      this.phase = 'menu';
    }

    _reset() {
      this.phase = 'countdown';
      this.previousPhase = null;
      this.time = 0;
      this.elapsed = 0;
      this.countdown = 3;
      this.winner = null;
      this.racers = [createRacer('Олли'), createRacer('Котик'), createRacer('Цыплёнок')];
    }

    start() { this._reset(); return this; }

    pause() {
      if (this.phase !== 'countdown' && this.phase !== 'racing') return false;
      this.previousPhase = this.phase;
      this.phase = 'paused';
      return true;
    }

    resume() {
      if (this.phase !== 'paused') return false;
      this.phase = this.previousPhase;
      this.previousPhase = null;
      return true;
    }

    tap() {
      if (this.phase !== 'racing' || this.racers[0].stage !== 'noodles') return false;
      this._bite(0);
      return true;
    }

    _bite(index) {
      const racer = this.racers[index];
      racer.bites++;
      racer.remaining = Math.max(0, 1 - racer.bites / LEVELS[this.level].bites);
      racer.biteAt = this.time;
      if (racer.remaining === 0) {
        racer.stage = 'broth';
        racer.drinkAt = this.time;
        racer.nextBite = Infinity;
      } else if (index > 0) {
        racer.nextBite = this.time + this._interval(index);
      }
    }

    _interval(index) {
      const config = LEVELS[this.level];
      const sample = Number(this.random());
      const random = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
      if (index === 1) return config.catInterval * (0.94 + random * 0.12);
      // Three eager pecks followed by a short breath. The cycle averages 1.
      const rhythm = [0.72, 0.76, 0.86, 1.66][this.racers[index].bites % 4];
      return config.chickInterval * rhythm * (0.96 + random * 0.08);
    }

    _beginRace() {
      this.phase = 'racing';
      this.countdown = 0;
      for (let index = 1; index < 3; index++) {
        this.racers[index].nextBite = this.time + this._interval(index);
      }
    }

    _finishBroth() {
      const finishers = [];
      for (let index = 0; index < 3; index++) {
        const racer = this.racers[index];
        if (racer.stage === 'broth' && racer.drinkAt + DRINK_SECONDS <= this.time + EPSILON) {
          racer.stage = 'done';
          racer.doneAt = racer.drinkAt + DRINK_SECONDS;
          finishers.push(index);
        }
      }
      if (this.phase === 'racing' && finishers.length) {
        // Events are chronological; a numerical tie is kindly awarded to Ollie.
        this.winner = finishers[0];
        this.phase = 'result';
      }
    }

    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || this.phase === 'paused') return;
      let target = this.time + dt;
      if (this.phase === 'menu' || this.phase === 'result') {
        this.time = target;
        if (this.phase === 'result') this._finishBroth();
        return;
      }

      if (this.phase === 'countdown') {
        if (target < 3 - EPSILON) {
          this.time = target;
          this.countdown = 3 - target;
          return;
        }
        this.time = 3;
        target = Math.max(target, 3);
        this._beginRace();
      }

      // Resolve only actual bites / drinking completions, not fixed simulation
      // frames. A slow browser frame cannot change the finishing order.
      while (this.phase === 'racing') {
        let next = Infinity;
        for (let index = 0; index < 3; index++) {
          const racer = this.racers[index];
          if (racer.stage === 'broth') next = Math.min(next, racer.drinkAt + DRINK_SECONDS);
          else if (index > 0 && racer.stage === 'noodles') next = Math.min(next, racer.nextBite);
        }
        if (next > target + EPSILON) break;
        this.time = next;
        this.elapsed = this.time - 3;
        this._finishBroth();
        if (this.phase !== 'racing') break;
        for (let index = 1; index < 3; index++) {
          const racer = this.racers[index];
          if (racer.stage === 'noodles' && racer.nextBite <= this.time + EPSILON) this._bite(index);
        }
      }
      this.time = Math.max(target, this.time);
      if (this.phase === 'racing') this.elapsed = this.time - 3;
      else this._finishBroth();
    }
  }

  return { LEVELS, DRINK_SECONDS, Race };
});
