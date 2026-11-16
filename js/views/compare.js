// Compare view: 2–4 runs played in lock-step with live deltas, split table, delta graph,
// overlay/ghost mode, zoom, per-panel sync adjustment and shareable links (YouTube runs).

import * as store from '../store.js';
import { h, clear, toast, modal, isTyping, setSelection, getSelection, debounce, add, fill } from '../ui.js';
import { resolveSource, relinkFlow, runTitle, runSubtitle, timeSummary, driverName } from '../common.js';
import {
  RUN_COLORS, RUN_LETTERS, Warp, adjustedTime, effectiveFinish, fmtDelta, fmtTime, matchKnots, runKnots,
} from '../model.js';
import { LocalPlayer, YouTubePlayer } from '../players.js';
import { SyncEngine } from '../sync.js';
import { getAnalysis } from '../analyze.js';
import { alignRuns } from '../signal.js';

const SPEEDS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2];
const prefs = loadPrefs();
function loadPrefs() {
  try { return { mode: 'realtime', layout: 'side', speed: 1, linkZoom: true, overlayOpacity: 0.5, blend: 'normal', ...JSON.parse(localStorage.getItem('autox-compare-prefs') || '{}') }; } catch { return { mode: 'realtime', layout: 'side', speed: 1, linkZoom: true, overlayOpacity: 0.5, blend: 'normal' }; }
}
const savePrefs = () => localStorage.setItem('autox-compare-prefs', JSON.stringify(prefs));

/**
 * @param root
 * @param {{runs: object[], events?: Map<string,object>, ephemeral?: boolean, title?: string}} input
 */
