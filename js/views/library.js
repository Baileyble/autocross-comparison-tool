// Home: events overview + searchable run table with compare selection.

import * as store from '../store.js';
import { h, clear, isSelected, toggleSelected, onSelection, select, fill } from '../ui.js';
import { runTitle, timeSummary, thumbEl, driverName, carName, statusBadge, markerBadges, tagChips, allTags, eventLabel } from '../common.js';
import { adjustedTime, bestRun, fmtTime, fmtDate } from '../model.js';
import { openImport } from './import.js';
import { openEventEditor } from './event.js';

const filters = { q: '', driver: '', car: '', event: '', tag: '', sort: 'date' };

export function renderLibrary(root) {
  const events = store.all('events').sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
  const runs = store.all('runs');

  if (!events.length && !runs.length) return renderWelcome(root);
  // Drop filters that point at things that no longer exist (deleted event/driver/car/tag).
  if (filters.event && !store.get('events', filters.event)) filters.event = '';
  if (filters.driver && !store.get('drivers', filters.driver)) filters.driver = '';
  if (filters.car && !store.get('cars', filters.car)) filters.car = '';
  if (filters.tag && !allTags().includes(filters.tag)) filters.tag = '';

  const pen = store.settings.conePenalty;
  const evGrid = h('div', { class: 'event-grid' },
    events.map((ev) => {
      const evRuns = store.runsOfEvent(ev.id);
      const byDriver = new Map();
      for (const r of evRuns) { const k = r.driverId || ''; if (!byDriver.has(k)) byDriver.set(k, []); byDriver.get(k).push(r); }
      const bests = [...byDriver.entries()].map(([d, rs]) => ({ d, run: bestRun(rs, pen) })).filter((x) => x.run)
        .sort((a, b) => adjustedTime(a.run, pen) - adjustedTime(b.run, pen));
      const thumbs = evRuns.filter((r) => r.thumb || r.source?.type === 'youtube').slice(0, 4);
      return h('a', { class: 'event-card', href: `#/event/${ev.id}` },
        h('div', { class: 'event-thumbs' }, thumbs.length ? thumbs.map((r) => thumbEl(r, 'mini-thumb')) : h('div', { class: 'thumb-empty' }, '🏁')),
        h('div', { class: 'event-card-body' },
          h('div', { class: 'event-date' }, ev.date ? fmtDate(ev.date) : ''),
          h('h3', null, ev.name || 'Untitled event'),
          h('div', { class: 'sub' }, [ev.location, ev.courseName].filter(Boolean).join(' · ') || ' '),
          h('div', { class: 'event-stats' }, `${evRuns.length} run${evRuns.length === 1 ? '' : 's'}`),
          bests.length ? h('ul', { class: 'event-bests' }, bests.slice(0, 3).map((b) => h('li', null,
            h('span', null, driverName(b.d) || 'Unknown driver'), h('span', { class: 'mono' }, fmtTime(adjustedTime(b.run, pen))),
          ))) : null,
        ),
      );
    }),
    h('button', { class: 'event-card add-card', onclick: () => openEventEditor() }, h('span', { class: 'plus' }, '+'), 'New event'),
  );

  const tableHost = h('div');
  const renderTable = () => {
    clear(tableHost);
    let list = runs.slice();
    const q = filters.q.toLowerCase();
    if (q) list = list.filter((r) => [runTitle(r), store.get('events', r.eventId)?.name, carName(r.carId), r.notes, r.setup, (r.tags || []).join(' ')].join(' ').toLowerCase().includes(q));
    if (filters.driver) list = list.filter((r) => r.driverId === filters.driver);
    if (filters.car) list = list.filter((r) => r.carId === filters.car);
    if (filters.event) list = list.filter((r) => r.eventId === filters.event);
    if (filters.tag) list = list.filter((r) => (r.tags || []).includes(filters.tag));
    const evDate = (r) => store.get('events', r.eventId)?.date || '';
    const sorters = {
      date: (a, b) => evDate(b).localeCompare(evDate(a)) || (a.runNumber ?? 0) - (b.runNumber ?? 0),
      time: (a, b) => (adjustedTime(a, pen) ?? Infinity) - (adjustedTime(b, pen) ?? Infinity),
      added: (a, b) => b.createdAt - a.createdAt,
    };
    list.sort(sorters[filters.sort] || sorters.date);
    tableHost.appendChild(runTable(list, { showEvent: true }));
  };

  const filterBar = h('div', { class: 'filter-bar' },
    h('input', { class: 'input search', type: 'search', placeholder: 'Search runs, notes, tags…', value: filters.q, oninput: (e) => { filters.q = e.target.value; renderTable(); } }),
    select([['', 'All drivers'], ...store.all('drivers').map((d) => [d.id, d.name])], filters.driver, (v) => { filters.driver = v; renderTable(); }),
    select([['', 'All cars'], ...store.all('cars').map((d) => [d.id, d.name])], filters.car, (v) => { filters.car = v; renderTable(); }),
    select([['', 'All events'], ...events.map((e) => [e.id, eventLabel(e)])], filters.event, (v) => { filters.event = v; renderTable(); }),
    select([['', 'All tags'], ...allTags().map((t) => [t, t])], filters.tag, (v) => { filters.tag = v; renderTable(); }),
    select([['date', 'Sort: event date'], ['time', 'Sort: fastest'], ['added', 'Sort: recently added']], filters.sort, (v) => { filters.sort = v; renderTable(); }),
  );

  fill(root, 
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Run library'), h('p', { class: 'sub' }, `${events.length} event${events.length === 1 ? '' : 's'} · ${runs.length} run${runs.length === 1 ? '' : 's'}`)),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => openEventEditor() }, '+ New event'),
        h('button', { class: 'btn btn-primary', onclick: () => openImport() }, '⬆ Import runs'),
      ),
    ),
    h('section', null, h('h2', { class: 'section-title' }, 'Events'), evGrid),
    h('section', null, h('h2', { class: 'section-title' }, 'All runs'), filterBar, tableHost),
  );
  renderTable();
  const off = onSelection(() => syncChecks(root));
  return () => off();
}

