// Pure data logic: timing, markers, warping between runs, split tables.
// No DOM access here so it can be unit-tested in Node.

export const STATUSES = {
  ok: 'Clean',
  dnf: 'DNF',
  off: 'Off course',
  dsq: 'DSQ',
  rerun: 'Rerun',
};

export const RUN_COLORS = ['#ff7a1a', '#22d3ee', '#a3e635', '#f472b6'];
export const RUN_LETTERS = ['A', 'B', 'C', 'D'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Raw time + cone penalties. null when the run has no valid time (DNF, off course, no time entered). */
export function adjustedTime(run, conePenalty = 2) {
  if (!run || !isNum(run.rawTime)) return null;
  if (run.status && run.status !== 'ok') return null;
  return run.rawTime + (run.cones || 0) * conePenalty;
}

/** Finish marker in video time. Falls back to start + official raw time. */
export function effectiveFinish(run) {
  const m = run?.markers || {};
  if (!isNum(m.start)) return null;
  if (isNum(m.finish)) return m.finish;
  if (isNum(run.rawTime) && run.rawTime > 0) return m.start + run.rawTime;
  return null;
}

export function finishIsEstimated(run) {
  const m = run?.markers || {};
  return !isNum(m.finish) && effectiveFinish(run) != null;
}

/** Time measured on video between start and finish markers (null unless both are set). */
export function videoTime(run) {
  const m = run?.markers || {};
  return isNum(m.start) && isNum(m.finish) ? m.finish - m.start : null;
}

/**
 * Course-ordered timing knots for a run, in course time (seconds since start marker).
 * Always begins with {key:'start', t:0} when a start marker exists.
 * Knots that are not strictly increasing are dropped (bad marks).
 */
export function runKnots(run, event) {
  const m = run?.markers || {};
  if (!isNum(m.start)) return [];
  const raw = [{ key: 'start', label: 'Start', name: 'start', t: 0 }];
  for (const s of event?.splits || []) {
    const v = m.splits?.[s.id];
    if (isNum(v)) raw.push({ key: s.id, label: s.name, name: s.name, t: v - m.start });
  }
  const fin = effectiveFinish(run);
  if (fin != null) raw.push({ key: 'finish', label: 'Finish', name: 'finish', t: fin - m.start, estimated: !isNum(m.finish) });
  const out = [];
  for (const k of raw) if (!out.length || k.t > out[out.length - 1].t + 1e-6) out.push(k);
  return out;
}

const normName = (s) => String(s || '').trim().toLowerCase();

/**
 * Pair up knots of two runs. Same course: match by split id. Different events: match splits by name.
 * Result is strictly increasing in both A and B.
 */
export function matchKnots(knotsA, knotsB, sameCourse = true) {
  const keyOf = (k) => (k.key === 'start' || k.key === 'finish' || sameCourse ? k.key : 'n:' + normName(k.name));
  const mapB = new Map(knotsB.map((k) => [keyOf(k), k]));
  const pairs = [];
  for (const a of knotsA) {
    const b = mapB.get(keyOf(a));
    if (!b) continue;
    const last = pairs[pairs.length - 1];
    if (last && (a.t <= last.tA || b.t <= last.tB)) continue;
    pairs.push({ key: a.key, label: a.label, tA: a.t, tB: b.t });
  }
  return pairs;
}

/**
 * Monotonic piecewise-linear time mapping from reference course time (A) to another run's course time (B).
 * Outside the known knots the mapping continues with slope 1.
 */
export class Warp {
  constructor(pairs = []) {
    const pts = [];
    for (const p of pairs) {
      const a = Array.isArray(p) ? p[0] : p.tA;
      const b = Array.isArray(p) ? p[1] : p.tB;
      if (!isNum(a) || !isNum(b)) continue;
      const last = pts[pts.length - 1];
      if (last && (a <= last[0] || b <= last[1])) continue;
      pts.push([a, b]);
    }
    if (!pts.length) pts.push([0, 0]);
    this.a = pts.map((p) => p[0]);
    this.b = pts.map((p) => p[1]);
  }
  get size() { return this.a.length; }
  /** Index i such that a[i] <= t < a[i+1]; -1 before first, n-1 after last. */
  _seg(xs, t) {
    let lo = 0, hi = xs.length - 1;
    if (t < xs[0]) return -1;
    if (t >= xs[hi]) return hi;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= t) lo = mid; else hi = mid;
    }
    return lo;
  }
  _eval(xs, ys, t) {
    const n = xs.length;
    const i = this._seg(xs, t);
    if (i < 0) return ys[0] + (t - xs[0]);
    if (i >= n - 1) return ys[n - 1] + (t - xs[n - 1]);
    const f = (t - xs[i]) / (xs[i + 1] - xs[i]);
    return ys[i] + f * (ys[i + 1] - ys[i]);
  }
  map(t) { return this._eval(this.a, this.b, t); }
  inverse(t) { return this._eval(this.b, this.a, t); }
  slope(t) {
    const n = this.a.length;
    const i = this._seg(this.a, t);
    if (i < 0 || i >= n - 1) return 1;
    return (this.b[i + 1] - this.b[i]) / (this.a[i + 1] - this.a[i]);
  }
  /** Time gap of B relative to A at A's course time t (positive = B slower). */
  delta(t) { return this.map(t) - t; }
  /** Whether delta is backed by at least two knots (i.e. meaningful). */
  get informative() { return this.a.length >= 2; }
  get lastA() { return this.a[this.a.length - 1]; }
}

