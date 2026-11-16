// Pure signal processing: motion-based launch detection and video-content alignment (DTW).
// Operates on plain typed arrays so it can be unit-tested in Node.

import { percentile } from './model.js';

/** Centered moving average over a time window (seconds) on irregularly sampled data. */
export function smoothByTime(times, values, win) {
  const n = values.length;
  const out = new Float32Array(n);
  let lo = 0, hi = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    while (hi < n && times[hi] <= times[i] + win / 2) sum += values[hi++];
    while (times[lo] < times[i] - win / 2) sum -= values[lo++];
    out[i] = sum / Math.max(1, hi - lo);
  }
  return out;
}

/**
 * Find stretches where the camera is moving (car driving) using a per-sample "activity" signal
 * (fraction of pixels that changed between consecutive samples).
 * Returns [{start, end, onset, peak}] sorted by time. `onset` is the refined motion start.
 */
export function motionSegments(times, act, opts = {}) {
  const { minDuration = 6, mergeGap = 1.0, smoothWin = 0.6 } = opts;
  const n = act.length;
  if (n < 5) return [];
  const base = percentile(act, 0.2);
  const high = percentile(act, 0.9);
  if (high - base < 0.04) return [];
  const s = smoothByTime(times, act, smoothWin);
  const thrOn = base + 0.35 * (high - base);
  const segs = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    if (s[i] > thrOn) {
      if (!cur) cur = { i0: i, i1: i };
      else cur.i1 = i;
    } else if (cur && times[i] - times[cur.i1] > mergeGap) {
      segs.push(cur); cur = null;
    }
  }
  if (cur) segs.push(cur);
  const onsetThr = base + 0.12 * (high - base);
  const out = [];
  for (const sg of segs) {
    const start = times[sg.i0], end = times[sg.i1];
    if (end - start < minDuration) continue;
    // Walk back to where raw activity first left the idle baseline.
    let j = sg.i0;
    while (j > 0 && act[j - 1] > onsetThr && times[sg.i0] - times[j - 1] < 2) j--;
    // Sample k's activity measures change between samples k-1 and k, so motion started around times[k-1].
    const onset = j > 0 ? (times[j - 1] + times[j]) / 2 : times[j];
    let peak = 0;
    for (let k = sg.i0; k <= sg.i1; k++) peak = Math.max(peak, s[k]);
    out.push({ start, end, onset, peak, duration: end - start });
  }
  // Merge segments separated by short gaps after the duration filter is not needed; keep order.
  return out;
}

/**
 * Best guess for the launch in a single-run clip: the onset of the longest motion segment.
 * (Rolling up to the start line is a short motion segment, so it's skipped.)
 */
export function detectLaunch(times, act) {
  const segs = motionSegments(times, act, { minDuration: 4 });
  if (!segs.length) return null;
  let best = segs[0];
  for (const s of segs) if (s.duration > best.duration) best = s;
  const conf = Math.min(1, best.duration / 25) * Math.min(1, best.peak / 0.25);
  return { t: best.onset, confidence: conf, segment: best, segments: segs };
}

/**
 * Refine a launch estimate from a frame-by-frame sequence of "difference vs a still reference frame".
 * diffs[i] at times[i]; returns first time crossing base + 20% of the rise.
 */
export function refineOnset(times, diffs) {
  const n = diffs.length;
  if (n < 8) return null;
  const base = percentile(Array.from(diffs).slice(0, Math.max(3, Math.floor(n * 0.15))), 0.5);
  const end = percentile(Array.from(diffs).slice(Math.floor(n * 0.85)), 0.5);
  if (end - base < 0.03) return null;
  const thr = base + 0.2 * (end - base);
  for (let i = 1; i < n; i++) {
    // require it to stay above for 3 frames to ignore single-frame noise
    if (diffs[i] > thr && (i + 2 >= n || (diffs[i + 1] > thr && diffs[i + 2] > thr))) return times[i - 1];
  }
  return null;
}

// ---------- frame features ----------

/** Fraction of pixels whose absolute difference exceeds `thr` (0..255). */
export function changedFraction(a, b, thr = 14) {
  let c = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > thr) c++;
  return c / a.length;
}

/** Zero-mean, unit-L2 version of a grayscale frame (for correlation distance). */
export function normalizeFrame(u8) {
  const n = u8.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += u8[i];
  mean /= n;
  const out = new Float32Array(n);
  let ss = 0;
  for (let i = 0; i < n; i++) { const v = u8[i] - mean; out[i] = v; ss += v * v; }
  const norm = Math.sqrt(ss) || 1;
  for (let i = 0; i < n; i++) out[i] /= norm;
  return out;
}

/**
 * Resample stored frames onto a uniform time grid [t0, t1] at `hz`.
 * frames: Uint8Array of N*size, times: Float32Array(N). Returns array of normalized Float32Array.
 */