export function renderCompare(root, input) {
  const runs = input.runs.filter(Boolean).slice(0, 4);
  const ephemeral = !!input.ephemeral;
  const evOf = (r) => input.events?.get(r.eventId) || store.get('events', r.eventId);
  const cleanups = [];

  if (runs.length < 2) {
    fill(root, h('div', { class: 'empty' },
      h('h2', null, 'Pick at least two runs to compare'),
      h('p', null, 'Tick runs in the library or on an event page, then press Compare in the tray at the bottom.'),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'Go to library')));
    return;
  }

  const pen = store.settings.conePenalty;
  // Default reference: the fastest run (so deltas read as "how much slower than the best").
  const st = {
    ref: (() => {
      let bi = 0, bt = Infinity;
      runs.forEach((r, i) => { const t = adjustedTime(r, pen); if (t != null && t < bt) { bt = t; bi = i; } });
      return bi;
    })(),
    mode: prefs.mode,
    layout: prefs.layout,
    speed: prefs.speed,
    align: 'splits',
    audio: null, // index of audible run
    adjust: false,
    loopSeg: null, // {a, b, label}
    zoom: runs.map(() => ({ z: 1, x: 0, y: 0 })),
    tempOffsets: runs.map(() => 0),
  };
  st.audio = st.ref;

  const panels = []; // {run, i, el, media, player, hud, status}
  let engine = null;
  let destroyed = false;
  let alignments = new Map(); // runIndex -> knots (auto alignment vs ref)

  // ---------- skeleton ----------
  const chipsBar = h('div', { class: 'run-chips' });
  const toolbar = h('div', { class: 'cmp-toolbar' });
  const stageEl = h('div', { class: `cmp-stage layout-${st.layout} n${runs.length}` });
  const transport = h('div', { class: 'transport cmp-transport' });
  const scrub = h('canvas', { class: 'scrubber' });
  const splitBox = h('div', { class: 'cmp-splits' });
  const notesBox = h('div', { class: 'cmp-notes' });
  const wrap = h('div', { class: 'compare' }, chipsBar, toolbar, stageEl, transport, scrub, h('div', { class: 'cmp-bottom' }, splitBox, notesBox));

  fill(root, 
    h('div', { class: 'page-head compact' },
      h('div', null,
        h('div', { class: 'crumbs' }, h('a', { href: '#/' }, 'Library'), ' / Compare'),
        h('h1', null, input.title || 'Compare runs'),
      ),
      h('div', { class: 'actions' },
        ephemeral ? h('button', { class: 'btn btn-primary', onclick: () => saveShared(runs, input) }, '⬇ Save to my library') : null,
        canShare(runs) ? h('button', { class: 'btn', onclick: () => shareDialog(runs, evOf, st) }, '🔗 Share') : null,
        h('button', { class: 'btn', title: 'Fullscreen (F)', onclick: () => toggleFullscreen(wrap) }, '⛶ Fullscreen'),
      ),
    ),
    wrap,
  );

  // ---------- mapping ----------
  const startOf = (i) => (runs[i].markers?.start ?? 0) + st.tempOffsets[i];
  const sameCourse = (a, b) => a.eventId && a.eventId === b.eventId;
  function warpFor(i) {
    if (i === st.ref) return new Warp([[0, 0]]);
    if (st.align === 'auto' && alignments.has(i)) return new Warp(alignments.get(i));
    const r = runs[st.ref], o = runs[i];
    const kr = knotsOf(r), ko = knotsOf(o);
    return new Warp(matchKnots(kr, ko, sameCourse(r, o)));
  }
  function knotsOf(r) {
    const i = runs.indexOf(r);
    const off = st.tempOffsets[i] || 0;
    const rr = off ? { ...r, markers: { ...r.markers, start: (r.markers?.start ?? 0) + off } } : r;
    return runKnots(rr, evOf(r));
  }
  let warps = [];
  function rebuildWarps() { warps = runs.map((_, i) => warpFor(i)); }
  function courseEnd(i) {
    const f = effectiveFinish({ ...runs[i], markers: { ...runs[i].markers, start: startOf(i) } });
    if (f != null) return f - startOf(i);
    const d = panels[i]?.player?.duration;
    return d ? d - startOf(i) : 60;
  }
  function range() {
    const leadIn = store.settings.leadIn ?? 2, leadOut = store.settings.leadOut ?? 2;
    let max = 0;
    runs.forEach((_, i) => {
      const end = courseEnd(i);
      max = Math.max(max, st.mode === 'locked' ? warps[i].inverse(end) : end);
    });
    return { min: -leadIn, max: max + leadOut };
  }
  function tracks() {
    return panels.filter((p) => p.player).map((p) => {
      const i = p.i, w = warps[i];
      const locked = st.mode === 'locked';
      return {
        player: p.player,
        isRef: i === st.ref,
        toVideo: (t) => startOf(i) + (locked ? w.map(t) : t),
        fromVideo: (v) => (locked ? w.inverse(v - startOf(i)) : v - startOf(i)),
        slope: (t) => (locked ? w.slope(t) : 1),
      };
    });
  }
  /** Course time of run i at master time t. */
  const courseTimeOf = (i, t) => (st.mode === 'locked' ? warps[i].map(t) : t);
  /** Live gap of run i vs reference at master time t. */
  function deltaOf(i, t) {
    const w = warps[i];
    if (i === st.ref || !w.informative) return null;
    const refT = t; // reference course time equals master time in both modes
    if (refT < 0) return null;
    const endA = w.lastA;
    return w.delta(Math.min(refT, endA));
  }

  // ---------- panels ----------
  async function buildPanels() {
    clear(stageEl);
    panels.length = 0;
    rebuildWarps();
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const media = h('div', { class: 'panel-media' });
      const hud = h('div', { class: 'panel-hud' });
      const shield = h('div', { class: 'panel-shield' });
      const adjustBar = h('div', { class: 'adjust-bar' });
      const el = h('div', { class: 'panel', style: { '--c': RUN_COLORS[i] }, 'data-i': i }, media, shield, hud, adjustBar);
      stageEl.appendChild(el);
      const p = { run, i, el, media, hud, adjustBar, player: null, shield, hudKey: '' };
      panels.push(p);
      attachZoom(p);
    }
    applyLayout();
    renderChips(); renderSplits(); renderNotes();
    const loading = h('div', { class: 'sub' }, 'Loading videos…');
    fill(transport, loading);
    await Promise.all(panels.map(loadPlayer));
    if (destroyed) return;
    rebuildWarps();
    if (st.mode === 'locked' && !canLock()) st.mode = 'realtime';
    engine?.destroy();
    engine = new SyncEngine(tracks(), { onTick, range: range() });
    engine.setRate(st.speed);
    engine.seek(-Math.min(1, store.settings.leadIn ?? 2));
    applyAudio();
    renderToolbar(); renderTransport(); renderSplits();
  }

  async function loadPlayer(p) {
    const src = await resolveSource(p.run);
    if (src.none || src.missing) {
      add(p.media, h('div', { class: 'stage-msg' },
        h('p', null, src.none ? 'No video for this run.' : `Video "${src.name || ''}" not available in this session.`),
        !ephemeral ? h('button', { class: 'btn btn-primary', onclick: async () => { if (await relinkFlow(p.run)) buildPanels(); } }, src.none ? 'Attach video…' : 'Re-link file…') : null));
      return;
    }
    try {
      if (src.kind === 'youtube') p.player = new YouTubePlayer(p.media, src.ytId, { muted: true, startAt: p.run.markers?.start ?? 0 });
      else {
        const url = src.kind === 'local' ? URL.createObjectURL(src.file) : src.src;
        p.player = new LocalPlayer(p.media, url, { muted: true });
        if (src.kind === 'local') cleanups.push(() => URL.revokeObjectURL(url));
      }
      await p.player.ready;
      if (p.run.markers?.start == null) p.el.classList.add('no-start');
    } catch (e) {
      p.player?.destroy(); p.player = null;
      add(p.media, h('div', { class: 'stage-msg error' }, h('p', null, e.message)));
    }
  }

  function applyLayout() {
    stageEl.className = `cmp-stage layout-${st.layout} n${runs.length}${st.adjust ? ' adjusting' : ''}`;
    panels.forEach((p) => {
      p.el.style.opacity = '';
      p.el.style.mixBlendMode = '';
      p.el.hidden = false;
    });
    if (st.layout === 'overlay') {
      // reference at the bottom, first other run on top with opacity; others hidden
      const other = panels.find((p) => p.i !== st.ref);
      panels.forEach((p) => {
        p.el.hidden = !(p.i === st.ref || p === other);
        p.el.style.zIndex = p.i === st.ref ? 1 : 2;
      });
      if (other) { other.el.style.opacity = prefs.overlayOpacity; other.el.style.mixBlendMode = prefs.blend; }
    } else panels.forEach((p) => { p.el.style.zIndex = ''; });
    applyZoom();
  }

  function applyAudio() {
    panels.forEach((p) => { if (p.player) p.player.muted = p.i !== st.audio; });
  }

  // ---------- zoom & pan ----------
  function attachZoom(p) {
    let drag = null;
    p.shield.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = p.shield.getBoundingClientRect();
      const z0 = st.zoom[p.i];
      const nz = Math.max(1, Math.min(6, z0.z * Math.exp(-e.deltaY * 0.0015)));
      // keep the point under the cursor fixed
      const cx = (e.clientX - r.left) / r.width - 0.5, cy = (e.clientY - r.top) / r.height - 0.5;
      const k = nz / z0.z;
      const nx = cx - (cx - z0.x) * k, ny = cy - (cy - z0.y) * k;
      setZoom(p.i, { z: nz, x: nz === 1 ? 0 : nx, y: nz === 1 ? 0 : ny });
    }, { passive: false });
    p.shield.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, z: { ...st.zoom[p.i] }, moved: false };
      p.shield.setPointerCapture(e.pointerId);
    });
    p.shield.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = p.shield.getBoundingClientRect();
      const dx = (e.clientX - drag.x) / r.width, dy = (e.clientY - drag.y) / r.height;
      if (Math.abs(dx) + Math.abs(dy) > 0.01) drag.moved = true;
      if (drag.moved && drag.z.z > 1) setZoom(p.i, { ...drag.z, x: drag.z.x + dx, y: drag.z.y + dy });
    });
    p.shield.addEventListener('pointerup', () => {
      if (drag && !drag.moved && !st.adjust) engine?.toggle();
      drag = null;
    });
    p.shield.addEventListener('dblclick', () => setZoom(p.i, { z: 1, x: 0, y: 0 }));
  }
  function setZoom(i, z) {
    const lim = (v, zz) => Math.max(-(zz - 1) / 2, Math.min((zz - 1) / 2, v));
    const zz = { z: z.z, x: lim(z.x, z.z), y: lim(z.y, z.z) };
    if (prefs.linkZoom) st.zoom = st.zoom.map(() => ({ ...zz })); else st.zoom[i] = zz;
    applyZoom();
  }
  function applyZoom() {
    panels.forEach((p) => {
      const z = st.zoom[p.i];
      p.media.style.transform = z.z === 1 ? '' : `translate(${z.x * 100}%, ${z.y * 100}%) scale(${z.z})`;
    });
  }

  // ---------- per-frame UI ----------
  function onTick(t) {
    // YouTube reports duration 0 until its metadata loads; widen the range once it's known.
    let durChanged = false;
    for (const p of panels) { const d = p.player?.duration || 0; if (d && d !== p.knownDur) { p.knownDur = d; durChanged = true; } }
    if (durChanged && engine) engine.setRange(range());
    for (const p of panels) renderHud(p, t);
    drawScrubber(t);
    if (timeLabel) timeLabel.textContent = t < -0.005 ? `−${Math.abs(t).toFixed(2)}` : fmtTime(Math.max(0, t), 2);
    if (playBtn) playBtn.textContent = engine?.playing ? '❚❚' : '▶';
    highlightSplitRow(t);
    maybeShowNotes(t);
  }

  function renderHud(p, t) {
    const i = p.i, run = p.run;
    const ct = courseTimeOf(i, t);
    const end = courseEnd(i);
    const d = deltaOf(i, t);
    const kn = knotsOf(run);
    let seg = '';
    if (ct >= 0 && kn.length) {
      const k = kn.findLastIndex((x) => x.t <= ct);
      if (k >= 0 && k < kn.length - 1) seg = `${kn[k].label} → ${kn[k + 1].label}`;
      else if (k === kn.length - 1 && kn[k].key === 'finish') seg = 'Finished';
    }
    const finished = ct >= end - 1e-3;
    const timer = ct < -0.005 ? `−${Math.abs(ct).toFixed(2)}` : fmtTime(Math.max(0, Math.min(ct, end)), 2);
    const key = `${timer}|${d == null ? '' : d.toFixed(2)}|${seg}|${st.ref}|${finished}`;
    if (key === p.hudKey) return;
    p.hudKey = key;
    fill(p.hud, 
      h('div', { class: 'hud-tl' }, h('span', { class: 'letter' }, RUN_LETTERS[i]), h('span', { class: 'hud-name' }, runTitle(run)), i === st.ref ? h('span', { class: 'hud-ref' }, 'REF') : null),
      h('div', { class: `hud-tr mono big ${finished ? 'finished' : ''}` }, timer),
      d != null ? h('div', { class: `hud-bl mono ${d > 0.005 ? 'slower' : d < -0.005 ? 'faster' : ''}` }, fmtDelta(d, 2), h('small', null, ` vs ${RUN_LETTERS[st.ref]}`)) : null,
      seg ? h('div', { class: 'hud-br' }, seg) : null,
    );
  }

  // ---------- notes popping up during playback ----------
  const shownNotes = new Set();
  function maybeShowNotes(t) {
    for (const p of panels) {
      const s = startOf(p.i);
      for (const a of p.run.annotations || []) {
        const at = a.t - s; // course time of the note
        const ct = courseTimeOf(p.i, t);
        const key = p.run.id + a.id;
        const visible = ct >= at - 0.1 && ct <= at + 2.5;
        let el = p.el.querySelector(`[data-note="${a.id}"]`);
        if (visible && !el) { el = h('div', { class: 'panel-note', 'data-note': a.id }, '📝 ', a.text); p.el.appendChild(el); shownNotes.add(key); }
        else if (!visible && el) el.remove();
      }
    }
  }

  // ---------- scrubber with delta graph ----------
  let scrubDrag = false;
  scrub.addEventListener('pointerdown', (e) => { scrubDrag = true; scrub.setPointerCapture(e.pointerId); scrubSeek(e); });
  scrub.addEventListener('pointermove', (e) => { if (scrubDrag) scrubSeek(e); });
  scrub.addEventListener('pointerup', () => { scrubDrag = false; });
  function scrubSeek(e) {
    if (!engine) return;
    const r = scrub.getBoundingClientRect();
    const { min, max } = engine.range;
    engine.seek(min + ((e.clientX - r.left) / r.width) * (max - min));
  }
  function drawScrubber(t) {
    if (!engine) return;
    const c = scrub, dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (!W) return;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0d1218'; g.fillRect(0, 0, W, H);
    const { min, max } = engine.range;
    const X = (v) => ((v - min) / (max - min)) * W;
    // loop region
    if (st.loopSeg) { g.fillStyle = 'rgba(250,204,21,0.12)'; g.fillRect(X(st.loopSeg.a), 0, X(st.loopSeg.b) - X(st.loopSeg.a), H); }
    // delta graph
    const graphTop = 20, graphBot = H - 14, mid = (graphTop + graphBot) / 2;
    const ds = [];
    runs.forEach((_, i) => {
      if (i === st.ref || !warps[i]?.informative) return;
      const pts = [];
      const end = warps[i].lastA;
      for (let k = 0; k <= 160; k++) { const tt = (end * k) / 160; pts.push([tt, warps[i].delta(tt)]); }
      ds.push({ i, pts });
    });
    let maxAbs = 0.25;
    for (const d of ds) for (const [, v] of d.pts) maxAbs = Math.max(maxAbs, Math.abs(v));
    g.strokeStyle = '#1f2a36'; g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
    if (ds.length) {
      g.fillStyle = '#5b6b7c'; g.font = '10px ui-monospace, monospace';
      g.fillText(`+${maxAbs.toFixed(2)}s slower`, 4, graphTop + 8);
      g.fillText(`−${maxAbs.toFixed(2)}s faster`, 4, graphBot);
      for (const d of ds) {
        g.strokeStyle = RUN_COLORS[d.i]; g.lineWidth = 2; g.beginPath();
        d.pts.forEach(([tt, v], k) => { const x = X(tt), y = mid - (v / maxAbs) * (mid - graphTop); k ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
      }
    }
    // split markers (reference)
    const kr = knotsOf(runs[st.ref]);
    g.font = '10px system-ui, sans-serif';
    for (const k of kr) {
      const x = Math.round(X(k.t)) + 0.5;
      g.strokeStyle = k.key === 'start' ? '#a3e635' : k.key === 'finish' ? '#f43f5e' : '#facc15';
      g.setLineDash(k.estimated ? [3, 3] : []);
      g.beginPath(); g.moveTo(x, 14); g.lineTo(x, H); g.stroke();
      g.setLineDash([]);
      g.fillStyle = g.strokeStyle;
      g.fillText(k.label, Math.min(W - 40, x + 3), 11);
    }
    // playhead
    const x = Math.round(X(t)) + 0.5;
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }

  function canLock() { return runs.some((_, i) => i !== st.ref && warps[i]?.informative); }
  function setMode(v) {
    if (v === 'locked' && !canLock()) { toast('Position-lock needs the finish (or official time) or matching splits on the reference and at least one other run.', { type: 'warn', ms: 4500 }); return; }
    st.mode = v; prefs.mode = v; savePrefs(); resync();
  }

  // ---------- toolbar ----------
  function seg(label, options, value, onPick, title) {
    return h('div', { class: 'seg', title }, h('span', { class: 'seg-label' }, label), options.map(([v, l, tip]) => h('button', { class: `seg-btn ${v === value ? 'on' : ''}`, title: tip || '', onclick: () => onPick(v) }, l)));
  }
  function renderToolbar() {
    const anyLocal = panels.some((p) => p.player?.kind === 'local');
    const anyYT = panels.some((p) => p.player?.kind === 'youtube');
    fill(toolbar, 
      seg('Sync', [['realtime', 'Real time', 'All runs start together — see who pulls ahead'], ['locked', 'Position-locked', 'Runs are time-warped so they reach each split together — compare lines at the same spot']], st.mode, setMode),
      seg('Layout', [['side', 'Side by side'], ['stack', 'Stacked'], ['overlay', 'Overlay', 'Ghost the second run over the reference']], st.layout, (v) => { st.layout = v; prefs.layout = v; savePrefs(); applyLayout(); renderToolbar(); }),
      st.layout === 'overlay' ? h('div', { class: 'seg' },
        h('span', { class: 'seg-label' }, 'Ghost'),
        h('input', { type: 'range', min: 0.1, max: 0.9, step: 0.05, value: prefs.overlayOpacity, oninput: (e) => { prefs.overlayOpacity = +e.target.value; savePrefs(); applyLayout(); } }),
        h('select', { class: 'input input-small', onchange: (e) => { prefs.blend = e.target.value; savePrefs(); applyLayout(); } },
          [['normal', 'Blend'], ['difference', 'Difference'], ['screen', 'Screen']].map(([v, l]) => h('option', { value: v, selected: prefs.blend === v }, l)))) : null,
      seg('Align by', [['splits', 'Marks', 'Use start/split/finish marks'], ['auto', '✨ Video', 'Continuous alignment computed by matching what the cameras see (local videos, same mount works best)']], st.align, async (v) => {
        if (v === 'auto' && !(await ensureAutoAlign())) return;
        st.align = v; resync();
      }),
      h('div', { class: 'seg' }, h('span', { class: 'seg-label' }, 'Audio'),
        h('select', { class: 'input input-small', onchange: (e) => { st.audio = e.target.value === '' ? null : +e.target.value; applyAudio(); } },
          h('option', { value: '' }, 'Muted'), runs.map((_, i) => h('option', { value: i, selected: st.audio === i }, `Run ${RUN_LETTERS[i]}`)))),
      h('label', { class: 'seg check', title: 'Zoom/pan all videos together (scroll on a video to zoom, drag to pan, double-click to reset)' }, h('input', { type: 'checkbox', checked: prefs.linkZoom, onchange: (e) => { prefs.linkZoom = e.target.checked; savePrefs(); } }), 'Link zoom'),
      h('button', { class: `btn btn-small ${st.adjust ? 'btn-primary' : ''}`, title: 'Fix sync: step each video on its own and set its start (A)', onclick: () => setAdjust(!st.adjust) }, st.adjust ? '✓ Done adjusting' : '⚙ Adjust sync'),
      anyYT && st.mode === 'locked' ? h('span', { class: 'sub', title: 'YouTube players only support a few fixed speeds, so they are kept in place by small jumps.' }, 'YouTube: position-lock is approximate') : null,
      !anyLocal && !anyYT ? null : null,
    );
  }

  // ---------- transport ----------
  let playBtn = null, timeLabel = null;
  function renderTransport() {
    const fps = Math.max(...runs.map((r) => r.fps || store.settings.defaultFps || 30));
    playBtn = h('button', { class: 'btn btn-icon', title: 'Play/pause (Space)', onclick: () => engine?.toggle() }, '▶');
    timeLabel = h('span', { class: 'mono time-label', title: 'Reference course time' }, '0.00');
    fill(transport, 
      h('button', { class: 'btn btn-small', title: 'To start (Home)', onclick: () => engine?.seek(-Math.min(1, store.settings.leadIn ?? 2)) }, '⇤'),
      h('button', { class: 'btn btn-small', title: 'Back 1 s (Shift+←)', onclick: () => engine?.step(-1) }, '−1s'),
      h('button', { class: 'btn btn-small', title: 'Back 1 frame (←)', onclick: () => engine?.step(-1 / fps) }, '−1f'),
      playBtn,
      h('button', { class: 'btn btn-small', title: 'Forward 1 frame (→)', onclick: () => engine?.step(1 / fps) }, '+1f'),
      h('button', { class: 'btn btn-small', title: 'Forward 1 s (Shift+→)', onclick: () => engine?.step(1) }, '+1s'),
      timeLabel,
      h('select', { class: 'input input-small', title: 'Speed ([ / ])', onchange: (e) => setSpeed(+e.target.value) },
        SPEEDS.map((s) => h('option', { value: s, selected: s === st.speed }, `${s}×`))),
      h('span', { class: 'spacer' }),
      st.loopSeg ? h('button', { class: 'btn btn-small btn-primary', onclick: () => setLoop(null) }, `⟲ Looping ${st.loopSeg.label} ✕`) : h('span', { class: 'sub' }, 'Click a segment below to loop it'),
    );
  }
  function setSpeed(s) {
    st.speed = s; prefs.speed = s; savePrefs(); engine?.setRate(s);
    if (engine?.playing) { engine.pause(); engine.play(); }
    renderTransport();
  }
  function setLoop(seg) {
    st.loopSeg = seg;
    if (engine) {
      engine.loop = seg ? { a: seg.a, b: seg.b } : null;
      if (seg) { engine.seek(seg.a); engine.play(); }
    }
    renderTransport();
    renderSplits();
  }

  // ---------- split comparison table ----------
  let splitRows = [];
  function renderSplits() {
    clear(splitBox);
    const kr = knotsOf(runs[st.ref]);
    if (kr.length < 2) {
      add(splitBox, h('p', { class: 'sub' }, 'Mark the finish (or enter the official time) and course splits on the runs to get segment-by-segment comparisons here.'));
      splitRows = [];
      return;
    }
    // Segments along the reference's knots; for other runs use their matched knots.
    const segs = [];
    for (let k = 0; k < kr.length - 1; k++) segs.push({ from: kr[k], to: kr[k + 1] });
    const otherKnots = runs.map((r, i) => {
      if (i === st.ref) return new Map(kr.map((k) => [k.key, k.t]));
      const pairs = st.align === 'auto' && alignments.has(i) ? null : matchKnots(kr, knotsOf(r), sameCourse(runs[st.ref], r));
      if (pairs) return new Map(pairs.map((p) => [p.key, p.tB]));
      return new Map(kr.map((k) => [k.key, warps[i].map(k.t)]));
    });
    splitRows = [];
    const rows = segs.map((s) => {
      const a = s.from.t, b = s.to.t;
      const label = `${s.from.label} → ${s.to.label}`;
      const cells = runs.map((_, i) => {
        const m = otherKnots[i];
        return m.has(s.from.key) && m.has(s.to.key) ? m.get(s.to.key) - m.get(s.from.key) : null;
      });
      const valid = cells.filter((v) => v != null);
      const best = valid.length ? Math.min(...valid) : null;
      const isLoop = st.loopSeg && st.loopSeg.label === label;
      const tr = h('tr', { class: `clickable ${isLoop ? 'looping' : ''}`, title: 'Click to loop this segment', onclick: () => setLoop(isLoop ? null : { a: a - 0.5, b: b + 0.5, label }) },
        h('td', null, label),
        cells.map((v, i) => h('td', { class: `r mono ${v != null && v === best && valid.length > 1 ? 'seg-best' : ''}` },
          v != null ? fmtTime(v, 2) : '—',
          i !== st.ref && v != null && cells[st.ref] != null ? h('span', { class: `delta ${v - cells[st.ref] > 0.005 ? 'slower' : v - cells[st.ref] < -0.005 ? 'faster' : ''}` }, ' ', fmtDelta(v - cells[st.ref], 2)) : null)),
      );
      splitRows.push({ tr, a, b });
      return tr;
    });
    const totals = runs.map((_, i) => otherKnots[i].get('finish') ?? null);
    add(splitBox, 
      h('h3', null, 'Segments ', h('span', { class: 'sub' }, `(vs ${RUN_LETTERS[st.ref]}${st.align === 'auto' ? ', using video alignment' : ''})`)),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table compact cmp-split-table' },
        h('thead', null, h('tr', null, h('th', null, 'Segment'), runs.map((r, i) => h('th', { class: 'r' }, h('span', { class: 'letter', style: { background: RUN_COLORS[i] } }, RUN_LETTERS[i]))))),
        h('tbody', null, rows,
          h('tr', { class: 'tb-row' }, h('td', null, 'Total (video)'), totals.map((v, i) => h('td', { class: 'r mono' }, v != null ? fmtTime(v, 2) : '—',
            i !== st.ref && v != null && totals[st.ref] != null ? h('span', { class: `delta ${v - totals[st.ref] > 0 ? 'slower' : 'faster'}` }, ' ', fmtDelta(v - totals[st.ref], 2)) : null)))),
      )),
    );
  }
  let lastHi = null;
  function highlightSplitRow(t) {
    const row = splitRows.find((r) => t >= r.a && t < r.b);
    if (row === lastHi) return;
    lastHi?.tr.classList.remove('current');
    row?.tr.classList.add('current');
    lastHi = row;
  }

  function renderNotes() {
    clear(notesBox);
    const items = [];
    runs.forEach((r, i) => {
      for (const a of r.annotations || []) items.push({ i, t: a.t - startOf(i), text: a.text });
      if (r.notes) items.push({ i, t: null, text: r.notes });
    });
    if (!items.length) {
      add(notesBox, h('p', { class: 'sub' }, 'Timed notes you add in a run\'s editor (N key) pop up here during playback.'));
      return;
    }
    items.sort((a, b) => (a.t ?? -1e9) - (b.t ?? -1e9));
    add(notesBox, h('h3', null, 'Notes'), h('ul', { class: 'cmp-note-list' }, items.map((n) => h('li', null,
      h('span', { class: 'letter', style: { background: RUN_COLORS[n.i] } }, RUN_LETTERS[n.i]),
      n.t != null ? h('button', { class: 'linkish mono', onclick: () => engine?.seek(st.mode === 'locked' ? warps[n.i].inverse(n.t) : n.t) }, fmtTime(n.t, 2)) : h('span', { class: 'sub' }, 'run'),
      h('span', null, n.text),
    ))));
  }

  // ---------- run chips ----------
  function renderChips() {
    fill(chipsBar, runs.map((r, i) => h('div', { class: `run-chip ${i === st.ref ? 'is-ref' : ''}`, style: { '--c': RUN_COLORS[i] } },
      h('span', { class: 'letter' }, RUN_LETTERS[i]),
      h('div', { class: 'chip-text' },
        h('div', { class: 'strong' }, runTitle(r), h('span', { class: 'mono chip-time' }, timeSummary(r))),
        h('div', { class: 'sub' }, runSubtitle(r) || (ephemeral ? 'Shared run' : ''), r.markers?.start == null ? h('span', { class: 'warn' }, ' · no start mark') : null),
      ),
      h('button', { class: `icon-btn ${i === st.ref ? 'on' : ''}`, title: 'Use as reference (deltas are measured against it)', onclick: () => { st.ref = i; st.audio = i; alignments = new Map(); if (st.align === 'auto') st.align = 'splits'; applyAudio(); applyLayout(); resync(); renderChips(); } }, '★'),
      !ephemeral ? h('a', { class: 'icon-btn', title: 'Open run editor', href: `#/run/${r.id}` }, '✎') : null,
      !ephemeral && runs.length > 2 ? h('button', { class: 'icon-btn', title: 'Remove from comparison', onclick: () => { const ids = runs.filter((x) => x !== r).map((x) => x.id); setSelection(ids); location.hash = `#/compare/${ids.join(',')}`; } }, '✕') : null,
    )),
    !ephemeral && runs.length < 4 ? h('button', { class: 'btn btn-small add-run', onclick: () => pickRunDialog(runs) }, '+ Add run') : null,
    );
  }

  // ---------- adjust sync mode ----------
  function setAdjust(on) {
    st.adjust = on;
    engine?.pause();
    applyLayout();
    for (const p of panels) {
      p.offAdjust?.();
      p.offAdjust = null;
      clear(p.adjustBar);
      if (!on || !p.player) continue;
      const fps = p.run.fps || store.settings.defaultFps || 30;
      const tLabel = h('span', { class: 'mono' }, fmtTime(p.player.time, 3));
      const upd = () => { tLabel.textContent = fmtTime(p.player.time, 3); };
      const step = (dt) => { p.player.pause(); p.player.seek(p.player.time + dt); setTimeout(upd, 120); };
      add(p.adjustBar, 
        h('button', { class: 'btn btn-small', onclick: () => step(-1) }, '−1s'),
        h('button', { class: 'btn btn-small', onclick: () => step(-1 / fps) }, '−1f'),
        h('button', { class: 'btn btn-small', onclick: () => { p.player.paused ? p.player.play() : p.player.pause(); setTimeout(upd, 120); } }, '▶/❚❚'),
        h('button', { class: 'btn btn-small', onclick: () => step(1 / fps) }, '+1f'),
        h('button', { class: 'btn btn-small', onclick: () => step(1) }, '+1s'),
        tLabel,
        h('button', { class: 'btn btn-small btn-primary', title: 'Use the current frame of this video as its start (launch) mark', onclick: async () => {
          p.player.pause();
          const t = Math.round(p.player.time * 1000) / 1000;
          p.run.markers = { ...(p.run.markers || { splits: {} }), start: t, startAuto: false };
          st.tempOffsets[p.i] = 0;
          p.el.classList.remove('no-start');
          if (!ephemeral) await store.put('runs', p.run);
          toast(`Start for ${RUN_LETTERS[p.i]} set at ${fmtTime(t)}`, { ms: 1800 });
          if (p.i === st.ref) {
            // Video alignments are measured in the reference's course time — all are stale now.
            alignments = new Map();
            if (st.align === 'auto') st.align = 'splits';
          } else alignments.delete(p.i);
        } }, 'Set start here'),
      );
      if (p.player.kind === 'local') {
        p.player.el.addEventListener('timeupdate', upd);
        p.offAdjust = () => p.player?.el.removeEventListener('timeupdate', upd);
      }
    }
    if (!on) resync();
    renderToolbar();
  }

  // ---------- auto alignment ----------
  async function ensureAutoAlign() {
    const ref = runs[st.ref];
    if (ref.source?.type !== 'local') { toast('Video alignment needs local video files (not YouTube).', { type: 'warn' }); return false; }
    const need = runs.map((r, i) => i).filter((i) => i !== st.ref && !alignments.has(i));
    if (!need.length) return true;
    const refA = await getAnalysis(ref.source.videoId);
    if (!refA) { toast('Reference video hasn\'t been analyzed yet (open it in the run editor).', { type: 'warn' }); return false; }
    const fin = (r) => effectiveFinish({ ...r, markers: { ...r.markers, start: startOf(runs.indexOf(r)) } });
    if (fin(ref) == null) { toast('Video alignment needs start and finish (or official time) on each run.', { type: 'warn' }); return false; }
    const busy = toast('Aligning videos…', { ms: 1500 });
    let ok = 0;
    for (const i of need) {
      const r = runs[i];
      if (r.source?.type !== 'local') continue;
      const sig = [startOf(st.ref), fin(ref), startOf(i), fin(r)].map((x) => x?.toFixed(3)).join(',');
      const key = `${ref.id}|${r.id}`;
      const cached = !ephemeral && store.get('alignments', key);
      if (cached && cached.sig === sig) { alignments.set(i, cached.knots); ok++; continue; }
      const a = await getAnalysis(r.source.videoId);
      if (!a || fin(r) == null) continue;
      await new Promise((res) => setTimeout(res, 20));
      const res = alignRuns(
        { times: refA.times, frames: refA.frames, size: refA.W * refA.H, start: startOf(st.ref), finish: fin(ref) },
        { times: a.times, frames: a.frames, size: a.W * a.H, start: startOf(i), finish: fin(r) },
      );
      if (!res) continue;
      alignments.set(i, res.knots);
      ok++;
      if (!ephemeral) await store.put('alignments', { id: key, knots: res.knots, cost: res.cost, sig });
      if (res.cost > 0.6) toast(`Alignment for ${RUN_LETTERS[i]} looks uncertain (different camera view?) — verify in position-locked mode.`, { type: 'warn', ms: 6000 });
    }
    if (!ok) { toast('Could not align: both runs need analyzed local videos with start and finish.', { type: 'warn', ms: 5000 }); return false; }
    return true;
  }

  function resync() {
    rebuildWarps();
    if (!engine) return;
    const t = engine.t;
    engine.setRange(range());
    engine.setTracks(tracks());
    engine.seek(t);
    renderToolbar(); renderSplits(); renderNotes();
    for (const p of panels) p.hudKey = '';
    onTick(engine.t);
  }

  // ---------- keyboard ----------
  const onKey = (e) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || document.querySelector('.modal-overlay') || !engine) return;
    const fps = Math.max(...runs.map((r) => r.fps || store.settings.defaultFps || 30));
    const k = e.key;
    if (st.adjust && [' ', 'ArrowLeft', 'ArrowRight', ',', '.', 'Home', 'l', 'L', 'p', 'P'].includes(k) || (st.adjust && /^[1-9]$/.test(k))) {
      if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
      toast('Adjusting sync — use each video\'s own buttons, or press A to finish.', { ms: 1500 });
      return;
    }
    if (k === ' ') { e.preventDefault(); engine.toggle(); }
    else if (k === 'ArrowLeft' || k === ',') { e.preventDefault(); engine.step(e.shiftKey ? -1 : -1 / fps); }
    else if (k === 'ArrowRight' || k === '.') { e.preventDefault(); engine.step(e.shiftKey ? 1 : 1 / fps); }
    else if (k === 'Home') { e.preventDefault(); engine.seek(-Math.min(1, store.settings.leadIn ?? 2)); }
    else if (k === '[' || k === ']') { const i = SPEEDS.indexOf(st.speed); setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + (k === ']' ? 1 : -1)))]); }
    else if (k === 'f' || k === 'F') toggleFullscreen(wrap);
    else if (k === 'm' || k === 'M') { st.audio = st.audio == null ? 0 : st.audio + 1 >= runs.length ? null : st.audio + 1; applyAudio(); renderToolbar(); toast(st.audio == null ? 'Muted' : `Audio: run ${RUN_LETTERS[st.audio]}`, { ms: 1000 }); }
    else if (k === 'o' || k === 'O') { const L = ['side', 'stack', 'overlay']; st.layout = L[(L.indexOf(st.layout) + 1) % 3]; prefs.layout = st.layout; savePrefs(); applyLayout(); renderToolbar(); }
    else if (k === 'p' || k === 'P') setMode(st.mode === 'locked' ? 'realtime' : 'locked');
    else if (k === 'a' || k === 'A') setAdjust(!st.adjust);
    else if (k === 'l' || k === 'L') { const r = splitRows.find((x) => engine.t >= x.a && engine.t < x.b); if (st.loopSeg) setLoop(null); else if (r) r.tr.click(); }
    else if (/^[1-9]$/.test(k)) { const kr = knotsOf(runs[st.ref]); const kk = kr[parseInt(k)]; if (kk) engine.seek(kk.t - 0.5); }
  };
  document.addEventListener('keydown', onKey);
  const onResize = debounce(() => engine && drawScrubber(engine.t), 100);
  window.addEventListener('resize', onResize);

  buildPanels();

  return () => {
    destroyed = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    engine?.destroy();
    for (const p of panels) p.player?.destroy();
    for (const c of cleanups) c();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}