/** Course order of knot keys for an event. */
export function courseKeys(event) {
  return ['start', ...(event?.splits || []).map((s) => s.id), 'finish'];
}

export function keyLabel(event, key) {
  if (key === 'start') return 'Start';
  if (key === 'finish') return 'Finish';
  return event?.splits?.find((s) => s.id === key)?.name || '?';
}

/**
 * Segment table for runs on one course.
 * Returns { segments: [{from,to,label}], rows: [{run, times:[dt|null], total}], best:[min|null], theoretical }
 */
export function splitTable(runs, event) {
  const keys = courseKeys(event);
  const segments = [];
  for (let i = 0; i < keys.length - 1; i++) {
    segments.push({ from: keys[i], to: keys[i + 1], label: `${keyLabel(event, keys[i])} → ${keyLabel(event, keys[i + 1])}` });
  }
  const rows = runs.map((run) => {
    const kn = runKnots(run, event);
    const tOf = new Map(kn.map((k) => [k.key, k.t]));
    const times = segments.map((s) => (tOf.has(s.from) && tOf.has(s.to) ? tOf.get(s.to) - tOf.get(s.from) : null));
    const total = tOf.has('finish') ? tOf.get('finish') : null;
    return { run, times, total };
  });
  const best = segments.map((_, i) => {
    const vals = rows.map((r) => r.times[i]).filter((v) => v != null && v > 0);
    return vals.length ? Math.min(...vals) : null;
  });
  const theoretical = best.length && best.every((b) => b != null) ? best.reduce((a, b) => a + b, 0) : null;
  return { segments, rows, best, theoretical };
}

/** Best (lowest adjusted) run in a list. */
export function bestRun(runs, conePenalty = 2) {
  let best = null, bt = Infinity;
  for (const r of runs) {
    const t = adjustedTime(r, conePenalty);
    if (t != null && t < bt) { bt = t; best = r; }
  }
  return best;
}

// ---------- formatting & parsing ----------

export function fmtTime(s, digits = 3) {
  if (!isNum(s)) return '—';
  const p = 10 ** digits;
  const neg = s < 0;
  let v = Math.round(Math.abs(s) * p) / p;
  const m = Math.floor(v / 60);
  const r = v - m * 60;
  const str = m ? `${m}:${r.toFixed(digits).padStart(digits + 3, '0')}` : r.toFixed(digits);
  return (neg ? '-' : '') + str;
}

export function fmtDelta(s, digits = 3) {
  if (!isNum(s)) return '—';
  const p = 10 ** digits;
  const v = Math.round(s * p) / p;
  if (v === 0) return '±' + (0).toFixed(digits);
  return (v > 0 ? '+' : '−') + Math.abs(v).toFixed(digits);
}

/** Accepts "45.123", "45,123", "1:05.2", "  52 ". Returns seconds or null. */
export function parseTime(str) {
  if (str == null) return null;
  const s = String(str).trim().replace(',', '.');
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length > 2) return null;
  let total = 0;
  for (const part of parts) {
    if (!/^\d+(\.\d+)?$/.test(part)) return null;
    total = total * 60 + parseFloat(part);
  }
  return total;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtBytes(n) {
  if (!isNum(n)) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function percentile(arr, p) {
  const a = Array.from(arr).filter(isNum).sort((x, y) => x - y);
  if (!a.length) return null;
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}

/** Extract the 11-char YouTube id from a URL or bare id. */
export function parseYouTubeId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
      const m = u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch { /* not a URL */ }
  return null;
}

/** Parse a "t=1m23s" / "t=83" YouTube timestamp from a URL, in seconds. */
export function parseYouTubeStart(input) {
  try {
    const u = new URL(String(input).trim());
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    if (!t) return null;
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m) return null;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  } catch { return null; }
}

export function runLabel(run, { drivers, events } = {}) {
  const parts = [];
  const d = drivers?.get?.(run.driverId);
  if (d) parts.push(d.name);
  if (run.runNumber != null) parts.push(`Run ${run.runNumber}`);
  if (!parts.length) parts.push(run.title || 'Run');
  return parts.join(' · ');
}