export function resampleFeatures(times, frames, size, t0, t1, hz) {
  const out = [];
  const n = times.length;
  if (!n) return out;
  let j = 0;
  for (let t = t0; t <= t1 + 1e-9; t += 1 / hz) {
    while (j < n - 2 && times[j + 1] < t) j++;
    // nearest of j, j+1
    const k = j + 1 < n && Math.abs(times[j + 1] - t) < Math.abs(times[j] - t) ? j + 1 : j;
    out.push(normalizeFrame(frames.subarray(k * size, (k + 1) * size)));
  }
  return out;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Dynamic time warping with slope constraint (local slopes between 1/2 and 2),
 * anchored at both ends. A and B are arrays of normalized feature vectors.
 * Returns { path: [[i,j],...], cost } where cost is mean frame distance along the path.
 */
export function dtw(A, B, { band = null } = {}) {
  const n = A.length, m = B.length;
  if (!n || !m) return null;
  if (m > 2 * n + 1 || n > 2 * m + 1) return null;
  const INF = Infinity;
  const W = band == null ? Math.max(n, m) : band;
  const D = new Float64Array(n * m).fill(INF);
  const P = new Int8Array(n * m);
  const dcache = new Float32Array(n * m).fill(-1);
  const d = (i, j) => {
    const idx = i * m + j;
    let v = dcache[idx];
    if (v < 0) { v = 1 - dot(A[i], B[j]); dcache[idx] = v; }
    return v;
  };
  const ratio = (m - 1) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const jc = i * ratio;
    const j0 = Math.max(0, Math.floor(jc - W)), j1 = Math.min(m - 1, Math.ceil(jc + W));
    for (let j = j0; j <= j1; j++) {
      const idx = i * m + j;
      if (i === 0 && j === 0) { D[idx] = d(0, 0); continue; }
      let best = INF, choice = 0;
      if (i >= 1 && j >= 1) { const v = D[(i - 1) * m + j - 1]; if (v < best) { best = v; choice = 1; } }
      if (i >= 1 && j >= 2) { const v = D[(i - 1) * m + j - 2]; if (v < INF) { const c = v + d(i, j - 1); if (c < best) { best = c; choice = 2; } } }
      if (i >= 2 && j >= 1) { const v = D[(i - 2) * m + j - 1]; if (v < INF) { const c = v + d(i - 1, j); if (c < best) { best = c; choice = 3; } } }
      if (best < INF) { D[idx] = best + d(i, j); P[idx] = choice; }
    }
  }
  if (!(D[n * m - 1] < INF)) return null;
  const path = [];
  let i = n - 1, j = m - 1;
  while (true) {
    path.push([i, j]);
    if (i === 0 && j === 0) break;
    const c = P[i * m + j];
    if (c === 1) { i--; j--; }
    else if (c === 2) { path.push([i, j - 1]); i--; j -= 2; }
    else if (c === 3) { path.push([i - 1, j]); i -= 2; j--; }
    else break;
  }
  path.reverse();
  return { path, cost: D[n * m - 1] / path.length };
}

/**
 * Convert a DTW path between uniformly sampled sequences into smooth monotonic knots
 * [[tA, tB], ...] in course time, spaced roughly every `step` seconds of A.
 */
export function pathToKnots(path, hz, durA, durB, step = 0.5, smoothSec = 1.0) {
  const n = Math.round(durA * hz) + 1;
  const sum = new Float64Array(n), cnt = new Float64Array(n);
  for (const [i, j] of path) { if (i < n) { sum[i] += j; cnt[i]++; } }
  const jOfI = new Float64Array(n);
  for (let i = 0; i < n; i++) jOfI[i] = cnt[i] ? sum[i] / cnt[i] : (i ? jOfI[i - 1] : 0);
  // smooth
  const w = Math.max(1, Math.round(smoothSec * hz / 2));
  const sm = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = Math.max(0, i - w); k <= Math.min(n - 1, i + w); k++) { s += jOfI[k]; c++; }
    sm[i] = s / c;
  }
  const knots = [[0, 0]];
  const stepI = Math.max(1, Math.round(step * hz));
  for (let i = stepI; i < n - stepI / 2; i += stepI) {
    const tA = i / hz, tB = sm[i] / hz;
    const last = knots[knots.length - 1];
    if (tA > last[0] + 1e-6 && tB > last[1] + 1e-6 && tB < durB) knots.push([tA, tB]);
  }
  const last = knots[knots.length - 1];
  if (durA > last[0] && durB > last[1]) knots.push([durA, durB]);
  return knots;
}

/**
 * Full alignment from stored analysis samples of two runs.
 * a/b: { times, frames, size, start, finish } (video times). Returns { knots, cost } or null.
 */
export function alignRuns(a, b, hz = 8) {
  const durA = a.finish - a.start, durB = b.finish - b.start;
  if (!(durA > 1 && durB > 1)) return null;
  const FA = resampleFeatures(a.times, a.frames, a.size, a.start, a.finish, hz);
  const FB = resampleFeatures(b.times, b.frames, b.size, b.start, b.finish, hz);
  // Allow up to 15% + 3 s of local disagreement around the straight line.
  const band = Math.ceil((0.15 * Math.max(durA, durB) + 3) * hz);
  const res = dtw(FA, FB, { band });
  if (!res) return null;
  const knots = pathToKnots(res.path, hz, (FA.length - 1) / hz, (FB.length - 1) / hz);
  // Scale so the last knot lands exactly on the finish markers.
  const kA = durA / knots[knots.length - 1][0], kB = durB / knots[knots.length - 1][1];
  return { knots: knots.map(([x, y]) => [x * kA, y * kB]), cost: res.cost };
}
