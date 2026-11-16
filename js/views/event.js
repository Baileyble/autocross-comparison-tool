// Event page: details, quick time entry, course splits, split analysis, progression chart, course map.

import * as store from '../store.js';
import { h, clear, modal, toast, confirmDialog, promptDialog, isSelected, toggleSelected, setSelection, onSelection, debounce, pickFiles, add, fill } from '../ui.js';
import { entitySelect, driverName, markerBadges, thumbEl, today, nextRunNumber, recalibrateBeam, runTitle, indexedTime } from '../common.js';
import { autoMarkSplits } from '../automark.js';
import { adjustedTime, bestRun, fmtTime, fmtDelta, fmtDate, parseTime, splitTable, theoreticalBest, isCleanRun, STATUSES } from '../model.js';
import { lineChart } from '../charts.js';
import { openImport } from './import.js';

const DRIVER_COLORS = ['#ff7a1a', '#22d3ee', '#a3e635', '#f472b6', '#facc15', '#a78bfa', '#fb7185', '#34d399'];

export function openEventEditor(ev = null) {
  const isNew = !ev;
  const d = ev ? { ...ev } : { id: store.uid(), name: '', date: today(), location: '', club: '', courseName: '', conditions: '', splits: [], notes: '' };
  const f = (key, label, attrs = {}) => h('label', { class: 'field' }, h('span', null, label),
    h('input', { class: 'input', value: d[key] || '', oninput: (e) => { d[key] = e.target.value; }, ...attrs }));
  modal({
    title: isNew ? 'New event' : 'Edit event',
    body: h('div', null,
      h('div', { class: 'grid2' }, f('name', 'Event name', { placeholder: 'e.g. Points Event #4' }), f('date', 'Date', { type: 'date' })),
      h('div', { class: 'grid2' }, f('location', 'Location / site'), f('club', 'Club / region')),
      h('div', { class: 'grid2' }, f('courseName', 'Course name', { placeholder: 'Optional — helps compare same course across events' }), f('conditions', 'Conditions', { placeholder: 'e.g. dry, 75°F, green surface' })),
    ),
    actions: [
      { label: 'Cancel' },
      { label: isNew ? 'Create event' : 'Save', primary: true, onClick: async () => {
        d.name = d.name.trim() || 'Autocross';
        await store.put('events', d);
        if (isNew) location.hash = `#/event/${d.id}`;
      } },
    ],
  });
}

