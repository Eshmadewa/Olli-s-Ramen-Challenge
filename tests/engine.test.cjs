const test = require('node:test');
const assert = require('node:assert/strict');
const { Race, LEVELS, DRINK_SECONDS } = require('../engine.js');

const raceFor = (level = 0) => new Race(level, { random: () => 0.5 });
const ready = (race) => { race.start(); race.update(3); return race; };

test('all four levels start with a visible countdown and three full bowls', () => {
  assert.equal(LEVELS.length, 4);
  for (let level = 0; level < LEVELS.length; level++) {
    const race = raceFor(level);
    assert.equal(race.phase, 'menu');
    race.start();
    assert.equal(race.phase, 'countdown');
    assert.equal(race.countdown, 3);
    assert.equal(race.tap(), false);
    assert.deepEqual(race.racers.map(r => r.remaining), [1, 1, 1]);
    race.update(2.99);
    assert.equal(race.phase, 'countdown');
    race.update(0.01);
    assert.equal(race.phase, 'racing');
    assert.equal(race.elapsed, 0);
  }
});

test('every distinct tap consumes a portion even when taps share a frame', () => {
  const race = ready(raceFor());
  for (let i = 0; i < 23; i++) assert.equal(race.tap(), true);
  assert.equal(race.racers[0].bites, 23);
  assert.equal(race.racers[0].remaining, 0.77);
  assert.equal(race.racers[0].biteAt, race.time);
  assert.deepEqual(race.racers.slice(1).map(r => r.bites), [0, 0]);
});

test('all levels have autonomous opponents with distinct eating rhythms', () => {
  for (let level = 0; level < 4; level++) {
    const race = ready(raceFor(level));
    race.update(5);
    for (const racer of race.racers.slice(1)) {
      assert.ok(racer.bites > 0);
      assert.ok(racer.remaining < 1);
      assert.ok(racer.biteAt > 3);
    }
    assert.notEqual(race.racers[1].biteAt, race.racers[2].biteAt);
    assert.equal(race.racers[0].remaining, 1);
  }
});

test('empty noodles are followed by broth before the player can win', () => {
  const race = ready(raceFor());
  for (let i = 0; i < LEVELS[0].bites; i++) race.tap();
  assert.equal(race.racers[0].stage, 'broth');
  assert.equal(race.racers[0].remaining, 0);
  assert.equal(race.tap(), false);
  assert.equal(race.winner, null);
  race.update(DRINK_SECONDS - 0.01);
  assert.equal(race.winner, null);
  race.update(0.01);
  assert.equal(race.winner, 0);
  assert.equal(race.phase, 'result');
  assert.equal(race.racers[0].stage, 'done');
});

test('the child can win each level with a steady 2.5 taps per second in 40–70 seconds', () => {
  for (let level = 0; level < 4; level++) {
    const race = ready(raceFor(level));
    while (race.phase === 'racing') {
      race.update(0.4);
      race.tap();
    }
    assert.equal(race.winner, 0, `level ${level + 1}`);
    assert.ok(race.elapsed >= 40 && race.elapsed <= 70, `${race.elapsed} seconds`);
  }
});

test('doing nothing allows a cheerful rival win on all four levels in 40–70 seconds', () => {
  const times = [];
  for (let level = 0; level < 4; level++) {
    const race = ready(raceFor(level));
    race.update(90);
    assert.ok([1, 2].includes(race.winner));
    assert.equal(race.phase, 'result');
    assert.equal(race.racers[race.winner].stage, 'done');
    assert.ok(race.elapsed >= 40 && race.elapsed <= 70);
    assert.equal(race.racers[0].remaining, 1);
    times.push(race.elapsed);
  }
  for (let i = 1; i < times.length; i++) assert.ok(times[i] < times[i - 1]);
});

test('pause freezes countdown, racing, animations, and broth', () => {
  const race = raceFor();
  race.start();
  race.update(1);
  race.pause();
  const duringCountdown = JSON.stringify(race);
  race.update(60);
  assert.equal(race.tap(), false);
  assert.equal(JSON.stringify(race), duringCountdown);
  race.resume();
  race.update(2);
  assert.equal(race.phase, 'racing');
  race.tap();
  race.pause();
  const duringRace = JSON.stringify(race);
  race.update(60);
  assert.equal(JSON.stringify(race), duringRace);
  race.resume();
  for (let i = 1; i < LEVELS[0].bites; i++) race.tap();
  race.update(1);
  race.pause();
  const duringDrink = JSON.stringify(race);
  race.update(60);
  assert.equal(JSON.stringify(race), duringDrink);
  race.resume();
  race.update(DRINK_SECONDS - 1);
  assert.equal(race.winner, 0);
});

test('large frame steps and small frame steps produce the same opponent winner and time', () => {
  for (let level = 0; level < 4; level++) {
    const single = ready(raceFor(level));
    const frames = ready(raceFor(level));
    single.update(80);
    for (let i = 0; i < 4800; i++) frames.update(1 / 60);
    assert.equal(single.winner, frames.winner);
    assert.ok(Math.abs(single.elapsed - frames.elapsed) < 1e-7);
    assert.deepEqual(single.racers.map(r => r.bites), frames.racers.map(r => r.bites));
  }
});

test('a simultaneous finish gives the player a friendly tie break', () => {
  const race = ready(raceFor());
  const catFinish = LEVELS[0].catInterval * LEVELS[0].bites;
  race.update(catFinish);
  for (let i = 0; i < LEVELS[0].bites; i++) race.tap();
  assert.equal(race.racers[1].stage, 'broth');
  race.update(DRINK_SECONDS);
  assert.equal(race.winner, 0);
});

test('restart resets bowls, timer, pause, and winner; invalid updates are harmless', () => {
  const race = ready(raceFor(3));
  race.update(80);
  race.start();
  assert.equal(race.winner, null);
  assert.equal(race.time, 0);
  assert.equal(race.elapsed, 0);
  assert.equal(race.countdown, 3);
  assert.deepEqual(race.racers.map(r => r.remaining), [1, 1, 1]);
  for (const dt of [NaN, Infinity, -1, 0]) race.update(dt);
  assert.equal(race.time, 0);
  assert.equal(race.phase, 'countdown');
});
