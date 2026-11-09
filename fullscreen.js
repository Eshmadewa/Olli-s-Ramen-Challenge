(function () {
  'use strict';
  const root = document.documentElement;
  const button = document.getElementById('fullscreen');
  const message = document.getElementById('fullscreen-message');
  const activeElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  let pending = false;
  let messageTimer;

  function sync() {
    const active = !!activeElement();
    root.classList.toggle('is-fullscreen', active);
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Выйти из полного экрана' : 'На весь экран';
    button.setAttribute('aria-label', button.title);
    button.querySelector('use').setAttribute('href', active ? '#fullscreen-exit-icon' : '#fullscreen-icon');
  }
  function notify(text) {
    clearTimeout(messageTimer);
    message.textContent = text;
    message.hidden = false;
    messageTimer = setTimeout(() => { message.hidden = true; }, 6500);
  }
  button.addEventListener('click', async () => {
    if (pending) return;
    const active = !!activeElement();
    const method = active
      ? document.exitFullscreen || document.webkitExitFullscreen
      : root.requestFullscreen || root.webkitRequestFullscreen;
    if (!method) {
      notify('Этот браузер не поддерживает полный экран. Можно продолжить играть в обычном режиме.');
      return;
    }
    pending = true;
    message.hidden = true;
    try {
      // Keep the request directly in the user's click to retain browser permission.
      await method.call(active ? document : root);
    } catch (_) {
      notify('Браузер не разрешил переключить экран. Попробуй открыть игру в отдельной вкладке.');
    } finally {
      pending = false;
      sync();
    }
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  function onError() {
    sync();
    notify('Браузер не разрешил переключить экран. Попробуй открыть игру в отдельной вкладке.');
  }
  document.addEventListener('fullscreenerror', onError);
  document.addEventListener('webkitfullscreenerror', onError);
  sync();
})();
