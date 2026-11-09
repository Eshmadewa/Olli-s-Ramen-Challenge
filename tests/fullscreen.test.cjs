/* Real Fullscreen API checks in an isolated Chrome profile. */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(path.dirname(process.execPath), '..', 'node_modules', 'playwright')); }
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs', 'screenshots');
const url = pathToFileURL(path.join(root, 'index.html')).href;

(async () => {
  const browser = await playwright.chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  function collectErrors(page) {
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  }
  async function expectFullscreen(page, active) {
    await page.waitForFunction(expected => Boolean(document.fullscreenElement) === expected, active);
    await page.waitForFunction(expected => document.querySelector('#fullscreen').getAttribute('aria-pressed') === String(expected), active);
    assert.match(await page.locator('#fullscreen').getAttribute('aria-label'), active ? /выйти/i : /весь экран/i);
  }
  async function expectVisibleGame(page, label) {
    await page.waitForTimeout(200);
    const geometry = await page.evaluate(() => {
      const rect = selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
        scene: rect('#scene'), eat: rect('#eat'), fullscreen: rect('#fullscreen') };
    });
    assert.ok(geometry.scrollWidth <= geometry.width, `${label}: horizontal overflow`);
    for (const target of ['scene', 'eat', 'fullscreen']) {
      const box = geometry[target];
      assert.ok(box.width > 0 && box.height > 0, `${label}: ${target} has no size`);
      assert.ok(box.x >= -1 && box.y >= -1 && box.right <= geometry.width + 1 && box.bottom <= geometry.height + 1,
        `${label}: ${target} is outside viewport: ${JSON.stringify(geometry)}`);
    }
  }
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); collectErrors(page);
    await page.goto(url);
    await page.waitForFunction(() => window.ollieGame?.snapshot().artReady);
    assert.equal(await page.locator('#fullscreen').count(), 1, 'Fullscreen toggle must exist');
    await expectFullscreen(page, false);
    await page.locator('#fullscreen').click();
    await expectFullscreen(page, true);
    assert.equal(await page.evaluate(() => document.fullscreenElement === document.documentElement), true);
    await page.locator('#fullscreen').click();
    await expectFullscreen(page, false);
    console.log('PASS: home toggle enters/exits real fullscreen for the whole game document.');

    await page.locator('#start').click();
    await page.waitForFunction(() => ollieGame.snapshot().phase === 'racing');
    const before = await page.evaluate(() => ollieGame.snapshot());
    await page.locator('#fullscreen').press('Enter');
    await expectFullscreen(page, true);
    const after = await page.evaluate(() => ollieGame.snapshot());
    assert.equal(after.racers[0].bites, before.racers[0].bites, 'Fullscreen toggle must not eat a portion');
    assert.equal(after.phase, 'racing', 'Fullscreen toggle must not interrupt the race');
    await expectVisibleGame(page, 'desktop fullscreen');
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, 'fullscreen-desktop.png') });
    await page.evaluate(() => document.exitFullscreen());
    await expectFullscreen(page, false);
    console.log('PASS: keyboard activation during a race and external fullscreen exit stay synchronized.');

    const beforeSpace = (await page.evaluate(() => ollieGame.snapshot())).racers[0].bites;
    await page.locator('#fullscreen').press('Space');
    await expectFullscreen(page, true);
    await page.locator('#fullscreen').press('Space');
    await expectFullscreen(page, false);
    assert.equal((await page.evaluate(() => ollieGame.snapshot())).racers[0].bites, beforeSpace,
      'Space on the focused fullscreen button must toggle the screen without eating');
    console.log('PASS: Space enters/exits fullscreen during racing without consuming a portion.');

    await page.setViewportSize({ width: 320, height: 720 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px header overflows');
    const headerButton = await page.locator('#fullscreen').boundingBox();
    assert.ok(headerButton.x >= 0 && headerButton.x + headerButton.width <= 320, 'Fullscreen button must fit narrow header');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('#fullscreen').click();
    await expectFullscreen(page, true);
    await expectVisibleGame(page, 'landscape fullscreen');
    await page.screenshot({ path: path.join(out, 'fullscreen-landscape.png') });
    await page.locator('#fullscreen').click();
    await expectFullscreen(page, false);
    console.log('PASS: 320px header and 844×390 fullscreen scene plus eating controls fit.');

    for (const mode of ['unsupported', 'rejected']) {
      const testContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await testContext.addInitScript(testMode => {
        Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { configurable: true, value: undefined });
        Object.defineProperty(document, 'webkitFullscreenEnabled', { configurable: true, value: false });
        Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true,
          value: testMode === 'unsupported' ? undefined : function () { return Promise.reject(new DOMException('Test rejection', 'NotAllowedError')); } });
        Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: testMode !== 'unsupported' });
      }, mode);
      const testPage = await testContext.newPage(); collectErrors(testPage);
      await testPage.goto(url);
      await testPage.waitForFunction(() => ollieGame.snapshot().artReady);
      await testPage.locator('#fullscreen').click();
      await testPage.locator('#fullscreen-message').waitFor({ state: 'visible' });
      assert.ok((await testPage.locator('#fullscreen-message').innerText()).trim().length > 10, `${mode}: explain the limitation`);
      await expectFullscreen(testPage, false);
      await testPage.locator('#start').click();
      await testPage.waitForFunction(() => ollieGame.snapshot().phase === 'racing');
      await testPage.locator('#eat').click();
      assert.equal((await testPage.evaluate(() => ollieGame.snapshot())).racers[0].bites, 1, `${mode}: play must remain available`);
      await testContext.close();
      console.log(`PASS: ${mode} fullscreen shows visible feedback and leaves the game playable.`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: fullscreen checks completed with no browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
