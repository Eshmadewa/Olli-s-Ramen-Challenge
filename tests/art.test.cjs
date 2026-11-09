/* Deterministic rendered animation checks in an isolated Chrome process.
 * Run: node tests/art.test.cjs. No game state, real browser, or user data changed. */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(path.dirname(process.execPath), '..', 'node_modules', 'playwright')); }
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs', 'screenshots');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1960, height: 1440 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    // Chromium taints canvas pixel reads for file:// image resources. For this
    // test only, load the identical six SVG bytes as data URLs. Production
    // assets and loading code are unchanged; no browser security flags needed.
    const svgData = {};
    for (const name of ['ollie', 'cat', 'chick']) for (const part of ['body', 'head']) {
      const relative = `./assets/${name}-${part}.svg`;
      svgData[relative] = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, relative)).toString('base64');
    }
    await page.addInitScript(map => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        ...descriptor, set(value) { descriptor.set.call(this, map[value] || value); }
      });
    }, svgData);
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => window.ollieGame?.snapshot().artReady);
    const evidence = await page.evaluate(() => {
      const art = window.RamenArt;
      const centers = [600, 990, 210], durations = [1.08, 1.23, .9];
      const labels = ['Олли', 'Котик', 'Цыплёнок'];
      const sheet = document.createElement('canvas'); sheet.width = 1960; sheet.height = 1430;
      sheet.id = 'animation-sheet';
      const sc = sheet.getContext('2d'); sc.fillStyle = '#fff8ed'; sc.fillRect(0, 0, sheet.width, sheet.height);
      sc.textAlign = 'center'; sc.fillStyle = '#654737'; sc.font = 'bold 25px Trebuchet MS';
      sc.fillText('Олли: фазы анимации — настоящие кадры Canvas', 980, 36);
      function frame(id, opts = {}) {
        const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 580;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const racers = [0, 1, 2].map(() => ({ remaining: 1, stage: 'noodles', biteAt: -99, drinkAt: -99, doneAt: -99 }));
        Object.assign(racers[id], opts.racer || {});
        if (opts.p !== undefined) racers[id].biteAt = 1;
        const args = { width: 1200, height: 580, level: 0, racers, time: 1, phase: 'racing', reducedMotion: true };
        if (opts.result) {
          Object.assign(racers[0], { remaining: 0, stage: 'done', doneAt: 6 });
          Object.assign(args, { level: 3, phase: 'result', winner: 0, reducedMotion: false });
        }
        art.reset();
        if (opts.p !== undefined) art.draw(ctx, args);
        args.time = opts.p !== undefined ? 1 + opts.p * durations[id] : (opts.time ?? 1.3);
        art.draw(ctx, args);
        return { canvas, ctx };
      }
      function difference(a, b, x, y, width, height) {
        const one = a.ctx.getImageData(x, y, width, height).data;
        const two = b.ctx.getImageData(x, y, width, height).data;
        let changed = 0;
        for (let i = 0; i < one.length; i += 4) {
          if (Math.abs(one[i] - two[i]) + Math.abs(one[i + 1] - two[i + 1]) + Math.abs(one[i + 2] - two[i + 2]) > 35) changed++;
        }
        return changed;
      }
      function noodlePixels(f, id) {
        const data = f.ctx.getImageData(centers[id] - 95, 461, 190, 30).data;
        let yellow = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 245 && data[i + 1] > 210 && data[i + 1] < 233 && data[i + 2] > 132 && data[i + 2] < 164) yellow++;
        }
        return yellow;
      }
      function confettiPixels(f) {
        const data = f.ctx.getImageData(0, 0, 1200, 580).data;
        const colors = [[242, 195, 92], [238, 167, 175], [164, 195, 172], [245, 228, 184]];
        let count = 0;
        for (let i = 0; i < data.length; i += 4) if (colors.some(c => c[0] === data[i] && c[1] === data[i + 1] && c[2] === data[i + 2])) count++;
        return count;
      }
      const rows = [];
      for (let id = 0; id < 3; id++) {
        const x = centers[id];
        const idle = frame(id), lift = frame(id, { p: .38 }), slurp = frame(id, { p: .66 }), chew = frame(id, { p: .90 });
        const broth = frame(id, { racer: { remaining: 0, stage: 'broth', drinkAt: 3 }, time: 3.85 });
        const done = frame(id, { racer: { remaining: 0, stage: 'done', drinkAt: 3, doneAt: 5.8 }, time: 6 });
        const emptyBefore = frame(id, { racer: { remaining: 0, stage: 'done' }, time: 1.3 });
        const half = frame(id, { racer: { remaining: .45 } });
        const noNoodles = frame(id, { racer: { remaining: 0 } });
        const result = frame(id, { result: true, time: 7.4 });
        const resultLater = frame(id, { result: true, time: 7.57 });
        const eyeY = id === 0 ? 265 : 333;
        const noodleY = id === 0 ? 338 : 394;
        const data = {
          character: labels[id],
          armMovementPixels: difference(idle, lift, x - 145, id === 0 ? 315 : 365, 90, id === 0 ? 165 : 115),
          eyeExpressionPixels: difference(idle, lift, x - 72, eyeY, 145, 23),
          noodleSlurpPixels: difference(lift, slurp, x - 19, noodleY, 38, 438 - noodleY),
          chewExpressionPixels: difference(slurp, chew, x - 100, id === 0 ? 290 : 367, 200, 42),
          fullNoodlePixels: noodlePixels(idle, id),
          halfNoodlePixels: noodlePixels(half, id),
          emptyNoodlePixels: noodlePixels(noNoodles, id),
          bowlLiftPixels: difference(emptyBefore, broth, x - 65, 450, 130, 115),
          replacedBowlPixels: difference(emptyBefore, done, x - 65, 450, 130, 115),
          confettiPixels: confettiPixels(result),
          celebrationMovementPixels: difference(result, resultLater, x - 80, id === 0 ? 55 : 390, 160, 65)
        };
        rows.push(data);
        const captions = ['Готовы', 'Захватить и поднять', 'Втянуть лапшу', 'Пожевать', 'Выпить бульон', 'Пустая миска', 'Победа: движение включено'];
        const frames = [idle, lift, slurp, chew, broth, done, result];
        sc.fillStyle = '#8b594a'; sc.font = 'bold 18px Trebuchet MS'; sc.textAlign = 'left';
        sc.fillText(labels[id], 18, 67 + id * 450);
        frames.forEach((f, n) => {
          const dx = n * 280 + 8, dy = 78 + id * 450;
          sc.drawImage(f.canvas, x - 175, 60, 350, 520, dx, dy, 264, 392);
          sc.fillStyle = '#654737'; sc.font = '14px Trebuchet MS'; sc.textAlign = 'center';
          sc.fillText(captions[n], dx + 132, dy + 414);
        });
      }
      sheet.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#fff8ed';
      document.body.append(sheet);
      return rows;
    });
    for (const r of evidence) {
      assert.ok(r.armMovementPixels > 1000, `${r.character}: arm must move independently`);
      assert.ok(r.eyeExpressionPixels > 30, `${r.character}: eyes must change expression`);
      assert.ok(r.noodleSlurpPixels > 100, `${r.character}: visible noodle strands must shorten`);
      assert.ok(r.chewExpressionPixels > 50, `${r.character}: mouth/cheeks must animate`);
      assert.ok(r.fullNoodlePixels > r.halfNoodlePixels, `${r.character}: half portion must visibly shrink`);
      assert.ok(r.halfNoodlePixels > r.emptyNoodlePixels, `${r.character}: empty bowl must have no noodles`);
      assert.ok(r.bowlLiftPixels > 1000, `${r.character}: broth bowl must leave table`);
      assert.equal(r.replacedBowlPixels, 0, `${r.character}: empty bowl must return to its table position`);
      assert.ok(r.confettiPixels > 500, 'Normal-motion victory must render confetti');
      assert.ok(r.celebrationMovementPixels > 80, `${r.character}: trophy or clapping must animate`);
    }
    fs.mkdirSync(out, { recursive: true });
    await page.locator('#animation-sheet').screenshot({ path: path.join(out, 'animation-phases.png') });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(evidence, null, 2));
    console.log('PASS: rendered limbs, expressions, noodle shortening, bowl fill, broth lift/return for all three characters.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
