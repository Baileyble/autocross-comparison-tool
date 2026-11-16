// Import dialog: add local video files and/or YouTube links as runs of an event.

import * as store from '../store.js';
import { h, modal, toast, pickFiles, clear } from '../ui.js';
import { entitySelect, eventOptions, eventLabel, nextRunNumber, today } from '../common.js';
import { fmtBytes, parseYouTubeId, parseYouTubeStart } from '../model.js';
import { queueAnalysis } from '../analyze.js';

export function openImport({ files = [], eventId = null, driverId = null, carId = null } = {}) {
  const state = {
    eventId: eventId || eventOptions()[0]?.id || '__new',
    newEvent: { name: '', date: today(), location: '' },
    driverId: driverId || store.all('drivers').find((d) => d.isMe)?.id || store.all('drivers')[0]?.id || null,
    carId: carId || store.all('cars')[0]?.id || null,
    items: [],
    links: '',
  };
  const addFiles = (fs) => {
    const vids = fs.filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi|mts|lrv)$/i.test(f.name));
    if (vids.length < fs.length) toast(`Skipped ${fs.length - vids.length} non-video file(s).`, { type: 'warn' });
    for (const f of vids) state.items.push({ file: f, include: true, driverId: null, runNumber: null });
    // Camera files are chronological: order by modified time, then name.
    state.items.sort((a, b) => a.file.lastModified - b.file.lastModified || a.file.name.localeCompare(b.file.name, undefined, { numeric: true }));
    renumber();
    renderFiles();
  };
  const renumber = () => {
    const evId = state.eventId === '__new' ? null : state.eventId;
    const counters = new Map();
    for (const it of state.items) {
      if (!it.include) continue;
      const d = it.driverId || state.driverId || '';
      if (!counters.has(d)) counters.set(d, evId ? nextRunNumber(evId, d || null) : 1);
      if (!it.manualNumber) it.runNumber = counters.get(d);
      counters.set(d, Math.max(counters.get(d), it.runNumber) + 1);
    }
  };

  const filesBox = h('div', { class: 'import-files' });
  const renderFiles = () => {
    clear(filesBox);
    if (!state.items.length) {
      filesBox.appendChild(h('div', { class: 'dropzone small', onclick: async () => addFiles(await pickFiles()) },
        h('strong', null, 'Choose video files'), h('span', null, ' or drop them here. One file per run works best; a file containing several runs can be split later.')));
      return;
    }
    filesBox.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'File'), h('th', null, 'Size'), h('th', null, 'Driver'), h('th', null, 'Run #'))),
      h('tbody', null, state.items.map((it) => h('tr', { class: it.include ? '' : 'muted' },
        h('td', null, h('input', { type: 'checkbox', checked: it.include, onchange: (e) => { it.include = e.target.checked; renumber(); renderFiles(); } })),
        h('td', { class: 'ellipsis', title: it.file.name }, it.file.name, h('div', { class: 'sub' }, new Date(it.file.lastModified).toLocaleString())),
        h('td', null, fmtBytes(it.file.size)),
        h('td', null, entitySelect('drivers', it.driverId || state.driverId, (v) => { it.driverId = v; renumber(); renderFiles(); }, { placeholder: '(default)' })),
        h('td', null, h('input', { class: 'input num', type: 'number', min: 1, value: it.runNumber ?? '', style: { width: '5em' }, onchange: (e) => { it.runNumber = parseInt(e.target.value) || null; it.manualNumber = true; } })),
      ))),
    )));
    filesBox.appendChild(h('button', { class: 'btn btn-ghost', onclick: async () => addFiles(await pickFiles()) }, '+ Add more files'));
  };

  const newEventBox = h('div', { class: 'grid3' },
    h('label', { class: 'field' }, h('span', null, 'Event name'), h('input', { class: 'input', placeholder: 'e.g. Points Event #4', oninput: (e) => { state.newEvent.name = e.target.value; } })),
    h('label', { class: 'field' }, h('span', null, 'Date'), h('input', { class: 'input', type: 'date', value: state.newEvent.date, oninput: (e) => { state.newEvent.date = e.target.value; } })),
    h('label', { class: 'field' }, h('span', null, 'Location / site'), h('input', { class: 'input', oninput: (e) => { state.newEvent.location = e.target.value; } })),
  );
  const evSel = h('select', { class: 'input', onchange: (e) => { state.eventId = e.target.value; newEventBox.hidden = state.eventId !== '__new'; renumber(); renderFiles(); } },
    h('option', { value: '__new' }, '+ New event…'),
    eventOptions().map((ev) => h('option', { value: ev.id, selected: ev.id === state.eventId }, eventLabel(ev))),
  );
  newEventBox.hidden = state.eventId !== '__new';

  const body = h('div', { class: 'import' },
    h('div', { class: 'grid3' },
      h('label', { class: 'field' }, h('span', null, 'Event'), evSel),
      h('label', { class: 'field' }, h('span', null, 'Driver (default)'), entitySelect('drivers', state.driverId, (v) => { state.driverId = v; renumber(); renderFiles(); })),
      h('label', { class: 'field' }, h('span', null, 'Car'), entitySelect('cars', state.carId, (v) => { state.carId = v; })),
    ),
    newEventBox,
    h('h3', null, 'Video files'),
    filesBox,
    h('h3', null, 'YouTube links ', h('span', { class: 'sub' }, '(one per line — a ?t= timestamp is used as the start mark)')),
    h('textarea', { class: 'input', rows: 3, placeholder: 'https://youtu.be/…', oninput: (e) => { state.links = e.target.value; } }),
    h('p', { class: 'hint' }, store.settings.keepVideoCopies
      ? 'Local videos are copied into this browser\'s storage so they are available next time (change in Settings). Nothing is uploaded anywhere.'
      : 'Videos are not copied into browser storage (see Settings); you will need to re-link the files in later sessions. Nothing is uploaded anywhere.'),
  );

  const m = modal({
    title: 'Import runs',
    wide: true,
    body,
    actions: [
      { label: 'Cancel' },
      { label: 'Import', primary: true, onClick: async () => doImport(state) },
    ],
  });
  // Drag & drop onto the dialog
  m.box.addEventListener('dragover', (e) => { e.preventDefault(); m.box.classList.add('drag'); });
  m.box.addEventListener('dragleave', () => m.box.classList.remove('drag'));
  m.box.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); m.box.classList.remove('drag'); addFiles([...e.dataTransfer.files]); });
  addFiles(files);
}