export function renderEvent(root, id) {
  const ev = store.get('events', id);
  if (!ev) { fill(root, h('div', { class: 'empty' }, 'Event not found. ', h('a', { href: '#/' }, 'Back to library'))); return; }
  ev.splits ||= [];
  const runs = store.runsOfEvent(id);
  recalibrateBeam(ev); // async; re-renders via the store if it changed
  const pen = store.settings.conePenalty;
  const driverIds = [...new Set(runs.map((r) => r.driverId || ''))];
  const colorOf = (d) => DRIVER_COLORS[driverIds.indexOf(d || '') % DRIVER_COLORS.length];

  // ---- header ----
  const head = h('div', { class: 'page-head' },
    h('div', null,
      h('div', { class: 'crumbs' }, h('a', { href: '#/' }, 'Library'), ' / ', 'Event'),
      h('h1', null, ev.name || 'Untitled event'),
      h('p', { class: 'sub' }, [ev.date && fmtDate(ev.date), ev.location, ev.club, ev.courseName && `Course: ${ev.courseName}`, ev.conditions].filter(Boolean).join(' · ')),
    ),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: () => openEventEditor(ev) }, 'Edit'),
      h('button', { class: 'btn', onclick: () => addBlankRun(ev) }, '+ Run without video'),
      h('button', { class: 'btn btn-primary', onclick: () => openImport({ eventId: id }) }, '⬆ Import runs'),
      h('button', { class: 'btn btn-ghost danger', title: 'Delete event', onclick: async () => {
        if (await confirmDialog(`Delete "${ev.name}" and its ${runs.length} run(s)? Stored video copies for these runs are removed too.`, { danger: true, okLabel: 'Delete' })) {
          await store.deleteEvent(id); location.hash = '#/';
        }
      } }, '🗑'),
    ),
  );

  // ---- summary tiles ----
  const best = bestRun(runs, pen);
  const tbl = splitTable(runs.filter((r) => r.markers?.start != null), ev);
  const refTime = ev.refTime ?? null;
  const hasIndex = runs.some((r) => indexedTime(r) != null);
  let bestIdx = null;
  for (const r of runs) { const t = indexedTime(r); if (t != null && (!bestIdx || t < bestIdx.t)) bestIdx = { r, t }; }
  const tiles = h('div', { class: 'tiles' },
    tile('Runs', String(runs.length)),
    tile('Fastest', best ? fmtTime(adjustedTime(best, pen)) : '—', best ? `${driverName(best.driverId) || '—'} · run ${best.runNumber ?? '?'}` : ''),
    bestIdx ? tile('Fastest indexed', fmtTime(bestIdx.t), `${driverName(bestIdx.r.driverId) || '—'} · run ${bestIdx.r.runNumber ?? '?'}`) : null,
    tile('Cones', String(runs.reduce((s, r) => s + (r.cones || 0), 0))),
    tile('Theoretical best', tbl.theoretical != null && ev.splits.length ? fmtTime(tbl.theoretical) : '—', ev.splits.length ? 'best of each segment, all drivers' : 'add course splits to enable'),
  );

  // ---- runs quick-entry table ----
  const bestPerDriver = new Map();
  for (const d of driverIds) { const b = bestRun(runs.filter((r) => (r.driverId || '') === d), pen); if (b) bestPerDriver.set(d, adjustedTime(b, pen)); }
  const runsTable = runs.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table runs-table entry-table' },
    h('thead', null, h('tr', null,
      h('th', { title: 'Select to compare' }, '⇄'), h('th', { class: 'col-sm-hide' }, ''), h('th', null, '#'), h('th', null, 'Driver'), h('th', { class: 'col-sm-hide' }, 'Car'),
      h('th', { class: 'r' }, 'Raw time'), h('th', { class: 'r' }, 'Cones'), h('th', null, 'Status'), h('th', { class: 'r' }, 'Adjusted'), hasIndex ? h('th', { class: 'r', title: 'Adjusted × car index factor (set per car in Settings)' }, 'Indexed') : null, h('th', { class: 'r col-sm-hide' }, 'Δ own best'), h('th', { class: 'col-sm-hide' }, 'Marks'), h('th', null, ''),
    )),
    h('tbody', null, runs.map((r) => {
      const adj = adjustedTime(r, pen);
      const own = bestPerDriver.get(r.driverId || '');
      const save = async () => { await store.put('runs', r); };
      const isBest = adj != null && adj === own;
      return h('tr', { class: isBest ? 'best-row' : '' },
        h('td', null, h('input', { type: 'checkbox', 'data-run': r.id, checked: isSelected(r.id), onchange: (e) => { if (!toggleSelected(r.id, e.target.checked)) e.target.checked = false; } })),
        h('td', { class: 'col-sm-hide' }, h('a', { href: `#/run/${r.id}` }, thumbEl(r, 'row-thumb'))),
        h('td', null, h('input', { class: 'input num', type: 'number', min: 1, value: r.runNumber ?? '', style: { width: '4.2em' }, onchange: (e) => { r.runNumber = parseInt(e.target.value) || null; save(); } })),
        h('td', null, h('span', { class: 'dot', style: { background: colorOf(r.driverId) } }), entitySelect('drivers', r.driverId, (v) => { r.driverId = v; save(); })),
        h('td', { class: 'col-sm-hide' }, entitySelect('cars', r.carId, (v) => { r.carId = v; save(); })),
        h('td', { class: 'r' }, h('input', { class: 'input num time-input', inputmode: 'decimal', enterkeyhint: 'next', value: r.rawTime != null ? fmtTime(r.rawTime) : '', placeholder: '00.000', onkeydown: nextTimeOnEnter, onchange: (e) => {
          const t = parseTime(e.target.value);
          if (e.target.value.trim() && t == null) { toast('Time format: 45.123 or 1:05.123', { type: 'warn' }); return; }
          r.rawTime = t; save();
        } })),
        h('td', { class: 'r' }, h('input', { class: 'input num', type: 'number', min: 0, value: r.cones || 0, style: { width: '3.8em' }, onchange: (e) => { r.cones = Math.max(0, parseInt(e.target.value) || 0); save(); } })),
        h('td', null, h('select', { class: 'input', onchange: (e) => { r.status = e.target.value; save(); } },
          Object.entries(STATUSES).map(([k, v]) => h('option', { value: k, selected: (r.status || 'ok') === k }, v)))),
        h('td', { class: 'r mono strong' }, fmtTime(adj)),
        hasIndex ? h('td', { class: 'r mono' }, fmtTime(indexedTime(r))) : null,
        h('td', { class: 'r mono col-sm-hide' }, adj != null && own != null ? (isBest ? h('span', { class: 'badge badge-best' }, 'BEST') : fmtDelta(adj - own)) : '—'),
        h('td', { class: 'col-sm-hide' }, markerBadges(r, ev)),
        h('td', null, h('a', { class: 'btn btn-small', href: `#/run/${r.id}` }, r.source ? 'Open' : 'Details')),
      );
    })),
  )) : h('div', { class: 'empty' }, 'No runs yet. Import videos, or add runs without video to keep a record of times.');

  const compareBar = runs.length > 1 ? h('div', { class: 'row-actions' },
    h('button', { class: 'btn btn-small', onclick: () => compareBestPerDriver(runs) }, 'Compare each driver\'s best'),
    h('button', { class: 'btn btn-small', onclick: () => compareMyProgression(runs) }, 'Compare first vs best (per driver)'),
  ) : null;

  // ---- splits editor ----
  const splitsBox = h('div', { class: 'splits-editor' },
    ev.splits.length ? h('ol', { class: 'split-list' }, ev.splits.map((s, i) => h('li', null,
      h('span', { class: 'split-num' }, String(i + 1)),
      h('span', { class: 'split-name' }, s.name),
      h('button', { class: 'icon-btn', title: 'Rename', onclick: async () => { const n = await promptDialog('Split name', s.name); if (n?.trim()) { s.name = n.trim(); await store.put('events', ev); } } }, '✎'),
      h('button', { class: 'icon-btn', title: 'Move earlier', disabled: i === 0, onclick: async () => { [ev.splits[i - 1], ev.splits[i]] = [ev.splits[i], ev.splits[i - 1]]; await store.put('events', ev); } }, '↑'),
      h('button', { class: 'icon-btn', title: 'Move later', disabled: i === ev.splits.length - 1, onclick: async () => { [ev.splits[i + 1], ev.splits[i]] = [ev.splits[i], ev.splits[i + 1]]; await store.put('events', ev); } }, '↓'),
      h('button', { class: 'icon-btn danger', title: 'Remove', onclick: async () => {
        if (!(await confirmDialog(`Remove split "${s.name}"? Its marks on all runs are removed.`, { danger: true, okLabel: 'Remove' }))) return;
        ev.splits.splice(i, 1);
        for (const r of runs) if (r.markers?.splits?.[s.id] != null) { delete r.markers.splits[s.id]; await store.put('runs', r); }
        await store.put('events', ev);
      } }, '✕'),
    ))) : h('p', { class: 'sub' }, 'No splits yet. Splits are course landmarks (e.g. "Slalom entry", "Turnaround", "Last gate") that you mark in each run\'s video. They power segment times, theoretical best and position-locked playback.'),
    h('button', { class: 'btn btn-small', onclick: async () => {
      const n = await promptDialog('Split name', `Split ${ev.splits.length + 1}`, { title: 'Add course split' });
      if (n?.trim()) { ev.splits.push({ id: store.uid(), name: n.trim() }); await store.put('events', ev); }
    } }, '+ Add split'),
    ev.splits.length && runs.filter((r) => r.source?.type === 'local').length > 1
      ? h('button', { class: 'btn btn-small', title: 'Mark splits on one run by hand, then copy them to the other runs by matching what the cameras see', onclick: () => autoMarkDialog(ev, runs) }, '✨ Auto-mark splits from a reference run')
      : null,
  );

  // ---- split analysis ----
  const splitSection = ev.splits.length && tbl.rows.some((r) => r.times.some((t) => t != null)) ? splitAnalysis(ev, tbl, colorOf) : null;

  // ---- chart ----
  const series = driverIds.map((d) => ({
    name: driverName(d) || 'Unknown',
    color: colorOf(d),
    points: runs.filter((r) => (r.driverId || '') === d && r.runNumber != null).map((r) => {
      const a = adjustedTime(r, pen);
      return { x: r.runNumber, y: a ?? NaN, highlight: a != null && a === bestPerDriver.get(d), marker: a == null, label: a != null ? `run ${r.runNumber}: ${fmtTime(a)}${r.cones ? ` (${r.cones} cone${r.cones > 1 ? 's' : ''})` : ''}` : `run ${r.runNumber}: ${STATUSES[r.status] || 'no time'}` };
    }),
  }));
  const chart = lineChart(series, { integerX: true, xLabel: 'Run #', yFmt: (v, d = 1) => v.toFixed(d), title: 'Adjusted time by run' });

  // ---- notes, reference time & course map ----
  const saveEv = debounce(() => store.put('events', ev), 500);
  const mapBox = h('div', { class: 'course-map' });
  renderMap(ev, mapBox);
  const extras = h('div', { class: 'grid2 top' },
    h('div', null,
      h('h2', { class: 'section-title' }, 'Event notes'),
      h('textarea', { class: 'input', rows: 6, placeholder: 'Course walk notes, what worked, what to try next time…', value: ev.notes || '', oninput: (e) => { ev.notes = e.target.value; saveEv(); } }),
      h('label', { class: 'field inline' }, h('span', null, 'Reference time (e.g. FTD or class winner)'),
        h('input', { class: 'input num time-input', value: ev.refTime != null ? fmtTime(ev.refTime) : '', placeholder: '—', onchange: async (e) => {
          const raw = e.target.value.trim();
          const t = parseTime(raw);
          if (raw && t == null) { toast('Time format: 45.123 or 1:05.123', { type: 'warn' }); e.target.value = ev.refTime != null ? fmtTime(ev.refTime) : ''; return; }
          ev.refTime = t; // empty clears it on purpose
          await store.put('events', ev);
        } })),
      h('p', { class: 'hint' }, 'Used on the Progress page to show your best as a % of a reference — the fairest way to compare across different courses.'),
      h('label', { class: 'field inline' }, h('span', null, 'Launch → timing-beam offset (s)'),
        h('input', { class: 'input num time-input', value: ev.beamOffset != null ? ev.beamOffset.toFixed(3) : '', placeholder: '0.000', onchange: async (e) => {
          const raw = e.target.value.trim();
          if (!raw) { ev.beamOffsetManual = false; ev.beamOffset = null; await store.put('events', ev); await recalibrateBeam(ev); return; }
          const v = parseFloat(raw.replace(',', '.'));
          if (!Number.isFinite(v) || Math.abs(v) > 5) { toast('Enter seconds, e.g. 0.35', { type: 'warn' }); e.target.value = ev.beamOffset != null ? ev.beamOffset.toFixed(3) : ''; return; }
          ev.beamOffset = v; ev.beamOffsetManual = true; await store.put('events', ev);
        } })),
      h('p', { class: 'hint' }, ev.beamOffsetManual
        ? 'Set by hand. Clear the field to calibrate automatically again.'
        : ev.beamOffset != null
          ? `Auto-calibrated from runs with both a finish mark and an official time. Used to place the finish on runs where you only entered the time.`
          : 'Your start mark is the launch, but the official clock starts at the timing beam. Mark the finish on at least one run that has an official time and this is calibrated automatically.'),
    ),
    h('div', null, h('h2', { class: 'section-title' }, 'Course map'), mapBox),
  );

  fill(root, 
    head, tiles,
    h('section', null, h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Runs'), compareBar), runsTable),
    chart ? h('section', null, h('h2', { class: 'section-title' }, 'Progression'), h('div', { class: 'card' }, chart)) : null,
    h('section', null, h('h2', { class: 'section-title' }, 'Course splits'), splitsBox),
    splitSection,
    h('section', null, extras),
  );
  // Keep compare checkboxes in step with the tray (Clear / ✕ there).
  const off = onSelection(() => { for (const cb of root.querySelectorAll('input[data-run]')) cb.checked = isSelected(cb.dataset.run); });
  return () => off();
}

