// Browser-side video analysis: one fast muted playback pass extracts a tiny grayscale
// fingerprint per sampled frame (used for motion detection + run-to-run alignment),
// plus an audio loudness envelope. Results are cached per video in IndexedDB.

import * as store from './store.js';
import { changedFraction, detectLaunch, refineOnset } from './signal.js';

export const ANALYSIS_VERSION = 2;
export const FW = 48, FH = 27;
const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 100, 119.88, 120, 240];

function hiddenVideo(src) {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.crossOrigin = 'anonymous';
  v.src = src;
  // Keep it inside the viewport (some browsers throttle off-screen media), but invisible.
  Object.assign(v.style, { position: 'fixed', left: '0', bottom: '0', width: '8px', height: '8px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
  document.body.appendChild(v);
  return v;
}

const once = (el, ev) => new Promise((res, rej) => {
  const ok = () => { cleanup(); res(); };
  const bad = () => { cleanup(); rej(new Error(el.error ? 'Video could not be decoded by this browser.' : 'Video error')); };
  const cleanup = () => { el.removeEventListener(ev, ok); el.removeEventListener('error', bad); };
  el.addEventListener(ev, ok); el.addEventListener('error', bad);
});

async function seekTo(v, t) {
  if (Math.abs(v.currentTime - t) < 1e-4 && !v.seeking) return;
  const p = once(v, 'seeked');
  v.currentTime = t;
  await p;
}

function grayFrame(ctx, v, w, h) {
  ctx.drawImage(v, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  return g;
}

function snapFps(f) {
  if (!(f > 5 && f < 1000)) return null;
  let best = f, bd = Infinity;
  for (const c of COMMON_FPS) { const d = Math.abs(c - f) / c; if (d < bd) { bd = d; best = c; } }
  return bd < 0.04 ? best : Math.round(f);
}

/** Estimate frame rate by playing ~0.5 s at 1x and reading presented frame timestamps. */
async function estimateFps(v) {
  if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) return null;
  const ts = [];
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; v.pause(); resolve(); } };
    const cb = (_, meta) => {
      ts.push(meta.mediaTime);
      if (ts.length >= 24) finish(); else v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
    v.playbackRate = 1;
    v.play().catch(finish);
    setTimeout(finish, 1500);
  });
  const d = [];
  for (let i = 1; i < ts.length; i++) { const x = ts[i] - ts[i - 1]; if (x > 0.001) d.push(x); }
  if (d.length < 5) return null;
  d.sort((a, b) => a - b);
  return snapFps(1 / d[Math.floor(d.length * 0.25)]); // lower quartile: robust to dropped frames
}

/**
 * Analyze a video Blob/File (or URL). Returns {version, duration, fps, W, H, times, act, frames, audio}.
 */
export async function analyzeVideo(source, { onProgress = () => {}, signal } = {}) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const v = hiddenVideo(url);
  const canvas = document.createElement('canvas');
  canvas.width = FW; canvas.height = FH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  try {
    if (v.readyState < 1) await once(v, 'loadedmetadata');
    const duration = v.duration;
    if (!isFinite(duration) || duration <= 0) throw new Error('Could not read video duration.');
    const fps = await estimateFps(v);
    await seekTo(v, 0);

    const times = [], act = [], chunks = [];
    let prev = null, lastT = -1;
    const rate = duration < 15 ? 4 : 8;
    const minGap = 0.08;
    const push = (t) => {
      if (t - lastT < minGap) return;
      let g;
      try { g = grayFrame(ctx, v, FW, FH); } catch (e) { throw new Error('Cannot read video pixels (cross-origin video?).'); }
      times.push(t);
      act.push(prev ? changedFraction(prev, g) : 0);
      chunks.push(g);
      prev = g; lastT = t;
    };

    await new Promise((resolve, reject) => {
      let finished = false, lastProgress = performance.now();
      const done = (err) => {
        if (finished) return;
        finished = true;
        clearInterval(watchdog);
        document.removeEventListener('visibilitychange', onVis);
        v.pause();
        err ? reject(err) : resolve();
      };
      const onVis = () => { if (document.hidden) v.pause(); else if (!finished) v.play().catch(() => {}); };
      document.addEventListener('visibilitychange', onVis);
      const step = (t) => {
        try { push(t); } catch (e) { return done(e); }
        lastProgress = performance.now();
        onProgress(Math.min(1, t / duration));
      };
      if ('requestVideoFrameCallback' in v) {
        const cb = (_, meta) => { if (finished) return; step(meta.mediaTime); v.requestVideoFrameCallback(cb); };
        v.requestVideoFrameCallback(cb);
      } else {
        const tick = () => { if (finished) return; step(v.currentTime); requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
      v.addEventListener('ended', () => done(), { once: true });
      const watchdog = setInterval(() => {
        if (signal?.aborted) return done(new Error('Cancelled'));
        if (document.hidden) { lastProgress = performance.now(); return; }
        if (performance.now() - lastProgress > 15000) done(times.length > 20 ? null : new Error('Video playback stalled during analysis.'));
      }, 1000);
      v.playbackRate = rate;
      v.play().catch((e) => done(new Error('Playback refused: ' + e.message)));
    });

    const N = times.length;
    const frames = new Uint8Array(N * FW * FH);
    chunks.forEach((c, i) => frames.set(c, i * FW * FH));
    let audio = null;
    if (typeof source !== 'string') audio = await audioEnvelope(source).catch((e) => { console.warn('audio', e); return null; });
    return { version: ANALYSIS_VERSION, duration, fps, W: FW, H: FH, times: Float32Array.from(times), act: Float32Array.from(act), frames, audio };
  } finally {
    v.pause();
    v.remove();
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

/** Loudness envelope at 50 Hz (RMS, normalized 0..1). */
export async function audioEnvelope(file) {
  if (file.size > 800e6) return null;
  const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AC) return null;
  const buf = await file.arrayBuffer();
  const ctx = new AC(1, 1, 22050);
  const ab = await ctx.decodeAudioData(buf);
  const hz = 50;
  const win = Math.floor(ab.sampleRate / hz);
  const n = Math.floor(ab.length / win);
  const env = new Float32Array(n);
  const chans = [];
  for (let c = 0; c < ab.numberOfChannels; c++) chans.push(ab.getChannelData(c));
  let max = 1e-9;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const ch of chans) for (let k = i * win; k < (i + 1) * win; k++) s += ch[k] * ch[k];
    env[i] = Math.sqrt(s / (win * chans.length));
    if (env[i] > max) max = env[i];
  }
  for (let i = 0; i < n; i++) env[i] /= max;
  return { hz, env };
}

