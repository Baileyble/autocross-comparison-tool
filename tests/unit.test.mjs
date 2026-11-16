import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustedTime, effectiveFinish, runKnots, matchKnots, Warp, splitTable, fmtTime, fmtDelta, parseTime,
  parseYouTubeId, parseYouTubeStart, bestRun,
} from '../js/model.js';
import { motionSegments, detectLaunch, refineOnset, dtw, alignRuns, normalizeFrame, changedFraction } from '../js/signal.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b} (±${eps})`);

test('adjusted time applies cone penalty and ignores DNF', () => {
  assert.equal(adjustedTime({ rawTime: 50, cones: 2 }, 2), 54);
  assert.equal(adjustedTime({ rawTime: 50, cones: 1, status: 'ok' }, 1), 51);
  assert.equal(adjustedTime({ rawTime: 50, status: 'dnf' }), null);
  assert.equal(adjustedTime({ rawTime: null }), null);
  const best = bestRun([{ id: 1, rawTime: 50, cones: 2 }, { id: 2, rawTime: 52 }, { id: 3, rawTime: 40, status: 'off' }]);
  assert.equal(best.id, 2);
});

test('effective finish falls back to start + raw time', () => {
  assert.equal(effectiveFinish({ markers: { start: 10, finish: 60 } }), 60);
  assert.equal(effectiveFinish({ rawTime: 45.5, markers: { start: 10 } }), 55.5);
  assert.equal(effectiveFinish({ rawTime: 45.5, markers: {} }), null);
});

const event = { splits: [{ id: 's1', name: 'Slalom' }, { id: 's2', name: 'Turnaround' }] };

test('runKnots orders by course and drops non-monotonic marks', () => {
  const k = runKnots({ markers: { start: 5, finish: 55, splits: { s1: 15, s2: 12 } } }, event);
  assert.deepEqual(k.map((x) => x.key), ['start', 's1', 'finish']);
  assert.deepEqual(k.map((x) => x.t), [0, 10, 50]);
});

test('matchKnots matches by id on same course and by name across events', () => {
  const ka = runKnots({ markers: { start: 0, finish: 50, splits: { s1: 10 } } }, event);
  const ev2 = { splits: [{ id: 'x', name: ' slalom ' }] };
  const kb = runKnots({ markers: { start: 2, finish: 54, splits: { x: 13 } } }, ev2);
  const same = matchKnots(ka, kb, true);
  assert.deepEqual(same.map((p) => p.key), ['start', 'finish']);
  const cross = matchKnots(ka, kb, false);
  assert.deepEqual(cross.map((p) => [p.tA, p.tB]), [[0, 0], [10, 11], [50, 52]]);
});

test('Warp maps, inverts and extrapolates with slope 1', () => {
  const w = new Warp([[0, 0], [10, 11], [50, 52]]);
  near(w.map(5), 5.5);
  near(w.map(30), 11 + 20 * (41 / 40));
  near(w.map(-2), -2);
  near(w.map(60), 62);
  near(w.inverse(w.map(33.3)), 33.3);
  near(w.slope(5), 1.1);
  near(w.delta(10), 1);
  assert.equal(w.slope(100), 1);
  const id = new Warp([]);
  near(id.map(12), 12);
  assert.equal(id.informative, false);
});

test('splitTable computes segments, best and theoretical best', () => {
  const runs = [
    { id: 'a', markers: { start: 0, finish: 50, splits: { s1: 10, s2: 30 } } },
    { id: 'b', markers: { start: 0, finish: 49, splits: { s1: 11, s2: 29 } } },
  ];
  const t = splitTable(runs, event);
  assert.equal(t.segments.length, 3);
  assert.deepEqual(t.rows[0].times, [10, 20, 20]);
  assert.deepEqual(t.rows[1].times, [11, 18, 20]);
  assert.deepEqual(t.best, [10, 18, 20]);
  assert.equal(t.theoretical, 48);
});

test('time formatting and parsing', () => {
  assert.equal(fmtTime(45.1234), '45.123');
  assert.equal(fmtTime(59.9996), '1:00.000');
  assert.equal(fmtTime(65.5, 2), '1:05.50');
  assert.equal(fmtTime(null), '—');
  assert.equal(fmtDelta(0.1234), '+0.123');
  assert.equal(fmtDelta(-1.5, 2), '−1.50');
  assert.equal(fmtDelta(0.0001), '±0.000');
  assert.equal(parseTime('45,5'), 45.5);
  assert.equal(parseTime('1:05.25'), 65.25);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseTime(''), null);
});

test('YouTube URL parsing', () => {
  assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s'), 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=5'), 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeId('https://example.com/x'), null);
  assert.equal(parseYouTubeStart('https://youtu.be/dQw4w9WgXcQ?t=1m5s'), 65);
  assert.equal(parseYouTubeStart('https://youtu.be/dQw4w9WgXcQ?t=42'), 42);
});

// Synthetic activity: idle noise, short creep at 3-5s, idle, run from 12s to 60s.
function syntheticActivity() {
  const times = [], act = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < 70; t += 0.1) {
    times.push(t);
    let v = 0.02 + rnd() * 0.03;
    if (t > 3 && t < 5) v = 0.5;
    if (t >= 12.05 && t < 60) v = Math.min(0.8, 0.2 + (t - 12) * 0.3) + rnd() * 0.05;
    act.push(v);
  }
  return { times: Float32Array.from(times), act: Float32Array.from(act) };
}

