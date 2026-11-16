// Progress across events for a driver: best times, % of a reference, consistency, cones, theoretical best.

import * as store from '../store.js';
import { h, clear, select, fill } from '../ui.js';
import { adjustedTime, bestRun, fmtTime, fmtDelta, fmtDate, splitTable } from '../model.js';
import { lineChart } from '../charts.js';
import { driverName, carName } from '../common.js';

let chosen = null;

export function renderProgress(root) {
  const drivers = store.all('drivers').sort((a, b) => (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0) || a.name.localeCompare(b.name));
  if (!drivers.length) {
    fill(root, h('div', { class: 'empty' }, h('h2', null, 'No drivers yet'), h('p', null, 'Assign drivers to runs to track progress across events.')));
    return;
  }
  if (!chosen || !store.get('drivers', chosen)) chosen = drivers[0].id;
  const pen = store.settings.conePenalty;
  const events = store.all('events').sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const rows = [];
  for (const ev of events) {
    const all = store.runsOfEvent(ev.id);
    const mine = all.filter((r) => r.driverId === chosen);
    if (!mine.length) continue;
    const counted = mine.filter((r) => r.status !== 'rerun'); // a rerun is a voided attempt
    const best = bestRun(mine, pen);
    const bestT = best ? adjustedTime(best, pen) : null;
    const overall = bestRun(all, pen);
    const fieldBest = overall ? adjustedTime(overall, pen) : null;
    const clean = mine.filter((r) => adjustedTime(r, pen) != null && !r.cones).map((r) => r.rawTime);
    const mean = clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
    const sd = clean.length > 1 ? Math.sqrt(clean.reduce((a, b) => a + (b - mean) ** 2, 0) / (clean.length - 1)) : null;
    const timed = mine.filter((r) => adjustedTime(r, pen) != null).sort((a, b) => (a.runNumber ?? 0) - (b.runNumber ?? 0));
    const first = timed[0] ? adjustedTime(timed[0], pen) : null;
    const tb = ev.splits?.length ? splitTable(mine.filter((r) => r.markers?.start != null), ev).theoretical : null;
    rows.push({
      ev, runs: counted.length, best, bestT,
      cones: counted.reduce((s, r) => s + (r.cones || 0), 0),
      dnfs: counted.filter((r) => r.status && r.status !== 'ok').length,
      pctRef: bestT != null && ev.refTime ? (bestT / ev.refTime) * 100 : null,
      gapField: bestT != null && fieldBest != null && overall.driverId !== chosen ? bestT - fieldBest : null,
      sd, improve: first != null && bestT != null ? bestT - first : null, tb,
      car: best ? carName(best.carId) : carName(mine[0].carId),
    });
  }

  const pctSeries = [{ name: '% of reference', color: '#ff7a1a', points: rows.filter((r) => r.pctRef != null).map((r, i) => ({ x: i + 1, y: r.pctRef, label: `${r.ev.name}: ${r.pctRef.toFixed(2)}%` })) }];
  const pctChart = pctSeries[0].points.length > 1 ? lineChart(pctSeries, { yFmt: (v, d = 1) => `${v.toFixed(d)}%`, xFmt: (v) => rows.filter((r) => r.pctRef != null)[v - 1]?.ev.date?.slice(5) || '', integerX: true, title: '% of reference time by event' }) : null;

  const totalRuns = rows.reduce((s, r) => s + r.runs, 0);
  const totalCones = rows.reduce((s, r) => s + r.cones, 0);

  fill(root, 
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Progress'), h('p', { class: 'sub' }, 'How you\'re trending across events. Raw times only compare within a course — use a reference time per event (FTD / class winner) for a fair trend.')),
      h('div', { class: 'actions' }, select(drivers.map((d) => [d.id, d.name + (d.isMe ? ' (me)' : '')]), chosen, (v) => { chosen = v; renderProgress(root); })),
    ),
    h('div', { class: 'tiles' },
      tile('Events', String(rows.length)),
      tile('Runs', String(totalRuns)),
      tile('Cones / run', totalRuns ? (totalCones / totalRuns).toFixed(2) : '—'),
      tile('Latest % of ref', rows.filter((r) => r.pctRef != null).at(-1)?.pctRef?.toFixed(2).concat('%') || '—'),
    ),
    pctChart ? h('section', null, h('h2', { class: 'section-title' }, '% of reference time'), h('div', { class: 'card' }, pctChart), h('p', { class: 'hint' }, 'Lower is better. 100% = matched the reference.')) : null,
    h('section', null,
      h('h2', { class: 'section-title' }, `Events — ${driverName(chosen)}`),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null,
          ['Date', 'Event', 'Car', 'Runs', 'Best', '% of ref', 'Gap to fastest', 'First → best', 'Theoretical', 'Consistency', 'Cones / DNF'].map((t, i) => h('th', { class: i > 2 ? 'r' : '', title: t === 'Cones / DNF' ? 'DNF column counts DNF, off-course and DSQ runs; reruns are not counted' : '' }, t)))),
        h('tbody', null, rows.slice().reverse().map((r) => h('tr', null,
          h('td', null, r.ev.date ? fmtDate(r.ev.date) : '—'),
          h('td', null, h('a', { href: `#/event/${r.ev.id}` }, r.ev.name || 'Event'), r.ev.courseName ? h('div', { class: 'sub' }, r.ev.courseName) : null),
          h('td', null, r.car || '—'),
          h('td', { class: 'r' }, String(r.runs)),
          h('td', { class: 'r mono strong' }, r.best ? h('a', { href: `#/run/${r.best.id}` }, fmtTime(r.bestT)) : '—'),
          h('td', { class: 'r mono' }, r.pctRef != null ? `${r.pctRef.toFixed(2)}%` : '—'),
          h('td', { class: 'r mono' }, r.gapField != null ? fmtDelta(r.gapField) : r.best ? 'fastest' : '—'),
          h('td', { class: 'r mono' }, r.improve != null ? fmtDelta(r.improve) : '—'),
          h('td', { class: 'r mono', title: 'Sum of your best segments' }, r.tb != null ? `${fmtTime(r.tb)}${r.bestT != null ? '' : ''}` : '—'),
          h('td', { class: 'r mono', title: 'Std. deviation of clean (no-cone) raw times' }, r.sd != null ? `±${r.sd.toFixed(2)}` : '—'),
          h('td', { class: 'r' }, `${r.cones} / ${r.dnfs}`),
        ))),
      )) : h('div', { class: 'empty' }, 'No runs for this driver yet.'),
    ),
    sameCourse(rows),
  );
}

function sameCourse(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = (r.ev.courseName || '').trim().toLowerCase();
    if (!k) continue;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const groups = [...by.values()].filter((g) => g.length > 1);
  if (!groups.length) return null;
  return h('section', null,
    h('h2', { class: 'section-title' }, 'Same course, different days'),
    groups.map((g) => h('div', { class: 'card' },
      h('h3', null, g[0].ev.courseName),
      h('ul', { class: 'plain' }, g.map((r, i) => h('li', null,
        h('span', { class: 'mono' }, r.ev.date || ''), ' — ', h('a', { href: `#/event/${r.ev.id}` }, r.ev.name), ': ',
        h('span', { class: 'mono strong' }, fmtTime(r.bestT)),
        i > 0 && r.bestT != null && g[i - 1].bestT != null ? h('span', { class: `delta ${r.bestT < g[i - 1].bestT ? 'faster' : 'slower'}` }, ` (${fmtDelta(r.bestT - g[i - 1].bestT)})`) : null,
      ))),
    )),
  );
}

function tile(label, value) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, label), h('div', { class: 'tile-value mono' }, value));
}