function tile(label, value, sub = '') {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, label), h('div', { class: 'tile-value mono' }, value), sub ? h('div', { class: 'tile-sub' }, sub) : null);
}

function splitAnalysis(ev, tbl, colorOf) {
  const rows = tbl.rows.filter((r) => r.times.some((t) => t != null));
  // Theoretical best per driver
  const byDriver = new Map();
  for (const r of rows) { const d = r.run.driverId || ''; if (!byDriver.has(d)) byDriver.set(d, []); byDriver.get(d).push(r); }
  const tbRows = [...byDriver.keys()].map((d) => {
    // Clean runs only; totals from all of the driver's clean runs (even ones without split marks).
    const all = tbl.rows.filter((r) => (r.run.driverId || '') === d && isCleanRun(r.run));
    const best = tbl.segments.map((_, i) => { const v = all.map((r) => r.times[i]).filter((x) => x != null && x > 0); return v.length ? Math.min(...v) : null; });
    const totals = all.map((r) => r.total).filter((x) => x != null);
    const fastest = totals.length ? Math.min(...totals) : null;
    return { d, best, tb: theoreticalBest(best, totals), fastest };
  });
  return h('section', null,
    h('h2', { class: 'section-title' }, 'Segment times ', h('span', { class: 'sub' }, '(from video marks; purple = fastest overall, green = driver\'s best)')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table split-table' },
      h('thead', null, h('tr', null, h('th', null, 'Run'), tbl.segments.map((s) => h('th', { class: 'r' }, s.label)), h('th', { class: 'r' }, 'Video total'))),
      h('tbody', null,
        rows.map((r) => {
          const mine = tbRows.find((x) => x.d === (r.run.driverId || ''));
          const clean = isCleanRun(r.run);
          return h('tr', { class: clean ? '' : 'muted', title: clean ? '' : `${STATUSES[r.run.status]} — not counted in best segments` },
            h('td', null, h('span', { class: 'dot', style: { background: colorOf(r.run.driverId) } }), h('a', { href: `#/run/${r.run.id}` }, `${driverName(r.run.driverId) || '—'} #${r.run.runNumber ?? '?'}`), clean ? null : h('span', { class: `badge badge-${r.run.status}` }, STATUSES[r.run.status])),
            r.times.map((t, i) => h('td', { class: `r mono ${clean && t != null && t === tbl.best[i] ? 'seg-best' : clean && t != null && t === mine?.best[i] ? 'seg-pb' : ''}` }, t != null ? fmtTime(t, 2) : '—')),
            h('td', { class: 'r mono' }, r.total != null ? fmtTime(r.total, 2) : '—'),
          );
        }),
        tbRows.filter((x) => x.tb != null).map((x) => h('tr', { class: 'tb-row' },
          h('td', null, `Theoretical best — ${driverName(x.d) || '—'}`),
          x.best.map((b) => h('td', { class: 'r mono' }, fmtTime(b, 2))),
          h('td', { class: 'r mono strong', title: x.fastest ? `${(x.fastest - x.tb).toFixed(2)} s faster than your fastest video total, if you put your best segments together` : '' }, fmtTime(x.tb, 2), x.fastest && x.fastest - x.tb > 0.005 ? h('div', { class: 'sub' }, `${(x.fastest - x.tb).toFixed(2)} s on the table`) : null),
        )),
      ),
    )),
  );
}