function toggleFullscreen(el) {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else el.requestFullscreen?.().catch(() => toast('Fullscreen not available.', { type: 'warn' }));
}

function pickRunDialog(current) {
  const ids = new Set(current.map((r) => r.id));
  const list = store.all('runs').filter((r) => r.source && !ids.has(r.id))
    .sort((a, b) => (store.get('events', b.eventId)?.date || '').localeCompare(store.get('events', a.eventId)?.date || '') || (a.runNumber ?? 0) - (b.runNumber ?? 0));
  const m = modal({
    title: 'Add a run to the comparison',
    wide: true,
    body: list.length ? h('div', { class: 'pick-list' }, list.map((r) => h('button', { class: 'pick-item', onclick: () => {
      const next = [...current.map((x) => x.id), r.id];
      setSelection(next);
      m.close();
      location.hash = `#/compare/${next.join(',')}`;
    } }, h('span', { class: 'strong' }, runTitle(r)), h('span', { class: 'sub' }, runSubtitle(r)), h('span', { class: 'mono' }, timeSummary(r))))) : h('p', null, 'No other runs with video.'),
  });
}

// ---------- sharing (YouTube-only comparisons) ----------
function canShare(runs) { return runs.every((r) => r.source?.type === 'youtube'); }

export function encodeShare(runs, evOf, st) {
  const data = {
    v: 1,
    m: st?.mode,
    r: runs.map((r) => {
      const ev = evOf(r);
      const sp = (ev?.splits || []).filter((s) => r.markers?.splits?.[s.id] != null).map((s) => [s.name, +r.markers.splits[s.id].toFixed(3)]);
      return {
        y: r.source.ytId,
        s: r.markers?.start != null ? +r.markers.start.toFixed(3) : null,
        f: r.markers?.finish != null ? +r.markers.finish.toFixed(3) : null,
        t: r.rawTime ?? null,
        c: r.cones || 0,
        l: [driverName(r.driverId), r.runNumber != null ? `Run ${r.runNumber}` : null].filter(Boolean).join(' · ') || 'Run',
        sp,
      };
    }),
  };
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(escape(atob(b64)));
  const data = JSON.parse(json);
  const names = [];
  for (const r of data.r) for (const [n] of r.sp || []) if (!names.includes(n)) names.push(n);
  const ev = { id: 'shared', name: 'Shared comparison', splits: names.map((n, i) => ({ id: 's' + i, name: n })) };
  const runs = data.r.map((r, i) => ({
    id: 'shared' + i,
    eventId: 'shared',
    title: r.l,
    sharedLabel: r.l,
    runNumber: null,
    rawTime: r.t,
    cones: r.c || 0,
    status: 'ok',
    source: { type: 'youtube', ytId: r.y },
    markers: { start: r.s, finish: r.f, splits: Object.fromEntries((r.sp || []).map(([n, t]) => [ev.splits.find((s) => s.name === n).id, t])) },
    annotations: [],
  }));
  return { runs, events: new Map([['shared', ev]]), mode: data.m };
}

