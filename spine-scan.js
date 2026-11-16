// Finds a book spine in a camera frame, the way a document scanner finds a page:
// the four edges of a tall quadrilateral, then a straightened crop of it.
'use strict';
window.SpineScan = (function () {
  const MAXD = 320;                       // detection works on a frame this size at most
  const SLOPES = [];                      // edge tilt allowed: about ±15 degrees
  for (let i = -10; i <= 10; i++) SLOPES.push(i * 0.027);

  function blur(c, w, h, tmp) {
    for (let y = 0; y < h; y++) {
      const r = y * w;
      tmp[r] = c[r]; tmp[r + w - 1] = c[r + w - 1];
      for (let x = 1; x < w - 1; x++) tmp[r + x] = (c[r + x - 1] + c[r + x] + c[r + x + 1]) / 3;
    }
    for (let x = 0; x < w; x++) { c[x] = tmp[x]; c[(h - 1) * w + x] = tmp[(h - 1) * w + x]; }
    for (let y = 1; y < h - 1; y++) {
      const r = y * w;
      for (let x = 0; x < w; x++) c[r + x] = (tmp[r + x - w] + tmp[r + x] + tmp[r + x + w]) / 3;
    }
  }

  // Colour-aware gradients: per pixel, the channel with the strongest edge wins,
  // so a red spine on a grey table of the same brightness still shows its edges.
  function gradients(img, w, h) {
    const n = w * h, tmp = new Float32Array(n);
    const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (let i = 0; i < n; i++) { ch[0][i] = img[i * 4]; ch[1][i] = img[i * 4 + 1]; ch[2][i] = img[i * 4 + 2]; }
    for (const c of ch) { blur(c, w, h, tmp); blur(c, w, h, tmp); }
    const gx = new Float32Array(n), gy = new Float32Array(n), mag = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let best = 0, bx = 0, by = 0;
      for (const c of ch) {
        const sx = (c[i - w + 1] + 2 * c[i + 1] + c[i + w + 1]) - (c[i - w - 1] + 2 * c[i - 1] + c[i + w - 1]);
        const sy = (c[i + w - 1] + 2 * c[i + w] + c[i + w + 1]) - (c[i - w - 1] + 2 * c[i - w] + c[i - w + 1]);
        const m = sx * sx + sy * sy;
        if (m > best) { best = m; bx = sx; by = sy; }
      }
      gx[i] = bx; gy[i] = by; mag[i] = Math.sqrt(best);
    }
    return {gx, gy, mag};
  }

  function threshold(mag) {
    const hist = new Uint32Array(512);
    let count = 0;
    for (let i = 0; i < mag.length; i++) { hist[Math.min(511, mag[i] >> 2)]++; count++; }
    let acc = 0, p95 = 0;
    for (let b = 0; b < 512; b++) { acc += hist[b]; if (acc >= count * 0.95) { p95 = b * 4; break; } }
    return Math.max(24, p95 * 0.35);
  }

  // Straight-line votes for edges that run roughly up-down (vertical) or left-right.
  function hough(g, w, h, thr, vertical) {
    const len = vertical ? w : h, span = Math.ceil(len * 0.3), stride = len + 2 * span;
    const acc = new Float32Array(SLOPES.length * stride);
    const half = (vertical ? h : w) / 2;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, m = g.mag[i];
      if (m < thr) continue;
      const ax = Math.abs(g.gx[i]), ay = Math.abs(g.gy[i]);
      if (vertical ? ax < 1.6 * ay : ay < 1.6 * ax) continue;
      const a = vertical ? x : y, b = (vertical ? y : x) - half;
      for (let k = 0; k < SLOPES.length; k++) {
        const pos = Math.round(a - SLOPES[k] * b) + span;
        if (pos >= 0 && pos < stride) acc[k * stride + pos] += m;
      }
    }
    const peaks = [];
    for (let k = 0; k < SLOPES.length; k++) for (let p = 1; p < stride - 1; p++) {
      const v = acc[k * stride + p];
      if (v <= 0) continue;
      let isMax = true;
      for (let dk = -2; dk <= 2 && isMax; dk++) {
        const kk = k + dk; if (kk < 0 || kk >= SLOPES.length) continue;
        for (let dp = -4; dp <= 4; dp++) {
          const pp = p + dp; if (pp < 0 || pp >= stride || (dk === 0 && dp === 0)) continue;
          const u = acc[kk * stride + pp];
          if (u > v || (u === v && (dk < 0 || (dk === 0 && dp < 0)))) { isMax = false; break; }
        }
      }
      if (isMax) peaks.push({s: SLOPES[k], c: p - span, v});
    }
    peaks.sort((a, b) => b.v - a.v);
    return peaks.slice(0, 10);
  }

  function intersect(V, H, w, h) {
    // V: x = V.c + V.s * (y - h/2); H: y = H.c + H.s * (x - w/2)
    const x = (V.c + V.s * (H.c - H.s * w / 2 - h / 2)) / (1 - V.s * H.s);
    return {x, y: H.c + H.s * (x - w / 2)};
  }

  // Share of points along a side that sit on a real edge facing the right way.
  function support(g, w, h, thr, p, q, vertical) {
    const L = Math.hypot(q.x - p.x, q.y - p.y), n = Math.max(8, Math.round(L / 2));
    let hit = 0;
    for (let i = 0; i <= n; i++) {
      const t = (i + 0.5) / (n + 1), x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
      let ok = false;
      for (let d = -2; d <= 2 && !ok; d++) {
        const xx = Math.round(vertical ? x + d : x), yy = Math.round(vertical ? y : y + d);
        if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
        const j = yy * w + xx;
        if (g.mag[j] < thr * 0.8) continue;
        const ax = Math.abs(g.gx[j]), ay = Math.abs(g.gy[j]);
        ok = vertical ? ax >= ay : ay >= ax;
      }
      if (ok) hit++;
    }
    return hit / (n + 1);
  }

  function detectIn(img, w, h) {
    const g = gradients(img, w, h), thr = threshold(g.mag);
    const vs = hough(g, w, h, thr, true), hs = hough(g, w, h, thr, false);
    let best = null;
    const big = Math.max(w, h), m = 3;
    for (let a = 0; a < vs.length; a++) for (let b = 0; b < vs.length; b++) {
      const Lv = vs[a], Rv = vs[b];
      if (Rv.c - Lv.c < 6) continue;
      for (let c = 0; c < hs.length; c++) for (let d = 0; d < hs.length; d++) {
        const Tv = hs[c], Bv = hs[d];
        if (Bv.c - Tv.c < big * 0.25) continue;
        const tl = intersect(Lv, Tv, w, h), tr = intersect(Rv, Tv, w, h), br = intersect(Rv, Bv, w, h), bl = intersect(Lv, Bv, w, h);
        if ([tl, tr, br, bl].some(p => p.x < -m || p.y < -m || p.x > w + m || p.y > h + m)) continue;
        const wid = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2;
        const hei = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2;
        if (wid < 6 || hei / wid < 1.6 || hei / wid > 40) continue;
        const sides = [support(g, w, h, thr, tl, bl, true), support(g, w, h, thr, tr, br, true),
                       support(g, w, h, thr, tl, tr, false), support(g, w, h, thr, bl, br, false)];
        const minS = Math.min(...sides);
        if (minS < 0.55) continue;
        const score = 2 * minS + sides.reduce((s, v) => s + v, 0) / 4 + 0.8 * (wid * hei) / (w * h);
        if (!best || score > best.score) best = {score, corners: [tl, tr, br, bl], minSupport: minS};
      }
    }
    return best;
  }

  const work = document.createElement('canvas');
  // source: a video, image or canvas; sw, sh: its pixel size. Corners come back in source pixels.
  function detect(source, sw, sh) {
    const s = Math.min(1, MAXD / Math.max(sw, sh)), w = Math.round(sw * s), h = Math.round(sh * s);
    work.width = w; work.height = h;
    const ctx = work.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(source, 0, 0, w, h);
    const found = detectIn(ctx.getImageData(0, 0, w, h).data, w, h);
    if (!found) return null;
    found.corners = found.corners.map(p => ({x: p.x / s, y: p.y / s}));
    return found;
  }

  // Maps the unit square's corners onto the four points (projective transform).
  function homography(dst) {
    const src = [[0, 0], [1, 0], [1, 1], [0, 1]], A = [], B = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], X = dst[i].x, Y = dst[i].y;
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); B.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); B.push(Y);
    }
    for (let c = 0; c < 8; c++) {                       // Gaussian elimination
      let piv = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]]; [B[c], B[piv]] = [B[piv], B[c]];
      for (let r = 0; r < 8; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
        B[r] -= f * B[c];
      }
    }
    const h = B.map((v, i) => v / A[i][i]);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  // Straightens the quadrilateral into an upright image. ratio = thickness / height.
  function warp(frame, corners, outH) {
    const [tl, tr, br, bl] = corners;
    const wid = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2;
    const hei = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2;
    const ratio = Math.min(0.7, Math.max(0.02, wid / hei));
    const H = outH || 640, W = Math.max(12, Math.round(H * ratio));
    const M = homography(corners);
    const sw = frame.width, sh = frame.height;
    const src = frame.getContext('2d').getImageData(0, 0, sw, sh).data;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const octx = out.getContext('2d'), od = octx.createImageData(W, H), o = od.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = (y + 0.5) / H, z = M[6] * u + M[7] * v + 1;
      const fx = Math.min(sw - 1.001, Math.max(0, (M[0] * u + M[1] * v + M[2]) / z - 0.5));
      const fy = Math.min(sh - 1.001, Math.max(0, (M[3] * u + M[4] * v + M[5]) / z - 0.5));
      const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, i = (y0 * sw + x0) * 4, j = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i + c] * (1 - ax) + src[i + 4 + c] * ax;
        const bot = src[i + sw * 4 + c] * (1 - ax) + src[i + sw * 4 + 4 + c] * ax;
        o[j + c] = top * (1 - ay) + bot * ay;
      }
      o[j + 3] = 255;
    }
    octx.putImageData(od, 0, 0);
    return {canvas: out, ratio};
  }

  return {detect, warp, _detectIn: detectIn};
})();