/** Frame-accurate launch refinement around an estimate, by seeking frame by frame. */
export async function refineLaunch(source, approx, fps = 30) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const v = hiddenVideo(url);
  const W = 96, H = 54;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  try {
    if (v.readyState < 1) await once(v, 'loadedmetadata');
    const f = fps || 30;
    const t0 = Math.max(0, approx - 0.8), t1 = Math.min(v.duration - 0.05, approx + 0.6);
    await seekTo(v, t0);
    const ref = grayFrame(ctx, v, W, H);
    const times = [], diffs = [];
    for (let t = t0 + 1 / f; t <= t1; t += 1 / f) {
      await seekTo(v, t);
      times.push(t);
      diffs.push(changedFraction(ref, grayFrame(ctx, v, W, H), 12));
    }
    return refineOnset(times, diffs);
  } finally {
    v.remove();
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

/** Small JPEG thumbnail at time t. */
export async function captureThumb(source, t) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const v = hiddenVideo(url);
  try {
    if (v.readyState < 1) await once(v, 'loadedmetadata');
    await seekTo(v, Math.max(0, Math.min(v.duration - 0.1, t)));
    if (v.readyState < 2) await once(v, 'loadeddata');
    const w = 240, h = Math.round(240 * (v.videoHeight / v.videoWidth || 9 / 16));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(v, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.7);
  } catch { return null; } finally {
    v.remove();
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

// ---------- background queue ----------
const status = new Map(); // videoId -> {state:'queued'|'running'|'done'|'error', progress, error}
const subs = new Set();
const queue = [];
let running = false;

export function onAnalysis(fn) { subs.add(fn); return () => subs.delete(fn); }
function notify() { for (const fn of subs) fn(status); }
export function analysisStatus(videoId) { return status.get(videoId) || null; }
export function activeJobs() { return [...status.values()].filter((s) => s.state === 'queued' || s.state === 'running'); }

export async function getAnalysis(videoId) {
  const a = await store.getBig('analysis', videoId);
  return a && a.version === ANALYSIS_VERSION ? a : null;
}

export function queueAnalysis(videoId, { force = false } = {}) {
  const s = status.get(videoId);
  if (s && (s.state === 'queued' || s.state === 'running')) return;
  status.set(videoId, { state: 'queued', progress: 0, force });
  queue.push(videoId);
  notify();
  pump();
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const id = queue.shift();
    const st = status.get(id);
    st.state = 'running';
    notify();
    try {
      if (!st.force && (await getAnalysis(id))) { st.state = 'done'; st.progress = 1; notify(); await postProcess(id); continue; }
      const file = await store.getVideoFile(id);
      if (!file) throw new Error('Video file not available — relink it first.');
      let lastNotify = 0;
      const a = await analyzeVideo(file, {
        onProgress: (p) => { st.progress = p; if (performance.now() - lastNotify > 250) { lastNotify = performance.now(); notify(); } },
      });
      a.id = id;
      await store.putBig('analysis', a);
      st.state = 'done'; st.progress = 1;
      notify();
      await postProcess(id, a);
    } catch (e) {
      console.error('analysis failed', e);
      st.state = 'error'; st.error = e.message || String(e);
      notify();
    }
  }
  running = false;
}

/** After analysis: suggest start markers and thumbnails for runs on this video that lack them. */
async function postProcess(videoId, a = null) {
  a = a || (await getAnalysis(videoId));
  if (!a) return;
  const runs = store.all('runs').filter((r) => r.source?.videoId === videoId);
  for (const run of runs) {
    let changed = false;
    if (run.fps == null && a.fps) { run.fps = a.fps; changed = true; }
    if (run.markers?.start == null && runs.length === 1) {
      const L = detectLaunch(a.times, a.act);
      if (L) {
        let t = L.t;
        try {
          const file = await store.getVideoFile(videoId);
          const r = file ? await refineLaunch(file, t, a.fps || store.settings.defaultFps) : null;
          if (r != null && Math.abs(r - t) < 0.7) t = r;
        } catch (e) { console.warn('refine failed', e); }
        run.markers = { ...(run.markers || {}), start: t, startAuto: true };
        changed = true;
      }
    }
    if (!run.thumb) {
      const file = await store.getVideoFile(videoId);
      if (file) {
        const t = run.markers?.start != null ? run.markers.start + 3 : Math.min(5, a.duration / 3);
        run.thumb = await captureThumb(file, t);
        changed = true;
      }
    }
    if (run.duration == null) { run.duration = a.duration; changed = true; }
    if (changed) await store.put('runs', run);
  }
}