function shareDialog(runs, evOf, st) {
  const url = `${location.origin}${location.pathname}#/shared/${encodeShare(runs, evOf, st)}`;
  const input = h('input', { class: 'input', value: url, readonly: true, onfocus: (e) => e.target.select() });
  modal({
    title: 'Share this comparison',
    body: h('div', null, h('p', { class: 'sub' }, 'Anyone with this link can watch these YouTube runs synced, with your start/split marks. Nothing is uploaded — everything is in the link.'), input),
    actions: [{ label: 'Close' }, { label: 'Copy link', primary: true, keepOpen: true, onClick: async () => { try { await navigator.clipboard.writeText(url); toast('Link copied.', { type: 'ok' }); } catch { input.select(); document.execCommand('copy'); toast('Link copied.', { type: 'ok' }); } } }],
  });
}

async function saveShared(runs, input) {
  const ev0 = input.events?.get('shared');
  const ev = await store.put('events', { id: store.uid(), name: 'Shared comparison', date: new Date().toISOString().slice(0, 10), splits: (ev0?.splits || []).map((s) => ({ ...s, id: store.uid(), _old: s.id })), notes: '' });
  const ids = [];
  for (const r of runs) {
    let driverId = null;
    if (r.sharedLabel) {
      const name = r.sharedLabel.split(' · ')[0];
      if (name && !/^Run \d+$/.test(name)) {
        const existing = store.all('drivers').find((d) => d.name === name);
        driverId = existing?.id || (await store.put('drivers', { id: store.uid(), name })).id;
      }
    }
    const splits = {};
    for (const s of ev.splits) if (r.markers.splits[s._old] != null) splits[s.id] = r.markers.splits[s._old];
    const runNumber = parseInt((r.sharedLabel || '').match(/Run (\d+)/)?.[1]) || null;
    const nr = store.newRun({ eventId: ev.id, driverId, runNumber, rawTime: r.rawTime, cones: r.cones, source: r.source, markers: { ...r.markers, splits } });
    await store.put('runs', nr);
    ids.push(nr.id);
  }
  ev.splits.forEach((s) => delete s._old);
  await store.put('events', ev);
  toast('Saved to your library.', { type: 'ok' });
  setSelection(ids);
  location.hash = `#/compare/${ids.join(',')}`;
}
