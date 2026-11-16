// App bootstrap: router, header, compare tray, global drag-and-drop import, analysis indicator.

import * as store from './store.js';
import { h, clear, $, toast, getSelection, onSelection, setSelection, toggleSelected, isTyping, fill } from './ui.js';
import { runTitle } from './common.js';
import { renderLibrary } from './views/library.js';
import { renderEvent } from './views/event.js';
import { renderRun } from './views/run.js';
import { renderCompare, decodeShare } from './views/compare.js';
import { renderProgress } from './views/progress.js';
import { openSettings } from './views/settings.js';
import { openImport } from './views/import.js';
import { onAnalysis, activeJobs } from './analyze.js';
import { parseYouTubeId } from './model.js';

const view = $('#view');
let cleanup = null;
let current = { name: null, live: false };

const routes = [
  [/^#?\/?$/, () => ({ name: 'library', live: true, render: (r) => renderLibrary(r) })],
  [/^#\/event\/([\w-]+)$/, (m) => ({ name: 'event', live: true, render: (r) => renderEvent(r, m[1]) })],
  [/^#\/run\/([\w-]+)$/, (m) => ({ name: 'run', live: false, render: (r) => renderRun(r, m[1]) })],
  [/^#\/compare\/?([\w,-]*)$/, (m) => ({ name: 'compare', live: false, render: (r) => {
    const ids = (m[1] || '').split(',').filter(Boolean);
    return renderCompare(r, { runs: (ids.length ? ids : getSelection()).map((id) => store.get('runs', id)) });
  } })],
  [/^#\/shared\/(.+)$/, (m) => ({ name: 'shared', live: false, render: (r) => {
    try {
      const d = decodeShare(m[1]);
      return renderCompare(r, { runs: d.runs, events: d.events, ephemeral: true, title: 'Shared comparison' });
    } catch (e) { fill(r, h('div', { class: 'empty' }, 'This share link is invalid or truncated.')); }
  } })],
  [/^#\/progress$/, () => ({ name: 'progress', live: true, render: (r) => renderProgress(r) })],
];

function route() {
  const hash = location.hash || '#/';
  let match = null;
  for (const [re, fn] of routes) { const m = hash.match(re); if (m) { match = fn(m); break; } }
  if (!match) match = routes[0][1]();
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  current = match;
  document.body.dataset.view = match.name;
  for (const a of document.querySelectorAll('.nav a')) a.classList.toggle('active', a.dataset.view === match.name || (match.name === 'event' && a.dataset.view === 'library'));
  window.scrollTo(0, 0);
  cleanup = match.render(view) || null;
  renderTray();
}

// Live views re-render on data changes — but never while the user is typing in them.
let pending = false;
function scheduleRerender() {
  if (!current.live || pending) return;
  pending = true;
  const go = () => {
    const a = document.activeElement;
    if (a && view.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) {
      a.addEventListener('blur', () => setTimeout(go, 50), { once: true });
      return;
    }
    if (document.querySelector('.modal-overlay')) { setTimeout(go, 300); return; }
    pending = false;
    if (!current.live) return;
    const y = window.scrollY;
    if (typeof cleanup === 'function') cleanup();
    cleanup = current.render(view) || null;
    window.scrollTo(0, y);
  };
  setTimeout(go, 120);
}

// ---------- compare tray ----------
function renderTray() {
  const tray = $('#tray');
  const sel = getSelection().map((id) => store.get('runs', id)).filter(Boolean);
  if (sel.length !== getSelection().length) setSelection(sel.map((r) => r.id));
  const hide = !sel.length || current.name === 'compare' || current.name === 'shared';
  tray.hidden = hide;
  if (hide) return;
  fill(tray, 
    h('span', { class: 'tray-label' }, `Compare (${sel.length}/4):`),
    sel.map((r) => h('span', { class: 'tray-chip' }, runTitle(r), h('button', { class: 'icon-btn', title: 'Remove', onclick: () => toggleSelected(r.id, false) }, '✕'))),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn btn-ghost btn-small', onclick: () => setSelection([]) }, 'Clear'),
    h('button', { class: 'btn btn-primary', disabled: sel.length < 2, onclick: () => { location.hash = `#/compare/${sel.map((r) => r.id).join(',')}`; } }, sel.length < 2 ? 'Pick one more' : '⇄ Compare'),
  );
}

