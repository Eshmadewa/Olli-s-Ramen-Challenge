/* Original layered vector animation, traced by hand from the supplied character reference.
 * Separate body/head SVG sprites, procedural face/limb/chopstick/noodle/bowl layers.
 * All coordinates below are in the 1200 × 580 illustration space. */
(function () {
  'use strict';
  const OUTLINE = '#59402e';
  const TAU = Math.PI * 2;
  const sprites = {};
  const names = ['ollie', 'cat', 'chick'];
  let loaded = null;
  let previousTime = -1;
  let cycles = [];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const mix = (a, b, t) => a + (b - a) * t;
  function path(c, d, fill, stroke = OUTLINE, width = 4) {
    const p = new Path2D(d);
    if (fill) { c.fillStyle = fill; c.fill(p); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(p); }
  }
  function ellipse(c, x, y, rx, ry, fill, stroke, width = 3) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function line(c, pts, color = OUTLINE, width = 4) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function rect(c, x, y, w, h, r, fill, stroke, width = 3) {
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function text(c, value, x, y, size, color, weight = '700') {
    c.font = `${weight} ${size}px "Trebuchet MS", sans-serif`;
    c.fillStyle = color; c.textAlign = 'center'; c.fillText(value, x, y);
  }
  function star(c, x, y, r, color, turn = 0) {
    c.save(); c.translate(x, y); c.rotate(turn); c.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5 - Math.PI / 2;
      const rad = i % 2 ? r * .46 : r;
      const px = Math.cos(angle) * rad, py = Math.sin(angle) * rad;
      if (!i) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.fillStyle = color; c.fill(); c.restore();
  }
  function heart(c, x, y, s, color) {
    c.save(); c.translate(x, y); c.scale(s, s);
    path(c, 'M0 5C-21-8-15-24-4-19Q0-17 0-13Q9-27 19-14C28 0 0 17 0 17Z', color, null);
    c.restore();
  }
  function cloud(c, x, y, s, color = '#fffcf0') {
    c.save(); c.translate(x, y); c.scale(s, s);
    ellipse(c, 0, 0, 53, 21, color); ellipse(c, -21, -14, 25, 24, color);
    ellipse(c, 17, -21, 30, 31, color); c.restore();
  }
  function flower(c, x, y, s, color = '#ef9eac') {
    c.save(); c.translate(x, y); c.scale(s, s);
    for (let i = 0; i < 5; i++) {
      c.save(); c.rotate(i * TAU / 5); ellipse(c, 0, -8, 6, 8, color); c.restore();
    }
    ellipse(c, 0, 0, 4, 4, '#f3c15f'); c.restore();
  }
  function plant(c, x, y, s, flowering = false) {
    c.save(); c.translate(x, y); c.scale(s, s);
    line(c, [0, 0, 0, -62], '#7d9560', 4);
    for (let i = 0; i < 3; i++) {
      const yy = -15 - i * 17;
      c.save(); c.translate(-10, yy); c.rotate(-.5); ellipse(c, 0, 0, 14, 6, '#91a96d'); c.restore();
      c.save(); c.translate(10, yy - 6); c.rotate(.5); ellipse(c, 0, 0, 14, 6, '#a8ba7c'); c.restore();
    }
    if (flowering) { flower(c, 0, -70, .9); flower(c, -18, -51, .6, '#f2b0b9'); flower(c, 20, -57, .65); }
    path(c, 'M-24-5L-19 31Q0 39 19 31L24-5Z', '#dd927a', '#b97860', 2.5);
    rect(c, -27, -8, 54, 10, 4, '#eaaa8d', '#b97860', 2.5); c.restore();
  }
  function lantern(c, x, y, s, color = '#eaa08a') {
    c.save(); c.translate(x, y); c.scale(s, s);
    line(c, [0, -74, 0, -40], '#7b5b49', 3);
    ellipse(c, 0, 0, 33, 43, color, '#a96d59', 2);
    for (let i = -2; i <= 2; i++) ellipse(c, 0, i * 12, Math.sqrt(1 - (i * .23) ** 2) * 32, 4, null, '#bd7b63', 1.4);
    rect(c, -17, -44, 34, 7, 2, '#b4765b'); rect(c, -17, 37, 34, 7, 2, '#b4765b');
    line(c, [0, 44, 0, 61], '#c08868', 2); c.restore();
  }
  function tinyBowl(c, x, y, s, color) {
    c.save(); c.translate(x, y); c.scale(s, s);
    path(c, 'M-36 0Q-31 36 0 36Q31 36 36 0Z', color, '#ad7a58', 3);
    ellipse(c, 0, 0, 36, 13, '#f7e7c5', '#ad7a58', 3);
    ellipse(c, 0, 0, 28, 8, '#d89846');
    path(c, 'M-22 1Q-10-12 0 0T22 0M-18 6Q-5-7 7 5T25 2', null, '#ffe29a', 3);
    c.restore();
  }
  function kitchen(c) {
    const wall = c.createLinearGradient(0, 0, 0, 465); wall.addColorStop(0, '#fff1d8'); wall.addColorStop(1, '#f9dfb8');
    c.fillStyle = wall; c.fillRect(0, 0, 1200, 580);
    // Large sunlit window and soft gingham curtains.
    rect(c, 52, 22, 351, 304, 11, '#bc8d60', '#ad7b52');
    rect(c, 65, 35, 325, 276, 5, '#a7d7df');
    ellipse(c, 314, 92, 35, 35, '#ffe6a1'); cloud(c, 159, 101, .75); cloud(c, 307, 198, .48);
    path(c, 'M65 287Q103 245 136 271Q169 230 207 265Q244 238 276 275Q329 229 390 271V312H65Z', '#b2c48a', null);
    line(c, [227, 36, 227, 311], '#c69b70', 11); line(c, [66, 191, 389, 191], '#c69b70', 10);
    path(c, 'M42 23H112L98 210Q75 250 44 260Z', '#f4bfae', '#d6947c', 2);
    path(c, 'M345 23H414V260Q380 249 361 210Z', '#f4bfae', '#d6947c', 2);
    for (let x = 55; x < 107; x += 15) line(c, [x, 29, x - 3, 230], '#f9d7bc', 5);
    for (let x = 359; x < 411; x += 15) line(c, [x, 29, x + 2, 234], '#f9d7bc', 5);
    rect(c, 39, 309, 378, 16, 5, '#d6ab78');
    // Hand-painted framed noodle poster.
    rect(c, 874, 34, 194, 171, 6, '#c59366', '#ad7954');
    rect(c, 883, 43, 176, 153, 2, '#fff2d8');
    text(c, 'РАМЭН', 971, 76, 20, '#cf7a62'); tinyBowl(c, 972, 127, 1.45, '#f4c8ab');
    heart(c, 1034, 91, .4, '#e9a092');
    rect(c, 812, 299, 333, 17, 4, '#c49466', '#b3855c', 2);
    plant(c, 1098, 266, .83, true); plant(c, 853, 271, .68);
    tinyBowl(c, 926, 278, .65, '#e8c3ad'); tinyBowl(c, 983, 278, .65, '#afc8ae');
    c.fillStyle = '#f4e6c9'; c.fillRect(0, 357, 1200, 108);
    for (let x = 0; x < 1200; x += 67) line(c, [x, 358, x, 461], '#e5d0ac', 2);
    line(c, [0, 410, 1200, 410], '#e5d0ac', 2);
    line(c, [0, 356, 1200, 356], '#d4ae7e', 7);
    // A patch of afternoon sunlight.
    path(c, 'M67 326H386L537 465H188Z', '#fff5ce88', null);
  }
  function shop(c) {
    c.fillStyle = '#d6b58d'; c.fillRect(0, 0, 1200, 580);
    for (let x = 0; x < 1200; x += 75) {
      c.fillStyle = x % 150 ? '#d5b18b' : '#dfbd94'; c.fillRect(x, 0, 75, 465);
      line(c, [x, 0, x, 465], '#bd976f', 3);
      path(c, `M${x + 19} 20Q${x + 39} 110 ${x + 25} 180T${x + 34} 330`, null, '#c69e72', 1);
    }
    rect(c, 53, 153, 340, 219, 8, '#775e47', '#694c36', 5);
    rect(c, 66, 166, 314, 191, 2, '#9b9a73');
    for (let y = 205; y <= 325; y += 58) {
      for (let x = 111; x < 379; x += 74) tinyBowl(c, x, y - 12, .68, x % 3 ? '#e9d9bc' : '#c5d4be');
      rect(c, 67, y + 13, 311, 9, 2, '#74563b');
    }
    rect(c, 818, 178, 294, 194, 5, '#eee2c0', '#9b7751', 7);
    for (let i = 0; i < 3; i++) {
      rect(c, 841 + i * 87, 196, 66, 145, 3, '#f8efda');
      text(c, ['麺', '愛', '幸'][i], 874 + i * 87, 269, 41, '#9c6751');
      flower(c, 874 + i * 87, 309, .65, '#d98b7b');
    }
    rect(c, 0, 0, 1200, 21, 0, '#81543b');
    for (let x = 426; x <= 774; x += 87) {
      path(c, `M${x} 20H${x + 79}V107Q${x + 40} 119 ${x} 107Z`, '#b97868', '#935e50', 2);
      ellipse(c, x + 40, 61, 20, 20, '#eedbb1'); path(c, `M${x + 29} 62Q${x + 40} 50 ${x + 51} 62`, null, '#b97868', 3);
    }
    lantern(c, 179, 78, .94, '#f3c48f'); lantern(c, 1016, 76, .94, '#edaa91');
    plant(c, 1153, 389, .8); rect(c, 0, 418, 1200, 48, 0, '#9a7652');
  }
  function sakura(c, time, reduced) {
    c.fillStyle = '#f4e8db'; c.fillRect(0, 0, 1200, 580);
    rect(c, 47, 32, 1106, 323, 10, '#c19c80', '#b18a70', 3);
    rect(c, 59, 44, 1082, 299, 3, '#dce9e5');
    c.save(); c.beginPath(); c.rect(59, 44, 1082, 299); c.clip();
    cloud(c, 260, 112, 1.2, '#f6f4e9'); cloud(c, 790, 92, 1.1, '#f6f4e9');
    path(c, 'M52 328Q183 242 340 295T650 282T961 283T1172 257V360H52Z', '#b5c7a4', null);
    path(c, 'M1086 361Q1022 275 1003 180Q966 138 839 115M1014 225Q911 176 783 193M1004 180Q1073 135 1107 62M839 115Q781 88 709 40', null, '#927c67', 17);
    path(c, 'M1010 217Q928 171 837 189M1005 175Q1070 129 1101 63', null, '#b49b85', 5);
    const blossoms = [[1104,74],[1083,112],[1023,159],[952,143],[892,119],[823,104],[768,72],[717,46],[781,190],[849,187],[914,184],[1060,189],[970,89],[1119,214],[670,71]];
    for (let i = 0; i < blossoms.length; i++) {
      const [x, y] = blossoms[i];
      for (let j = 0; j < 5; j++) flower(c, x + Math.cos(j * 2.4) * 22, y + Math.sin(j * 2.4) * 15, 1.25, i % 2 ? '#f1bfca' : '#f8cfd6');
    }
    if (!reduced) for (let i = 0; i < 18; i++) {
      const x = 60 + ((i * 107 + time * (8 + i % 4)) % 1080), y = 44 + ((i * 37 + time * (11 + i % 5)) % 299);
      c.save(); c.translate(x, y); c.rotate(time * .6 + i); ellipse(c, 0, 0, 6, 3, '#efb7c4'); c.restore();
    }
    c.restore();
    for (const x of [330, 600, 870]) line(c, [x, 45, x, 343], '#c8a589', 10);
    rect(c, 35, 346, 1130, 17, 4, '#c8a080');
    plant(c, 103, 365, .8, true); plant(c, 1113, 365, .8, true);
    for (let x = 0; x < 1200; x += 150) { line(c, [x, 380, x, 462], '#d5c6b6', 2); }
    line(c, [0, 393, 1200, 393], '#d5c6b6', 3);
  }
  function festival(c, time, reduced) {
    const sky = c.createLinearGradient(0, 0, 0, 470); sky.addColorStop(0, '#59516d'); sky.addColorStop(1, '#b08a91');
    c.fillStyle = sky; c.fillRect(0, 0, 1200, 580);
    ellipse(c, 1110, 66, 28, 28, '#ffe6b8'); ellipse(c, 1120, 58, 26, 26, '#615771');
    for (let i = 0; i < 25; i++) {
      c.globalAlpha = .4 + .25 * Math.sin(i + (reduced ? 0 : time));
      star(c, (i * 193 + 47) % 1200, 25 + (i * 71) % 167, 2.5 + i % 3, '#ffedcb');
    }
    c.globalAlpha = 1;
    // Festival stalls, a little avenue, and scalloped cloth roofs.
    path(c, 'M0 238H406L451 465H0ZM794 238H1200V465H749Z', '#745247', null);
    rect(c, 43, 261, 305, 166, 2, '#b87f61'); rect(c, 850, 260, 307, 165, 2, '#bc8466');
    for (const x of [68, 270, 878, 1094]) rect(c, x, 254, 16, 199, 3, '#684c3e');
    for (const x of [0, 805]) {
      path(c, `M${x - 25} 227L${x + 43} 173H${x + 336}L${x + 407} 227Z`, '#ad6f68', '#6b4a43', 4);
      for (let j = 0; j < 5; j++) path(c, `M${x + j * 78} 226H${x + j * 78 + 75}V270Q${x + j * 78 + 37} 285 ${x + j * 78} 270Z`, j % 2 ? '#e4c19a' : '#c88a79', '#885a4c', 2);
    }
    rect(c, 132, 307, 159, 64, 4, '#f0d5a6', '#946449', 3); text(c, 'らーめん', 211, 349, 27, '#956148');
    tinyBowl(c, 932, 374, .8, '#c8d1b4'); tinyBowl(c, 1022, 374, .8, '#f0c4ad');
    path(c, 'M0 26Q600 171 1200 26', null, '#504449', 3);
    for (let i = 0; i < 11; i++) {
      const x = 50 + i * 110, y = 30 + 70 * Math.sin((i + .5) / 11 * Math.PI);
      c.save(); c.shadowColor = '#ffce83'; c.shadowBlur = 20;
      ellipse(c, x, y + 16, 11, 14, i % 2 ? '#f8d293' : '#f4b7a0'); c.restore();
      line(c, [x, y - 5, x, y + 3], '#504449', 3);
    }
    lantern(c, 410, 179, .6, '#edb491'); lantern(c, 790, 179, .6, '#f0c780');
    path(c, 'M465 464L547 246H653L735 464Z', '#d4b29a', null);
  }
  function table(c, level) {
    const top = ['#dfb481', '#c99c70', '#d7af8f', '#bc8d69'][level];
    c.fillStyle = top; c.fillRect(0, 457, 1200, 123);
    line(c, [0, 459, 1200, 459], '#a97850', 5);
    for (let i = 0; i < 4; i++) {
      const y = 479 + i * 31;
      path(c, `M0 ${y}Q235 ${y - 11} 450 ${y + 2}T920 ${y - 3}T1200 ${y + 2}`, null, '#af815923', 2);
    }
    for (const [x, color] of [[210, '#f4d890'], [600, '#e9b4b3'], [990, '#b8c9ad']]) {
      c.save(); c.globalAlpha = .8; rect(c, x - 147, 466, 294, 91, 20, color); c.restore();
      path(c, `M${x - 127} 479H${x + 127}M${x - 127} 544H${x + 127}`, null, '#fff5dd66', 2);
    }
    line(c, [0, 566, 1200, 566], '#a67650', 3);
    c.fillStyle = '#a87c56'; c.fillRect(0, 570, 1200, 10);
  }
  function blush(c, x, y, sx, shy) {
    c.save(); c.globalAlpha = shy ? .53 : .34;
    ellipse(c, x, y, 20 * sx, 12 * sx, '#ef9f88'); c.globalAlpha = .5;
    line(c, [x - 6, y - 2, x - 8, y + 3], '#df926c', 3);
    line(c, [x + 4, y - 2, x + 2, y + 3], '#df926c', 3); c.restore();
  }
  function eye(c, x, y, closed, scale = 1) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    if (closed) path(c, 'M-14 1Q0-12 14 1', null, '#3a2a20', 6);
    else { ellipse(c, 0, 0, 6, 9, '#422f25'); ellipse(c, 1.7, -3.2, 1.8, 2.2, '#fff9e6'); }
    c.restore();
  }
  function face(c, id, bite, t, done, shy, drinking) {
    const chew = bite > .67 && bite < 1;
    const slurp = bite > .35 && bite < .72;
    const closed = done || drinking || bite > .3 || Math.sin(t * .7 + id * 2) > .98;
    const puff = chew ? 1 + .13 * Math.sin(t * 28) : 1;
    if (id === 0) {
      path(c, 'M-70-245Q-48-254-30-246M30-246Q49-255 70-245', null, '#c48c61', 5);
      eye(c, -47, -211, closed, 1.03); eye(c, 47, -211, closed, 1.03);
      blush(c, -78, -179, puff, shy); blush(c, 78, -179, puff, shy);
      ellipse(c, 0, -186, 2.7, 3.5, '#eeb180');
      if (slurp || drinking) ellipse(c, 0, -157, 8, 10, '#98563e', '#71452e', 2.5);
      else {
        path(c, 'M-19-159Q0-141 20-159', null, '#70472e', 4.5);
        if (!chew) { path(c, 'M13-154Q15-171 24-166Q32-159 20-153Z', '#e89b81', '#70472e', 2.5); }
        if (chew) path(c, 'M-25-164Q-18-156-25-147', null, '#cc946c', 2.5);
      }
    } else {
      const ey = id === 1 ? -140 : -141;
      eye(c, -49, ey, closed, .78); eye(c, 48, ey - (id === 2 ? 6 : 0), closed, .78);
      blush(c, -84, -111, puff, shy); blush(c, 83, -108, puff, shy);
      if (id === 1) {
        if (slurp || drinking) ellipse(c, 0, -99, 7, 8, '#9a6857', '#594231', 2);
        else path(c, 'M-19-103Q-19-86-1-97Q10-83 21-99', null, '#503728', 4.5);
        path(c, 'M-108-128L-124-134M-109-111L-127-109M107-125L124-127M107-109L124-101', null, '#9d8771', 3.5);
      } else {
        path(c, 'M-26-114Q-8-141 15-123Q29-113 24-106Q6-98-20-100Q-31-101-26-114Z', '#efa139', '#8c5a26', 3.5);
        path(c, 'M-18-101Q1-84 20-102Z', slurp || drinking ? '#935624' : '#dc8d2c', '#8c5a26', 3);
      }
    }
  }
  function drawSprite(c, name, part) {
    const img = sprites[`${name}-${part}`];
    if (!img || !img.complete || !img.naturalWidth) return;
    if (name === 'ollie') {
      if (part === 'body') c.drawImage(img, -190, -410, 380, 450);
      else c.drawImage(img, -180, -410, 360, 310);
    } else if (part === 'body') c.drawImage(img, -145, -125, 290, 175);
    else if (name === 'cat') c.drawImage(img, -150, -290, 300, 250);
    else c.drawImage(img, -150, -280, 300, 250);
  }
  function arm(c, id, left, hx, hy, rotation = 0) {
    const color = id === 0 ? '#f8c89f' : id === 1 ? '#fff9ef' : '#ffdc70';
    const outline = id === 2 ? '#68502c' : OUTLINE;
    const sx = left ? -107 : 107, sy = id === 0 ? -65 : -38;
    c.beginPath(); c.moveTo(sx, sy);
    c.quadraticCurveTo(sx + (left ? -28 : 28), hy + 42, hx, hy);
    c.lineWidth = id === 0 ? 39 : 43; c.strokeStyle = outline; c.stroke();
    c.lineWidth -= 7; c.strokeStyle = color; c.stroke();
    c.save(); c.translate(hx, hy); c.rotate(rotation);
    ellipse(c, 0, 0, 23, id === 0 ? 28 : 24, color, outline, 3.5);
    if (id === 0) {
      path(c, 'M-7-16Q9-23 20-10M-7-4Q11-12 21-1M-4 9Q11 3 20 10', null, '#b88056', 2.8);
    } else if (id === 1) path(c, 'M-8-8L-6-3M2-12L4-5M12-8L13-2', null, '#cdbca6', 2);
    c.restore();
  }
  function sticks(c, x, y, tipX, tipY, id) {
    for (let k = 0; k < 2; k++) {
      const off = k * 10;
      line(c, [x - 24, y + off, tipX, tipY + k * 6], '#7b512c', 10);
      line(c, [x - 24, y + off - .6, tipX, tipY + k * 6 - .6], '#e8b66b', 5.5);
    }
  }
  function noodleStrands(c, x, startY, endY, time, amount = 4) {
    if (endY - startY < 3) return;
    for (let n = 0; n < amount; n++) {
      c.beginPath(); c.moveTo(x + n * 7 - amount * 3.5, startY);
      for (let yy = startY + 4; yy < endY; yy += 4) {
        c.lineTo(x + n * 7 - amount * 3.5 + Math.sin((yy - startY) * .09 + time * 7 + n * .4) * 3, yy);
      }
      c.strokeStyle = '#c28b3f'; c.lineWidth = 8; c.stroke();
      c.strokeStyle = '#ffe19a'; c.lineWidth = 4.5; c.stroke();
    }
  }
  function bowl(c, id, remaining, empty, gold = false) {
    const w = id === 0 ? 127 : 113;
    const body = gold ? '#eabb52' : ['#f1b4ad', '#b6c8ae', '#edcc8b'][id];
    // A deep curved ceramic body sits below the food ellipse. The old shallow
    // silhouette disappeared behind that ellipse and read as a plate.
    ellipse(c, 0, 78, w * .73, 10, '#79533620');
    rect(c, -42, 68, 84, 13, 7, gold ? '#b98c2f' : '#f7e6c9', '#9e7854', 3);
    const glaze = c.createLinearGradient(0, 11, 0, 74);
    glaze.addColorStop(0, gold ? '#f6d476' : body);
    glaze.addColorStop(1, gold ? '#d3a33f' : ['#e2a29b', '#9fb79a', '#dbb878'][id]);
    path(c, `M${-w}-6C${-w + 10} 45 ${-w + 48} 73 0 75C${w - 48} 73 ${w - 10} 45 ${w}-6Z`, glaze, '#906846', 4);
    path(c, `M${-w + 17} 24Q0 89 ${w - 17} 24`, null, gold ? '#ffedb0' : '#fff0d3', 9);
    ellipse(c, 0, -6, w, 40, '#fff2d7', '#906846', 4);
    ellipse(c, 0, -7, w - 12, 30, empty ? '#e9cf9d' : '#b77835', '#c59b64', 2.5);
    ellipse(c, 0, -10, w - 19, 24, empty ? '#f4e4bd' : '#cd9248');
    if (!empty && remaining > 0) {
      c.save(); c.beginPath(); c.ellipse(0, -7, w - 16, 25, 0, 0, TAU); c.clip();
      // Dense noodle coils diminish both in area and count with every portion.
      const count = Math.ceil(5 + remaining * 24), spread = .25 + .75 * remaining;
      for (let n = 0; n < count; n++) {
        const x = Math.sin(n * 2.4) * (w - 25) * spread, y = -8 + Math.cos(n * 1.7) * 17 * spread;
        path(c, `M${x - 17} ${y + 4}Q${x - 23} ${y - 11} ${x - 2} ${y - 10}T${x + 17} ${y + 1}`, null, '#b67a32', 8);
        path(c, `M${x - 17} ${y + 4}Q${x - 23} ${y - 11} ${x - 2} ${y - 10}T${x + 17} ${y + 1}`, null, '#ffe095', 4.5);
      }
      c.restore();
      if (remaining > .25) {
        c.save(); c.translate(w * .51, -19); c.rotate(.32);
        rect(c, -18, -26, 36, 46, 3, '#57632e', '#434b26', 2);
        path(c, 'M-11-21L-11 10M-3-21L-3 13M6-20L6 12M13-20L13 9', null, '#71783c', 2); c.restore();
      }
      if (remaining > .42) {
        c.save(); c.translate(-w * .43, -3); c.rotate(.25);
        ellipse(c, 0, 0, 30, 19, '#fff1ce', '#b98746', 3);
        ellipse(c, 2, 0, 14, 10, '#f4b447'); ellipse(c, 5, -2, 9, 6, '#ffc862'); c.restore();
      }
      if (remaining > .56) {
        c.save(); c.translate(w * .31, 8); c.rotate(-.2);
        ellipse(c, 0, 0, 24, 16, '#fff2da', '#e3c49c', 2);
        path(c, 'M-12 4C-22-12 12-17 14-2C16 10-8 11-6 1Q-4-5 5-1', null, '#e9959f', 4); c.restore();
      }
      for (let n = 0; n < Math.ceil(remaining * 7); n++) ellipse(c, -17 + Math.sin(n * 2) * 23, -10 + Math.cos(n * 3) * 12, 5, 4, '#86a342', '#6e8b33', 1.5);
    } else if (empty) {
      path(c, 'M-17-12Q0-2 16-11', null, '#d6be8f', 2);
      ellipse(c, 25, -9, 4, 2, '#d6be8f');
    }
    // The bowls have the same little smiling faces as the reference poster.
    path(c, 'M-22 50Q-17 45-12 50M12 50Q17 45 22 50M-7 55Q0 63 7 55', null, gold ? '#9d6c24' : '#9f704e', 2.5);
    if (gold) star(c, 0, 40, 7, '#fff1ac');
  }
  function animationFor(r, id, time) {
    const duration = [1.08, 1.23, .9][id];
    let state = cycles[id];
    if (!state) state = cycles[id] = { biteAt: -999, start: -999, until: -999 };
    if (r.biteAt !== state.biteAt && r.biteAt >= 0) {
      state.biteAt = r.biteAt; state.until = time + duration;
      if (time >= state.start + duration) state.start = time;
    }
    if (time >= state.start + duration && time < state.until) state.start += duration;
    const p = (time - state.start) / duration;
    return p >= 0 && p < 1 ? p : -1;
  }
  function character(c, id, r, time, result, winner, reduced, foreground) {
    const x = [600, 990, 210][id], base = 484;
    const a = animationFor(r, id, time);
    const drinking = r.stage === 'broth';
    const done = r.stage === 'done';
    const champion = result && winner === id;
    const cheering = result && winner !== id;
    const mouth = id === 0 ? -157 : -101;
    const peck = id === 2 && a >= 0 ? Math.sin(a * TAU) * 5 : 0;
    c.save(); c.translate(x, base); c.lineCap = 'round'; c.lineJoin = 'round';
    if (!foreground) {
      drawSprite(c, names[id], 'body');
      c.save(); c.translate(0, peck);
      drawSprite(c, names[id], 'head'); face(c, id, a, time, done || cheering, cheering, drinking);
      c.restore(); c.restore(); return;
    }
    let bowlY = 0, tilt = 0;
    if (drinking) {
      const p = clamp((time - (r.drinkAt ?? time)) / 2.8);
      const lift = p < .18 ? ease(p / .18) : p > .79 ? 1 - ease((p - .79) / .21) : 1;
      bowlY = (mouth + 35) * lift;
      tilt = p > .18 && p < .79 ? -.12 + Math.sin(time * 12) * .025 : 0;
    } else if (champion) {
      // Trophy goes above the forehead; the joyful face stays fully visible.
      const victoryLift = ease((time - (r.doneAt ?? time)) / .9);
      bowlY = (id === 0 ? -388 : -270) * victoryLift;
      tilt = reduced ? 0 : Math.sin(time * 2.5) * .035;
    }
    const holding = drinking || champion;
    if (holding) {
      arm(c, id, true, -101, bowlY + 2, -.3);
      arm(c, id, false, 101, bowlY + 2, .3);
    } else if (cheering) {
      const clap = reduced ? 0 : Math.sin(time * 8) * 12;
      const yy = id === 0 ? -75 : -61;
      arm(c, id, true, -24 - clap, yy, .4);
      arm(c, id, false, 24 + clap, yy, -.4);
    } else {
      // Independent shoulder/elbow, hand, chopstick and noodle trajectories.
      let lift = 0;
      if (a >= 0) lift = a < .35 ? ease(a / .35) : a < .72 ? 1 : 1 - ease((a - .72) / .28);
      const tipY = mix(-22, mouth + 10 + peck, lift), hx = id === 0 ? -107 : -93;
      const handY = mix(-15, mouth + 2 + peck, lift);
      if (a >= 0 && a < .75 && r.remaining > 0) {
        const end = a < .4 ? -10 : mix(-10, mouth + 11, ease((a - .4) / .35));
        noodleStrands(c, 1, tipY, Math.max(tipY, end), time, id === 1 ? 3 : 4);
      }
      sticks(c, hx, handY - 4, 10, tipY, id);
      arm(c, id, true, hx, handY + 5, -.13);
      arm(c, id, false, 105, 8, .2);
    }
    c.save(); c.translate(0, bowlY); c.rotate(tilt);
    const empty = done || champion || (drinking && time - r.drinkAt > 1.65);
    bowl(c, id, clamp(r.remaining), empty, champion && id === 0 && result === 'gold'); c.restore();
    // Steam rises from food, but disappears from a finished bowl.
    if (!empty && !holding && !reduced) for (let i = 0; i < 2; i++) {
      c.save(); c.globalAlpha = .16 + .1 * Math.sin(time * 1.6 + i * 3);
      const xx = (i ? 1 : -1) * 81, yy = -55 - ((time * 10 + i * 18) % 26);
      path(c, `M${xx} ${yy + 18}Q${xx - 10} ${yy + 6} ${xx} ${yy - 5}T${xx} ${yy - 24}`, null, '#fff8e5', 4); c.restore();
    }
    if (a > .4 && a < .9 && !holding && !reduced) {
      const yy = mouth - 38 - a * 24;
      c.globalAlpha = Math.sin((a - .4) / .5 * Math.PI);
      heart(c, id === 0 ? 137 : 114, yy, .34, '#e99d9c'); c.globalAlpha = 1;
    }
    if (champion) {
      for (let n = 0; n < 4; n++) {
        const angle = n * Math.PI / 2 + time * (reduced ? 0 : .2);
        star(c, Math.cos(angle) * 155, bowlY + Math.sin(angle) * 48 - 35, 10, '#f7ce69', angle);
      }
    }
    c.restore();
  }
  function draw(ctx, options) {
    const { width = 1200, height = 580, level = 0, time = 0, racers = [], winner = null, phase = 'menu', reducedMotion = false } = options;
    if (time < previousTime) cycles = [];
    previousTime = time;
    const scene = clamp(level, 0, 3);
    ctx.save(); ctx.scale(width / 1200, height / 580); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [kitchen, shop, sakura, festival][scene](ctx, time, reducedMotion);
    const defaults = { remaining: 1, stage: 'noodles', biteAt: -99, drinkAt: -99 };
    const people = names.map((_, id) => ({ ...defaults, ...racers[id] }));
    const result = phase === 'result' ? (scene === 3 && winner === 0 ? 'gold' : 'yes') : false;
    for (const id of [2, 0, 1]) character(ctx, id, people[id], time, result, winner, reducedMotion, false);
    table(ctx, scene);
    for (const id of [2, 0, 1]) character(ctx, id, people[id], time, result, winner, reducedMotion, true);
    if (result && !reducedMotion) for (let i = 0; i < 55; i++) {
      const px = (i * 97 + Math.sin(time * .7 + i) * 25) % 1200;
      const py = ((i * 53 + time * (23 + i % 11)) % 620) - 30;
      const color = ['#f2c35c', '#eea7af', '#a4c3ac', '#f5e4b8'][i % 4];
      ctx.save(); ctx.translate(px, py); ctx.rotate(time * .8 + i);
      if (i % 5 === 0) star(ctx, 0, 0, 7, color); else rect(ctx, -3, -6, 6, 12, 1, color);
      ctx.restore();
    }
    ctx.restore();
  }
  function load() {
    if (loaded) return loaded;
    loaded = Promise.all(names.flatMap(name => ['body', 'head'].map(part => new Promise((resolve, reject) => {
      const key = `${name}-${part}`, image = new Image(); sprites[key] = image;
      image.onload = resolve; image.onerror = () => reject(new Error(`Не удалось загрузить персонажа: ${key}`));
      image.src = `./assets/${key}.svg`;
    }))));
    return loaded;
  }
  window.RamenArt = { draw, load, reset() { cycles = []; previousTime = -1; } };
}());
