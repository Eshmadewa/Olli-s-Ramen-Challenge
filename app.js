(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { LEVELS, Race } = RamenEngine;
  const STORAGE_KEY = 'ollie-ramen-v1';
  const colors = ['#df89a1', '#8daf9e', '#efc563'];
  const visualOrder = [2, 0, 1];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let saved = { unlocked: 1, wins: [], music: true, effects: true };
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && typeof data === 'object') {
      saved.unlocked = Number.isInteger(data.unlocked) ? Math.min(4, Math.max(1, data.unlocked)) : 1;
      saved.wins = Array.isArray(data.wins) ? [...new Set(data.wins.filter(n => Number.isInteger(n) && n >= 0 && n < 4))] : [];
      saved.music = data.music !== false;
      saved.effects = data.effects !== false;
    }
  } catch (_) { /* Private browsing or unavailable storage: the game still works. */ }
  const audio = new RamenAudio();
  audio.setMusic(saved.music);
  audio.setEffects(saved.effects);
  let selected = Math.min(saved.unlocked - 1, 3);
  let race = new Race(selected);
  let inGame = false;
  let previousFrame = 0;
  let uiStamp = 0;
  let lastCount = -1;
  let resultShown = false;
  let resultDelay = 0;
  let pressedUntil = 0;
  let toastUntil = 0;
  let lastStages = [];
  let modalPaused = false;
  let artReady = false;
  const ctx = $('scene').getContext('2d');
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (_) { /* Play remains available. */ } }
  function announce(text) { $('announcer').textContent = text; }
  function syncSound() {
    $('music-toggle').checked = saved.music;
    $('effects-toggle').checked = saved.effects;
    $('sound').classList.toggle('muted', !saved.music && !saved.effects);
  }
  function unlockSound() { audio.unlock().catch(() => {}); }
  function renderLevels() {
    $('levels').replaceChildren();
    LEVELS.forEach((level, index) => {
      const locked = index >= saved.unlocked;
      const won = saved.wins.includes(index);
      const button = document.createElement('button');
      button.className = `level-card${index === selected ? ' selected' : ''}${locked ? ' locked' : ''}${won ? ' won' : ''}`;
      button.disabled = locked || !artReady;
      button.setAttribute('aria-pressed', index === selected ? 'true' : 'false');
      button.setAttribute('aria-label', `${index + 1}. ${level.name}. ${locked ? 'Откроется после победы на предыдущем уровне' : won ? 'Пройден. Выбрать уровень' : 'Выбрать уровень'}`);
      button.innerHTML = `<div class="level-preview"><canvas width="480" height="232" aria-hidden="true"></canvas></div><span class="level-badge">${index + 1}</span><span class="level-state">${locked ? '<svg><use href="#lock-icon"/></svg>' : won ? '<svg><use href="#star-icon"/></svg>' : '♡'}</span><strong>${level.name}</strong><small>${locked ? `Победи на уровне ${index}` : won ? 'Снова за любимый столик' : ['Начнём с самого вкусного', 'Чуть быстрее, ещё уютнее', 'Лапша с видом на весну', 'За золотой миской!'][index]}</small>`;
      button.addEventListener('click', () => {
        selected = index;
        renderLevels();
        $('start').firstElementChild.textContent = 'Играть · уровень ' + (index + 1);
        unlockSound();
        startRace(index);
      });
      $('levels').append(button);
      if (artReady) {
        const preview = button.querySelector('canvas');
        RamenArt.draw(preview.getContext('2d'), { width: 480, height: 232, level: index, time: 0, racers: new Race(index).racers, winner: null, phase: 'menu', reducedMotion: true });
      }
    });
    $('unlock-label').textContent = `Открыто ${saved.unlocked} из 4 уровней`;
  }
  function buildBars() {
    $('race-bars').innerHTML = visualOrder.map(index => `<div class="racer" data-racer="${index}" style="--racer-color:${colors[index]}"><div class="racer-label"><strong>${race.racers[index].name}${index === 0 ? '<span class="you">ЭТО ТЫ</span>' : ''}</strong><span id="amount-${index}">100%</span></div><div class="meter" role="progressbar" aria-label="${race.racers[index].name}: осталось рамэна" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" id="meter-${index}"><div class="meter-fill" id="fill-${index}"></div></div></div>`).join('');
  }
  function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); }
  function startRace(level = selected) {
    if (level >= saved.unlocked || !artReady) return;
    closeDialogs();
    modalPaused = false;
    selected = level;
    race = new Race(level).start();
    inGame = true;
    resultShown = false;
    resultDelay = 0;
    lastCount = -1;
    lastStages = ['noodles', 'noodles', 'noodles'];
    $('home-screen').hidden = true;
    $('game-screen').hidden = false;
    $('result').hidden = true;
    $('play-controls').hidden = false;
    $('confetti').replaceChildren();
    $('level-number').textContent = `УРОВЕНЬ ${level + 1} ИЗ 4`;
    $('level-title').textContent = LEVELS[level].name;
    $('scene-toast').textContent = 'Палочки на старт!';
    $('tip-title').textContent = 'Каждое нажатие — лапшинка!';
    $('tip-description').textContent = 'Нажимай в своём ритме. У тебя получится!';
    $('pause').disabled = false;
    $('eat').disabled = true;
    $('eat').querySelector('span').textContent = 'НЯМ!';
    $('eat').querySelector('i').textContent = 'нажми меня';
    audio.setPaused(false);
    unlockSound();
    buildBars();
    updateUI();
    $('pause').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function goHome() {
    closeDialogs();
    inGame = false;
    modalPaused = false;
    audio.setPaused(false);
    race = new Race(selected);
    $('game-screen').hidden = true;
    $('home-screen').hidden = false;
    $('confetti').replaceChildren();
    renderLevels();
    $('start').firstElementChild.textContent = saved.unlocked === 1 ? 'Давай играть!' : 'Играть · уровень ' + (selected + 1);
    $('start').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function takeBite() {
    if (document.querySelector('dialog[open]') || !inGame) return;
    if (!race.tap()) return;
    unlockSound();
    audio.bite('ollie');
    pressedUntil = performance.now() + 90;
    $('eat').classList.add('pressed');
    if (race.racers[0].bites % 10 === 0 && race.racers[0].stage === 'noodles') {
      $('scene-toast').textContent = ['Вкусно получается! ♡', 'Сю-ю-уп! Ещё лапшинку!', 'Вот это аппетит! ✦'][Math.floor(race.racers[0].bites / 10) % 3];
      toastUntil = race.time + 2;
    }
    updateUI();
  }
  function pauseGame() {
    if (!race.pause()) return;
    audio.setPaused(true);
    $('pause-dialog').showModal();
    $('resume').focus();
    updateUI();
  }
  function resumeGame() {
    $('pause-dialog').close();
    race.resume();
    audio.setPaused(false);
    unlockSound();
    $('eat').focus({ preventScroll: true });
    updateUI();
  }
  function showDialog(id) {
    if (document.querySelector('dialog[open]')) return;
    modalPaused = inGame && race.pause();
    if (modalPaused) audio.setPaused(true);
    $(id).showModal();
  }
  function syncBars() {
    race.racers.forEach((racer, index) => {
      const remaining = racer.stage === 'noodles' ? 8 + 92 * racer.remaining : racer.stage === 'broth' ? 8 * Math.max(0, 1 - (race.time - racer.drinkAt) / 2.8) : 0;
      const amount = Math.round(remaining);
      $('fill-' + index).style.width = remaining + '%';
      $('meter-' + index).setAttribute('aria-valuenow', String(amount));
      $('meter-' + index).setAttribute('aria-valuetext', racer.stage === 'broth' ? 'Допивает бульон' : racer.stage === 'done' ? 'Пустая миска' : `${amount}% рамэна`);
      $('amount-' + index).textContent = racer.stage === 'broth' ? 'Бульон' : racer.stage === 'done' ? 'Готово!' : amount + '%';
      if (lastStages[index] !== racer.stage) {
        if (racer.stage === 'broth') { audio.drink(); if (index === 0) announce('Лапши больше нет! Олли допивает бульон.'); }
        lastStages[index] = racer.stage;
      }
    });
  }
  function celebrate() {
    if (resultShown) return;
    resultShown = true;
    const won = race.winner === 0;
    if (won) {
      saved.unlocked = Math.max(saved.unlocked, Math.min(4, selected + 2));
      if (!saved.wins.includes(selected)) saved.wins.push(selected);
      save();
    }
    audio.victory();
    $('scene-toast').textContent = won ? (selected === 3 ? 'Золотая миска — твоя! ✦' : 'Олли, ты чемпион! ♡') : `${race.racers[race.winner].name} — чемпион! ♡`;
    $('result-eyebrow').textContent = won ? (selected === 3 ? 'ЧЕТЫРЕ ПОБЕДЫ. ОДНА ЗОЛОТАЯ МИСКА.' : 'ВОТ ЭТО АППЕТИТ!') : 'КАК ЗДОРОВО ЕСТЬ С ДРУЗЬЯМИ!';
    $('result-title').textContent = won ? 'УРА! ОЛЛИ — ЧЕМПИОН РАМЭНА!' : `Сегодня чемпион — ${race.racers[race.winner].name.toLowerCase()}!`;
    $('result-description').textContent = won ? (selected === 3 ? 'Все четыре приключения пройдены! Золотая миска и самые тёплые аплодисменты — для тебя.' : 'Здорово получилось! Следующее вкусное приключение уже открыто.') : 'Лапша была очень вкусной! Друзья рады играть с тобой. Попробуем ещё раз?';
    $('next').hidden = !won || selected === 3;
    $('retry').className = won && selected < 3 ? 'secondary' : 'primary';
    $('pause').disabled = true;
    $('eat').disabled = true;
    resultDelay = race.time + 1.5;
    if (!reducedMotion) {
      const palette = ['#ed8ca8', '#f0c459', '#92af87', '#b8cbdc', '#fff1bc'];
      for (let i = 0; i < 38; i++) {
        const piece = document.createElement('i');
        piece.style.cssText = `--color:${palette[i % 5]};--left:${(i * 37) % 100}%;--duration:${3 + i % 4}s;--delay:${-(i % 9) / 2}s`;
        $('confetti').append(piece);
      }
    }
    announce($('result-title').textContent);
  }
  function updateUI() {
    if (!inGame) return;
    syncBars();
    const counting = race.phase === 'countdown';
    const go = race.phase === 'racing' && race.elapsed < .65;
    $('countdown').hidden = !(counting || go);
    if (counting || go) {
      const count = counting ? Math.ceil(race.countdown) : 0;
      if (count !== lastCount) {
        lastCount = count;
        $('countdown').querySelector('strong').textContent = count ? count : 'ЕДИ!';
        $('countdown').querySelector('span').textContent = count ? 'Приготовились?' : 'Приятного аппетита!';
        $('countdown').classList.remove('pop');
        void $('countdown').offsetWidth;
        $('countdown').classList.add('pop');
        audio.count(count === 0);
      }
    }
    const drinking = race.racers[0].stage === 'broth';
    $('eat').disabled = race.phase !== 'racing' || race.racers[0].stage !== 'noodles';
    if (drinking) {
      $('eat').querySelector('span').textContent = 'М-м-м!';
      $('eat').querySelector('i').textContent = 'допиваем бульон';
      $('tip-title').textContent = 'Последний глоток!';
      $('tip-description').textContent = 'Олли допьёт бульон сама. Можно отдохнуть.';
      if (race.phase === 'racing') $('scene-toast').textContent = 'Осталось допить бульон!';
    } else if (race.phase === 'racing' && race.time > toastUntil) {
      $('scene-toast').textContent = race.elapsed < 5 ? 'Нажимай «НЯМ!» — и лапша исчезнет!' : 'Лапшинка за лапшинкой ♡';
    }
    const seconds = Math.floor(race.elapsed);
    $('race-time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('race-status').textContent = ({ countdown: 'Скоро начинаем!', racing: drinking ? 'Последний глоток…' : 'Соревнование идёт!', paused: 'Игра на паузе', result: 'Какой вкусный раунд!' })[race.phase];
    if (race.phase === 'result') {
      celebrate();
      if (race.time >= resultDelay && $('result').hidden) {
        $('play-controls').hidden = true;
        $('result').hidden = false;
        (race.winner === 0 && selected < 3 ? $('next') : $('retry')).focus({ preventScroll: true });
      }
    }
  }
  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round($('scene-wrap').clientWidth * dpr);
    if (width > 0 && $('scene').width !== width) {
      $('scene').width = width;
      $('scene').height = Math.round(width * 580 / 1200);
    }
  }
  function frame(now) {
    const dt = previousFrame ? Math.min((now - previousFrame) / 1000, .1) : 0;
    previousFrame = now;
    if (inGame) {
      race.update(dt);
      fitCanvas();
      if (artReady) RamenArt.draw(ctx, { width: $('scene').width, height: $('scene').height, level: race.level, time: race.time, racers: race.racers, winner: race.winner, phase: race.phase, reducedMotion });
      if (now - uiStamp > 50) { updateUI(); uiStamp = now; }
    }
    if (now > pressedUntil) $('eat').classList.remove('pressed');
    requestAnimationFrame(frame);
  }
  $('start').addEventListener('click', () => startRace());
  $('brand').addEventListener('click', () => { if (inGame && ['racing', 'countdown'].includes(race.phase)) pauseGame(); else goHome(); });
  $('back').addEventListener('click', () => race.phase === 'result' ? goHome() : pauseGame());
  $('pause').addEventListener('click', pauseGame);
  $('resume').addEventListener('click', resumeGame);
  $('restart').addEventListener('click', () => startRace());
  $('retry').addEventListener('click', () => startRace());
  $('next').addEventListener('click', () => startRace(selected + 1));
  $('pause-home').addEventListener('click', goHome);
  $('result-home').addEventListener('click', goHome);
  $('sound').addEventListener('click', () => { unlockSound(); showDialog('settings-dialog'); });
  $('help').addEventListener('click', () => showDialog('help-dialog'));
  $('music-toggle').addEventListener('change', e => { saved.music = e.target.checked; audio.setMusic(saved.music); unlockSound(); save(); syncSound(); });
  $('effects-toggle').addEventListener('change', e => { saved.effects = e.target.checked; audio.setEffects(saved.effects); unlockSound(); save(); syncSound(); });
  document.querySelectorAll('dialog .dialog-close,dialog .dialog-done').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  ['settings-dialog', 'help-dialog'].forEach(id => $(id).addEventListener('close', () => {
    if (modalPaused) { race.resume(); audio.setPaused(false); modalPaused = false; }
  }));
  $('pause-dialog').addEventListener('cancel', event => { event.preventDefault(); resumeGame(); });
  $('eat').addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); takeBite(); } });
  $('eat').addEventListener('click', event => { if (event.detail === 0) takeBite(); });
  $('scene-wrap').addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); takeBite(); } });
  $('race-bars').addEventListener('pointerdown', event => { if (event.button === 0) takeBite(); });
  document.addEventListener('keydown', event => {
    if (!inGame || document.querySelector('dialog[open]')) return;
    if (event.code === 'Space' && event.target === $('fullscreen')) return;
    if (event.code === 'Space' || event.code === 'KeyE') {
      if (race.phase !== 'racing' && race.phase !== 'countdown') return;
      event.preventDefault();
      if (!event.repeat) takeBite();
    } else if (event.code === 'KeyP' || (event.code === 'Escape' && !document.fullscreenElement && !document.webkitFullscreenElement)) pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (inGame && !document.querySelector('dialog[open]')) pauseGame(); audio.setPaused(true); }
    else { previousFrame = 0; if (race.phase !== 'paused') audio.setPaused(false); }
  });
  // Read-only diagnostics for the local QA page; no gameplay shortcuts.
  Object.defineProperty(window, 'ollieGame', { value: Object.freeze({ snapshot: () => ({ phase: race.phase, level: race.level, time: race.time, elapsed: race.elapsed, winner: race.winner, racers: race.racers.map(({ name, remaining, stage, bites, biteAt, drinkAt, doneAt }) => ({ name, remaining, stage, bites, biteAt, drinkAt, doneAt })), unlocked: saved.unlocked, wins: [...saved.wins], audio: { unlocked: !!audio.context, state: audio.context?.state || 'locked', music: saved.music, effects: saved.effects }, artReady }) }) });
  syncSound();
  $('start').disabled = true;
  renderLevels();
  RamenArt.load().then(() => {
    artReady = true;
    $('start').disabled = false;
    renderLevels();
  }).catch(() => {
    $('start').firstElementChild.textContent = 'Не загрузились герои';
    const note = document.querySelector('.hero-note');
    note.textContent = 'Проверьте папку assets рядом с index.html и обновите страницу.';
    note.setAttribute('role', 'alert');
  });
  requestAnimationFrame(frame);
})();