// ---------- analysis indicator ----------
function renderJobs() {
  const el = $('#jobs');
  const jobs = activeJobs();
  if (!jobs.length) { el.hidden = true; return; }
  el.hidden = false;
  const p = jobs.reduce((s, j) => s + (j.progress || 0), 0) / jobs.length;
  el.textContent = `Analyzing ${jobs.length} video${jobs.length > 1 ? 's' : ''}… ${Math.round(p * 100)}%`;
}

// ---------- drag & drop anywhere ----------
function setupDrop() {
  let depth = 0;
  const overlay = $('#drop-overlay');
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files') || document.querySelector('.modal-overlay')) return;
    depth++; overlay.hidden = false;
  });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) overlay.hidden = true; });
  window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    depth = 0; overlay.hidden = true;
    if (!e.dataTransfer?.files?.length || document.querySelector('.modal-overlay')) return;
    e.preventDefault();
    const evId = (location.hash.match(/^#\/event\/([\w-]+)/) || [])[1] || null;
    openImport({ files: [...e.dataTransfer.files], eventId: evId });
  });
}

// ---------- legacy share links (?v1=&v2=&t1=&t2=) from the previous version of this tool ----------
function legacyRedirect() {
  const q = new URLSearchParams(location.search);
  const v1 = q.get('v1'), v2 = q.get('v2');
  if (!v1 || !v2) return;
  const runs = [[v1, q.get('t1')], [v2, q.get('t2')]].map(([url, t], i) => ({ y: parseYouTubeId(url), s: t != null ? parseFloat(t) || 0 : null, f: null, t: null, c: 0, l: `Run ${'AB'[i]}`, sp: [] }));
  if (runs.some((r) => !r.y)) return;
  const enc = btoa(JSON.stringify({ v: 1, r: runs })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  history.replaceState(null, '', `${location.pathname}#/shared/${enc}`);
}

async function boot() {
  try {
    await store.openDB();
  } catch (e) {
    fill(view, h('div', { class: 'empty error' }, h('h2', null, 'Could not open local storage'), h('p', null, e.message), h('p', { class: 'sub' }, 'Private browsing modes may block IndexedDB.')));
    return;
  }
  legacyRedirect();
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-import').addEventListener('click', () => openImport({ eventId: (location.hash.match(/^#\/event\/([\w-]+)/) || [])[1] || null }));
  $('#btn-help').addEventListener('click', showHelp);
  store.onChange((s) => { if (s !== 'videos' && s !== 'analysis') scheduleRerender(); if (s === 'runs') renderTray(); });
  onSelection(renderTray);
  onAnalysis(renderJobs);
  setupDrop();
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => { if (e.key === '?' && !isTyping(e)) showHelp(); });
  route();
}

function showHelp() {
  import('./ui.js').then(({ modal }) => modal({
    title: 'Keyboard shortcuts',
    wide: true,
    body: h('div', { class: 'help-grid' },
      h('div', null, h('h3', null, 'Run editor'), keys([
        ['Space', 'Play / pause'], ['← →', 'Step one frame'], ['Shift + ← →', 'Jump 1 second'], ['S', 'Set start (launch) at current frame'],
        ['1 – 9', 'Set course split'], ['F', 'Set finish'], ['N', 'Add a timed note'], ['Home / End', 'Go to start / finish mark'], ['[ ]', 'Slower / faster'],
      ])),
      h('div', null, h('h3', null, 'Compare'), keys([
        ['Space', 'Play / pause all'], ['← →', 'Step one frame'], ['Shift + ← →', 'Jump 1 second'], ['Home', 'Back to the start'], ['1 – 9', 'Jump to split'],
        ['L', 'Loop current segment'], ['P', 'Toggle real-time / position-locked'], ['O', 'Cycle layout'], ['M', 'Cycle audio source'], ['A', 'Adjust sync mode'],
        ['F', 'Fullscreen'], ['[ ]', 'Slower / faster'], ['Scroll / drag on video', 'Zoom / pan (double-click resets)'],
      ])),
    ),
  }));
}
const keys = (list) => h('table', { class: 'table compact' }, h('tbody', null, list.map(([k, d]) => h('tr', null, h('td', null, h('kbd', null, k)), h('td', null, d)))));

boot();

// Offline support: the app shell is cached so it opens at the track without signal.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