function syncChecks(root) {
  for (const cb of root.querySelectorAll('input[data-run]')) cb.checked = isSelected(cb.dataset.run);
}

/** Reusable run table. */
export function runTable(list, { showEvent = false, event = null, highlightBest = true } = {}) {
  const pen = store.settings.conePenalty;
  if (!list.length) return h('div', { class: 'empty' }, 'No runs match.');
  const bestByDriver = new Map();
  if (highlightBest) {
    const groups = new Map();
    for (const r of list) { const k = `${r.eventId}|${r.driverId}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    for (const rs of groups.values()) { const b = bestRun(rs, pen); if (b) bestByDriver.set(b.id, true); }
  }
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table runs-table' },
    h('thead', null, h('tr', null,
      h('th', { title: 'Select to compare' }, '⇄'), h('th', null, ''), h('th', null, 'Run'),
      showEvent ? h('th', null, 'Event') : null,
      h('th', null, 'Car'), h('th', { class: 'r' }, 'Time'), h('th', null, 'Marks'), h('th', null, 'Notes'),
    )),
    h('tbody', null, list.map((r) => {
      const ev = store.get('events', r.eventId);
      return h('tr', { class: bestByDriver.has(r.id) ? 'best-row' : '' },
        h('td', null, h('input', { type: 'checkbox', 'data-run': r.id, checked: isSelected(r.id), onchange: (e) => { if (!toggleSelected(r.id, e.target.checked)) e.target.checked = false; } })),
        h('td', null, h('a', { href: `#/run/${r.id}` }, thumbEl(r, 'row-thumb'))),
        h('td', null, h('a', { href: `#/run/${r.id}`, class: 'strong' }, runTitle(r)), bestByDriver.has(r.id) ? h('span', { class: 'badge badge-best', title: 'Best run for this driver at this event' }, 'BEST') : null, statusBadge(r)),
        showEvent ? h('td', null, ev ? h('a', { href: `#/event/${ev.id}` }, ev.name || 'Event') : '—', h('div', { class: 'sub' }, ev?.date ? fmtDate(ev.date) : '')) : null,
        h('td', null, carName(r.carId) || h('span', { class: 'sub' }, '—')),
        h('td', { class: 'r mono' }, timeSummary(r)),
        h('td', null, markerBadges(r, event || ev)),
        h('td', { class: 'notes-cell' }, tagChips(r.tags), r.notes ? h('span', { class: 'sub ellipsis' }, r.notes) : null),
      );
    })),
  ));
}

function renderWelcome(root) {
  fill(root, h('div', { class: 'welcome' },
    h('h1', null, 'Compare your autocross runs, frame by frame.'),
    h('p', { class: 'lead' }, 'Import in-car videos, mark the launch (auto-detected for local files), and play runs side by side in lock-step — with live time deltas, split times and notes so you can see exactly where time is gained or lost.'),
    h('div', { class: 'welcome-actions' },
      h('button', { class: 'btn btn-primary btn-lg', onclick: () => openImport() }, '⬆ Import run videos'),
      h('button', { class: 'btn btn-lg', onclick: () => openEventEditor() }, '+ Create an event'),
    ),
    h('ol', { class: 'steps' },
      h('li', null, h('strong', null, 'Import'), ' — drop video files (or paste YouTube links). Files stay on your device; nothing is uploaded.'),
      h('li', null, h('strong', null, 'Mark'), ' — the start is auto-detected from camera motion; confirm it frame-by-frame. Enter the official time and the finish is placed for you. Optionally mark course splits.'),
      h('li', null, h('strong', null, 'Compare'), ' — tick 2–4 runs and hit Compare. Play in real time to see who pulls ahead, or position-locked to see lines at the same spot on course.'),
      h('li', null, h('strong', null, 'Track'), ' — keep times, cones, setup and notes per run; see best segments, theoretical best and progress over events.'),
    ),
    h('p', { class: 'hint' }, 'Tip: drop video files anywhere on this page to start an import.'),
  ));
}