async function doImport(state) {
  const items = state.items.filter((i) => i.include);
  const links = state.links.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  const yt = links.map((l) => ({ url: l, id: parseYouTubeId(l), start: parseYouTubeStart(l) }));
  const bad = yt.filter((y) => !y.id);
  if (bad.length) { toast(`Not a YouTube link: ${bad[0].url}`, { type: 'error' }); return false; }
  if (!items.length && !yt.length) { toast('Add at least one video file or YouTube link.', { type: 'warn' }); return false; }

  let eventId = state.eventId;
  if (eventId === '__new') {
    const ev = await store.put('events', {
      id: store.uid(),
      name: state.newEvent.name.trim() || 'Autocross',
      date: state.newEvent.date || today(),
      location: state.newEvent.location.trim(),
      splits: [],
      notes: '',
    });
    eventId = ev.id;
  }
  const created = [];
  for (const it of items) {
    let videoId;
    try { videoId = await store.addVideo(it.file); } catch (e) { toast(`Could not add ${it.file.name}: ${e.message}`, { type: 'error' }); continue; }
    const run = store.newRun({
      eventId,
      driverId: it.driverId || state.driverId,
      carId: state.carId,
      runNumber: it.runNumber,
      source: { type: 'local', videoId, fileName: it.file.name, fileSize: it.file.size },
    });
    await store.put('runs', run);
    created.push(run);
    if (store.settings.autoAnalyze) queueAnalysis(videoId);
  }
  let n = nextRunNumber(eventId, state.driverId);
  for (const y of yt) {
    const run = store.newRun({
      eventId,
      driverId: state.driverId,
      carId: state.carId,
      runNumber: n++,
      source: { type: 'youtube', ytId: y.id, url: y.url },
      markers: { start: y.start, finish: null, splits: {} },
    });
    await store.put('runs', run);
    created.push(run);
  }
  toast(`Imported ${created.length} run${created.length === 1 ? '' : 's'}.`, { type: 'ok' });
  location.hash = `#/event/${eventId}`;
}