async function renderMap(ev, box) {
  clear(box);
  if (ev.mapImage) {
    add(box, h('img', { src: ev.mapImage, alt: 'Course map', class: 'map-img', onclick: () => modal({ title: 'Course map', wide: true, body: h('img', { src: ev.mapImage, style: { width: '100%' } }) }) }),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-small', onclick: () => pickMap(ev) }, 'Replace'),
        h('button', { class: 'btn btn-small btn-ghost', onclick: async () => { ev.mapImage = null; await store.put('events', ev); } }, 'Remove')));
  } else {
    add(box, h('div', { class: 'dropzone small', onclick: () => pickMap(ev) }, h('strong', null, 'Add a course map image'), h('span', null, ' — photo of the posted map or your own sketch.')));
  }
}

async function pickMap(ev) {
  const [file] = await pickFiles({ accept: 'image/*', multiple: false });
  if (!file) return;
  // Downscale to keep the database small.
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  ev.mapImage = c.toDataURL('image/jpeg', 0.85);
  await store.put('events', ev);
}

async function addBlankRun(ev) {
  const driverId = store.all('drivers').find((d) => d.isMe)?.id || store.all('drivers')[0]?.id || null;
  const prev = store.runsOfEvent(ev.id).filter((r) => r.driverId === driverId).pop();
  await store.put('runs', store.newRun({ eventId: ev.id, driverId, carId: prev?.carId || store.all('cars')[0]?.id || null, runNumber: nextRunNumber(ev.id, driverId) }));
}