test('detectLaunch skips the creep to the line and finds the run onset', () => {
  const { times, act } = syntheticActivity();
  const segs = motionSegments(times, act, { minDuration: 1 });
  assert.equal(segs.length, 2);
  const L = detectLaunch(times, act);
  assert.ok(L, 'launch found');
  near(L.t, 12.0, 0.15);
});

test('refineOnset finds frame where frame-difference rises', () => {
  const times = [], diffs = [];
  for (let i = 0; i < 60; i++) { const t = i / 30; times.push(t); diffs.push(t < 1.0 ? 0.01 : Math.min(0.6, 0.01 + (t - 1.0) * 3)); }
  const t = refineOnset(times, diffs);
  near(t, 1.0, 1 / 30 + 1e-6);
});

// ---- DTW alignment on synthetic "course" features ----
// A 1-D world texture; a run = camera position over time; frame = window of the texture at that position.
function makeWorld(len, seed = 3) {
  const w = new Float32Array(len);
  let s = seed;
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  let v = 128;
  for (let i = 0; i < len; i++) { v += (rnd() - 0.5) * 60; v = Math.max(0, Math.min(255, v)); w[i] = v; }
  return w;
}
function renderRun(world, posOfT, dur, hz, size = 64) {
  const times = [], frames = new Uint8Array(Math.ceil(dur * hz + 1) * size);
  let k = 0;
  for (let t = 0; t <= dur + 1e-9; t += 1 / hz, k++) {
    times.push(t);
    const p = posOfT(t);
    for (let x = 0; x < size; x++) {
      const f = p + x;
      const i0 = Math.floor(f), fr = f - i0;
      frames[k * size + x] = Math.round(world[i0] * (1 - fr) + world[i0 + 1] * fr);
    }
  }
  return { times: Float32Array.from(times), frames: frames.subarray(0, k * size), size };
}

test('alignRuns recovers the time mapping between two runs over the same course', () => {
  const world = makeWorld(4000);
  const L = 3000;
  // Run A: constant speed over 50s. Run B: slower in the first half, then catches up; 52s total.
  const durA = 50, durB = 52;
  const posA = (t) => (t / durA) * L;
  // B position: piecewise so that B reaches the halfway point at t=28 (A at 25)
  const posB = (t) => (t < 28 ? (t / 28) * (L / 2) : L / 2 + ((t - 28) / 24) * (L / 2));
  const A = renderRun(world, posA, durA, 15);
  const B = renderRun(world, posB, durB, 15);
  const res = alignRuns({ ...A, start: 0, finish: durA }, { ...B, start: 0, finish: durB }, 8);
  assert.ok(res, 'alignment found');
  const w = new Warp(res.knots);
  // Truth: B time to reach A's position at tA.
  const truth = (tA) => { const p = posA(tA); return p < L / 2 ? (p / (L / 2)) * 28 : 28 + ((p - L / 2) / (L / 2)) * 24; };
  for (const tA of [5, 12.5, 20, 25, 30, 40, 45]) near(w.map(tA), truth(tA), 0.6);
  near(w.map(50), 52, 1e-6);
});

test('frame helpers', () => {
  const a = new Uint8Array([0, 10, 20, 30]);
  const b = new Uint8Array([0, 40, 20, 0]);
  assert.equal(changedFraction(a, b, 14), 0.5);
  const n = normalizeFrame(a);
  near(n.reduce((s, v) => s + v * v, 0), 1, 1e-5);
  const r = dtw([n, n], [n, n, n]);
  assert.ok(r && r.path.length >= 2);
});

test('theoretical best ignores DNF/off-course runs and is never slower than a real total', () => {
  const ev = { splits: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }] };
  const runs = [
    { id: 'clean', markers: { start: 0, finish: 46, splits: { s1: 10, s2: 30 } } },
    { id: 'cut', status: 'off', markers: { start: 0, finish: 43, splits: { s1: 10, s2: 27 } } },
  ];
  assert.equal(splitTable(runs, ev).theoretical, 46);
  // Fast run with only start/finish marked caps the theoretical best.
  const runs2 = [
    { id: 'fast', markers: { start: 0, finish: 44, splits: {} } },
    { id: 'slow', markers: { start: 0, finish: 45, splits: { s1: 10, s2: 30 } } },
  ];
  assert.equal(splitTable(runs2, ev).theoretical, 44);
});

test('motion segments are found in a long recording with little driving', () => {
  const times = [], act = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // 30 minutes at 7.5 Hz, three 55 s runs
  for (let t = 0; t < 1800; t += 1 / 7.5) {
    times.push(t);
    const driving = [300, 900, 1500].some((s) => t >= s && t < s + 55);
    act.push(driving ? 0.3 + rnd() * 0.1 : 0.01 + rnd() * 0.01);
  }
  const segs = motionSegments(Float32Array.from(times), Float32Array.from(act), { minDuration: 15, mergeGap: 2.5 });
  assert.equal(segs.length, 3);
  segs.forEach((s, i) => near(s.onset, [300, 900, 1500][i], 0.3));
  const one = detectLaunch(Float32Array.from(times.slice(0, 4500)), Float32Array.from(act.slice(0, 4500)));
  near(one.t, 300, 0.3);
});
