// Shared view helpers: entity pickers, run descriptions, thumbnails, video sources.

import * as store from './store.js';
import { h, promptDialog, toast, pickFiles } from './ui.js';
import { adjustedTime, fmtTime, fmtDate, STATUSES } from './model.js';
import { ytThumb } from './players.js';
import { queueAnalysis } from './analyze.js';

export function driverName(id) { return store.get('drivers', id)?.name || ''; }
export function carName(id) { return store.get('cars', id)?.name || ''; }

export function runTitle(run) {
  if (run.sharedLabel) return run.sharedLabel;
  const parts = [];
  const d = driverName(run.driverId);
  if (d) parts.push(d);
  parts.push(run.runNumber != null ? `Run ${run.runNumber}` : 'Run');
  return parts.join(' · ');
}

export function runSubtitle(run) {
  const ev = store.get('events', run.eventId);
  const parts = [];
  if (ev) parts.push(ev.name || 'Event');
  if (ev?.date) parts.push(fmtDate(ev.date));
  const car = carName(run.carId);
  if (car) parts.push(car);
  return parts.join(' · ');
}

export function timeSummary(run) {
  const pen = store.settings.conePenalty;
  if (run.status && run.status !== 'ok') return `${fmtTime(run.rawTime)} ${STATUSES[run.status]}`;
  if (run.rawTime == null) return 'no time';
  const adj = adjustedTime(run, pen);
  return run.cones ? `${fmtTime(adj)} (${fmtTime(run.rawTime)} +${run.cones})` : fmtTime(adj);
}

export function thumbEl(run, cls = 'thumb') {
  const src = run.thumb || (run.source?.type === 'youtube' ? ytThumb(run.source.ytId) : null);
  return src ? h('img', { class: cls, src, alt: '', loading: 'lazy' }) : h('div', { class: `${cls} thumb-empty` }, run.source ? '▶' : '—');
}

/** Select for drivers/cars with an inline "+ New…" option. */
export function entitySelect(kind, value, onChange, { allowNone = true, placeholder } = {}) {
  const label = kind === 'drivers' ? 'driver' : 'car';
  const items = store.all(kind).sort((a, b) => a.name.localeCompare(b.name));
  const sel = h('select', { class: 'input' },
    allowNone ? h('option', { value: '' }, placeholder || `— ${label} —`) : null,
    items.map((d) => h('option', { value: d.id, selected: d.id === value }, d.name)),
    h('option', { value: '__new' }, `+ New ${label}…`),
  );
  sel.addEventListener('change', async () => {
    if (sel.value === '__new') {
      const name = await promptDialog(`New ${label} name`, '', { title: `Add ${label}` });
      if (name && name.trim()) {
        const obj = await createEntity(kind, name.trim());
        sel.insertBefore(h('option', { value: obj.id }, obj.name), sel.lastChild);
        sel.value = obj.id;
        onChange(obj.id);
      } else sel.value = value || '';
      return;
    }
    value = sel.value || null;
    onChange(value);
  });
  return sel;
}

export async function createEntity(kind, name) {
  const existing = store.all(kind).find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  return store.put(kind, { id: store.uid(), name });
}

export function statusBadge(run) {
  if (!run.status || run.status === 'ok') return null;
  return h('span', { class: `badge badge-${run.status}` }, STATUSES[run.status]);
}

export function markerBadges(run, event) {
  const m = run.markers || {};
  const nSplits = Object.values(m.splits || {}).filter((v) => v != null).length;
  const total = event?.splits?.length || 0;
  return h('span', { class: 'marker-badges' },
    h('span', { class: `mk ${m.start != null ? (m.startAuto ? 'mk-auto' : 'mk-on') : ''}`, title: m.start != null ? (m.startAuto ? 'Start auto-detected (unconfirmed)' : 'Start marked') : 'Start not marked' }, 'S'),
    total ? h('span', { class: `mk ${nSplits === total ? 'mk-on' : nSplits ? 'mk-part' : ''}`, title: `${nSplits}/${total} splits marked` }, `${nSplits}/${total}`) : null,
    h('span', { class: `mk ${m.finish != null ? 'mk-on' : run.rawTime != null && m.start != null ? 'mk-auto' : ''}`, title: m.finish != null ? 'Finish marked' : 'Finish estimated from official time' }, 'F'),
  );
}

/** Resolve a playable source for a run. Returns {kind:'local'|'youtube'|'url', src|ytId} or {missing:true}. */
export async function resolveSource(run) {
  const s = run.source;
  if (!s) return { none: true };
  if (s.type === 'youtube') return { kind: 'youtube', ytId: s.ytId };
  if (s.type === 'url') return { kind: 'url', src: s.url };
  if (s.type === 'local') {
    const file = await store.getVideoFile(s.videoId);
    if (!file) return { missing: true, videoId: s.videoId, name: s.fileName };
    return { kind: 'local', file, videoId: s.videoId };
  }
  return { none: true };
}

/**
 * Attach / re-link / replace a run's local video.
 * Same file (name + size match): just make it available again (all runs sharing it benefit).
 * Different file: the run gets that video; cached analysis, thumbnail and fps are reset and re-computed.
 * If other runs share the old video, only this run is switched to the new one.
 */
export async function relinkFlow(run) {
  const [file] = await pickFiles({ multiple: false });
  if (!file) return false;
  const s = run.source || {};
  const same = s.type === 'local' && s.videoId && s.fileName === file.name && (!s.fileSize || s.fileSize === file.size);
  if (same) {
    await store.relinkVideo(s.videoId, file);
    return true;
  }
  if (s.fileName) toast(`Using "${file.name}" (was "${s.fileName}"). Check the marks — they were set on the old file.`, { type: 'warn', ms: 6000 });
  const sharers = s.videoId ? store.all('runs').filter((r) => r.source?.videoId === s.videoId && r.id !== run.id) : [];
  let videoId;
  if (s.type === 'local' && s.videoId && !sharers.length) {
    videoId = s.videoId;
    await store.relinkVideo(videoId, file);
    await store.delBig('analysis', videoId).catch(() => {});
  } else {
    videoId = await store.addVideo(file);
  }
  run.source = { type: 'local', videoId, fileName: file.name, fileSize: file.size };
  delete run.thumb; run.fps = null; run.duration = null;
  await store.put('runs', run);
  await store.gcVideos();
  if (store.settings.autoAnalyze) queueAnalysis(videoId, { force: true });
  return true;
}

export function eventLabel(ev) {
  if (!ev) return 'No event';
  return [ev.name || 'Untitled event', ev.date ? fmtDate(ev.date) : null].filter(Boolean).join(' — ');
}

export function eventOptions() {
  return store.all('events').sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
}

export function nextRunNumber(eventId, driverId) {
  const runs = store.runsOfEvent(eventId).filter((r) => !driverId || r.driverId === driverId);
  return runs.reduce((m, r) => Math.max(m, r.runNumber || 0), 0) + 1;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tagChips(tags = []) {
  return tags.length ? h('span', { class: 'tags' }, tags.map((t) => h('span', { class: 'tag' }, t))) : null;
}

export function allTags() {
  const s = new Set();
  for (const r of store.all('runs')) for (const t of r.tags || []) s.add(t);
  return [...s].sort();
}