function compareBestPerDriver(runs) {
  const pen = store.settings.conePenalty;
  const by = new Map();
  for (const r of runs) { const k = r.driverId || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const ids = [...by.values()].map((rs) => bestRun(rs.filter((r) => r.source), pen)).filter(Boolean)
    .sort((a, b) => adjustedTime(a, pen) - adjustedTime(b, pen)).map((r) => r.id).slice(0, 4);
  if (ids.length < 2) { toast('Need timed runs with video from at least two drivers.', { type: 'warn' }); return; }
  setSelection(ids);
  location.hash = `#/compare/${ids.join(',')}`;
}

function compareMyProgression(runs) {
  const pen = store.settings.conePenalty;
  const by = new Map();
  for (const r of runs.filter((x) => x.source)) { const k = r.driverId || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const ids = [];
  for (const rs of by.values()) {
    const b = bestRun(rs, pen);
    const first = rs.slice().sort((a, c) => (a.runNumber ?? 99) - (c.runNumber ?? 99))[0];
    if (b && first && b.id !== first.id) ids.push(b.id, first.id);
  }
  if (ids.length < 2) { toast('Need a driver with at least two runs with video (and a best that isn\'t the first run).', { type: 'warn' }); return; }
  setSelection(ids.slice(0, 4));
  location.hash = `#/compare/${ids.slice(0, 4).join(',')}`;
}

export { DRIVER_COLORS };

function autoMarkDialog(ev, runs) {
  const cands = runs.filter((r) => r.source?.type === 'local' && ev.splits.some((s) => r.markers?.splits?.[s.id] != null && !r.markers?.splitAuto?.[s.id]));
  if (!cands.length) { toast('First mark the splits by hand on one run (open it, press 1–9 at each landmark).', { type: 'warn', ms: 5000 }); return; }
  const manualCount = (r) => ev.splits.filter((s) => r.markers?.splits?.[s.id] != null && !r.markers?.splitAuto?.[s.id]).length;
  cands.sort((a, b) => manualCount(b) - manualCount(a));
  let refId = cands[0].id;
  const targets = runs.filter((r) => r.source?.type === 'local');
  const picks = new Map(targets.map((r) => [r.id, true]));
  const sel = h('select', { class: 'input', onchange: (e) => { refId = e.target.value; } },
    cands.map((r) => h('option', { value: r.id }, `${runTitle(r)} — ${manualCount(r)}/${ev.splits.length} splits marked by hand`)));
  modal({
    title: 'Auto-mark splits',
    wide: true,
    body: h('div', null,
      h('p', { class: 'sub' }, 'The reference run\'s split marks are copied to the other runs by aligning their videos frame by frame (works best when the runs were filmed from the same camera position). Marks you set by hand are never overwritten; new marks are flagged "auto" until you confirm them in each run.'),
      h('label', { class: 'field' }, h('span', null, 'Reference run'), sel),
      h('div', { class: 'field' }, h('span', null, 'Runs to mark'),
        h('div', { class: 'check-list' }, targets.map((r) => h('label', { class: 'field check' },
          h('input', { type: 'checkbox', checked: true, onchange: (e) => picks.set(r.id, e.target.checked) }), h('span', null, runTitle(r)))))),
    ),
    actions: [{ label: 'Cancel' }, { label: 'Auto-mark', primary: true, onClick: async () => {
      const ref = store.get('runs', refId);
      const tg = targets.filter((r) => picks.get(r.id) && r.id !== refId);
      toast('Aligning videos…', { ms: 1500 });
      try {
        const res = await autoMarkSplits(ref, tg, ev);
        const n = res.marked.filter((m) => m.count).length;
        const weak = res.marked.filter((m) => m.cost > 0.6);
        toast(`Marked splits on ${n} run${n === 1 ? '' : 's'}.${res.skipped.length ? ` Skipped ${res.skipped.length}: ${res.skipped.map((x) => `${runTitle(x.run)} (${x.reason})`).join(', ')}.` : ''}`, { type: n ? 'ok' : 'warn', ms: 7000 });
        if (weak.length) toast(`Alignment looked uncertain for ${weak.map((m) => runTitle(m.run)).join(', ')} — check those marks.`, { type: 'warn', ms: 7000 });
      } catch (e) { toast(e.message, { type: 'error', ms: 5000 }); return false; }
    } }],
  });
}

/** Enter in a time field moves to the next run's time (fast results entry at the track). */
function nextTimeOnEnter(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const all = [...document.querySelectorAll('.entry-table .time-input')];
  const next = all[all.indexOf(e.target) + 1];
  e.target.blur();
  if (next) { next.focus(); next.select(); }
}
