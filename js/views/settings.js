// Settings dialog: timing rules, drivers & cars, storage, backup/restore.

import * as store from '../store.js';
import { h, clear, modal, toast, confirmDialog, promptDialog, download, pickFiles, fill } from '../ui.js';
import { fmtBytes, fmtTime, adjustedTime, STATUSES } from '../model.js';
import { driverName, carName } from '../common.js';

export function openSettings() {
  const body = h('div', { class: 'settings' });
  const render = async () => {
    const s = store.settings;
    const num = (key, label, attrs, hint) => h('label', { class: 'field' }, h('span', null, label),
      h('input', { class: 'input num', type: 'number', value: s[key], ...attrs, onchange: (e) => store.saveSetting(key, parseFloat(e.target.value) || 0) }),
      hint ? h('small', { class: 'hint' }, hint) : null);
    const chk = (key, label, hint, onChange) => h('label', { class: 'field check' },
      h('input', { type: 'checkbox', checked: !!s[key], onchange: async (e) => { await store.saveSetting(key, e.target.checked); onChange?.(e.target.checked); } }),
      h('span', null, label), hint ? h('small', { class: 'hint' }, hint) : null);
    const est = await store.storageEstimate();

    fill(body, 
      h('h3', null, 'Timing'),
      h('div', { class: 'grid3' },
        num('conePenalty', 'Seconds per cone', { step: 0.5, min: 0 }, 'Most clubs use 2 s — check your rulebook.'),
        num('leadIn', 'Lead-in before start (s)', { step: 0.5, min: 0 }),
        num('leadOut', 'Lead-out after finish (s)', { step: 0.5, min: 0 }),
      ),
      num('defaultFps', 'Default frame rate (if not detected)', { step: 1, min: 1 }),
      h('h3', null, 'Drivers & cars'),
      entityList('drivers', true),
      entityList('cars', false),
      h('h3', null, 'Storage'),
      chk('keepVideoCopies', 'Keep copies of local videos in this browser', 'On: videos are available next visit without re-picking files. Off: only metadata is stored; you re-link files each session.', async (on) => {
        if (!on && await confirmDialog('Remove stored video copies now to free space? Runs keep all marks and data; you will re-link files when needed.', { okLabel: 'Remove copies' })) {
          await store.dropStoredCopies(); toast('Stored video copies removed.'); render();
        }
      }),
      chk('autoAnalyze', 'Analyze videos automatically after import', 'Finds the launch and builds motion/audio graphs. Runs in your browser; takes a few seconds per video.'),
      h('p', { class: 'sub' }, est ? `Browser storage used: ${fmtBytes(est.usage)} of ~${fmtBytes(est.quota)} available.` : 'Storage estimate unavailable.'),
      h('h3', null, 'Backup'),
      h('p', { class: 'sub' }, 'Exports include events, runs, times, marks and notes — not the video files themselves.'),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', onclick: () => download(`autocross-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportJSON(), null, 1)) }, 'Export backup (JSON)'),
        h('button', { class: 'btn', onclick: importBackup }, 'Import backup…'),
        h('button', { class: 'btn', onclick: exportCSV }, 'Export runs (CSV)'),
      ),
      h('h3', null, 'Danger zone'),
      h('button', { class: 'btn btn-danger', onclick: async () => {
        if (!(await confirmDialog('Delete ALL events, runs, drivers, cars and stored videos from this browser? Export a backup first if unsure.', { danger: true, okLabel: 'Delete everything' }))) return;
        store.closeDB();
        await new Promise((res) => { const r = indexedDB.deleteDatabase('autox-compare'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
        localStorage.clear(); sessionStorage.clear();
        location.hash = '#/'; location.reload();
      } }, 'Delete all data'),
    );
  };
  render();
  modal({ title: 'Settings', wide: true, body, actions: [{ label: 'Done', primary: true }] });

  function entityList(kind, isDriver) {
    const items = store.all(kind).sort((a, b) => a.name.localeCompare(b.name));
    const used = (id) => store.all('runs').filter((r) => (isDriver ? r.driverId : r.carId) === id).length;
    return h('div', { class: 'entity-list' },
      h('div', { class: 'entity-head' }, h('strong', null, isDriver ? 'Drivers' : 'Cars'),
        h('button', { class: 'btn btn-small', onclick: async () => { const n = await promptDialog(isDriver ? 'Driver name' : 'Car (e.g. 2019 Miata ST)'); if (n?.trim()) { await store.put(kind, { id: store.uid(), name: n.trim() }); render(); } } }, '+ Add')),
      items.length ? h('ul', null, items.map((d) => h('li', null,
        h('span', null, d.name, d.isMe ? h('span', { class: 'badge' }, 'me') : null, h('span', { class: 'sub' }, ` · ${used(d.id)} runs`)),
        isDriver ? h('button', { class: 'btn btn-small btn-ghost', title: 'Mark as you (default driver, shown first on Progress)', onclick: async () => {
          for (const x of store.all('drivers')) if (x.isMe && x.id !== d.id) { x.isMe = false; await store.put('drivers', x); }
          d.isMe = !d.isMe; await store.put('drivers', d); render();
        } }, d.isMe ? 'Unset me' : 'This is me') : null,
        h('button', { class: 'icon-btn', title: 'Rename', onclick: async () => { const n = await promptDialog('Name', d.name); if (n?.trim()) { d.name = n.trim(); await store.put(kind, d); render(); } } }, '✎'),
        h('button', { class: 'icon-btn danger', title: 'Delete', onclick: async () => {
          const n = used(d.id);
          if (!(await confirmDialog(n ? `${d.name} is used by ${n} run(s). Delete anyway? Those runs will show no ${isDriver ? 'driver' : 'car'}.` : `Delete ${d.name}?`, { danger: true, okLabel: 'Delete' }))) return;
          await store.del(kind, d.id); render();
        } }, '✕'),
      ))) : h('p', { class: 'sub' }, 'None yet.'),
    );
  }
}

async function importBackup() {
  const [file] = await pickFiles({ accept: 'application/json,.json', multiple: false });
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const replace = await confirmDialog('Replace your current library with this backup? Choose Cancel to merge it in instead (same items are overwritten).', { okLabel: 'Replace', title: 'Import backup' });
    const n = await store.importJSON(data, { replace });
    toast(`Imported ${n} records. Re-link video files from each run when needed.`, { type: 'ok', ms: 5000 });
    location.hash = '#/';
  } catch (e) { toast(e.message, { type: 'error' }); }
}

function exportCSV() {
  const pen = store.settings.conePenalty;
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['event', 'date', 'location', 'course', 'driver', 'car', 'run', 'raw', 'cones', 'status', 'adjusted', 'start_mark', 'finish_mark', 'tags', 'setup', 'notes', 'video'];
  const lines = [head.join(',')];
  const runs = store.all('runs').sort((a, b) => (store.get('events', a.eventId)?.date || '').localeCompare(store.get('events', b.eventId)?.date || '') || (a.runNumber ?? 0) - (b.runNumber ?? 0));
  for (const r of runs) {
    const ev = store.get('events', r.eventId);
    lines.push([ev?.name, ev?.date, ev?.location, ev?.courseName, driverName(r.driverId), carName(r.carId), r.runNumber, r.rawTime, r.cones, STATUSES[r.status || 'ok'], adjustedTime(r, pen),
      r.markers?.start, r.markers?.finish, (r.tags || []).join('; '), r.setup, r.notes, r.source?.type === 'youtube' ? `https://youtu.be/${r.source.ytId}` : r.source?.fileName].map(q).join(','));
  }
  download(`autocross-runs-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
}
