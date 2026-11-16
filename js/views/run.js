// Run editor: mark start / splits / finish frame-accurately, add timed notes, edit run details.

import * as store from '../store.js';
import { h, clear, toast, modal, confirmDialog, debounce, isTyping, toggleSelected, isSelected, setSelection, add, fill } from '../ui.js';
import { entitySelect, resolveSource, relinkFlow, runTitle, eventOptions, eventLabel, driverName, nextRunNumber } from '../common.js';
import { adjustedTime, bestRun, effectiveFinish, fmtTime, fmtDelta, parseTime, STATUSES, videoTime } from '../model.js';
import { LocalPlayer, YouTubePlayer } from '../players.js';
import { Timeline } from '../timeline.js';
import { getAnalysis, queueAnalysis, onAnalysis, analysisStatus, refineLaunch, captureThumb } from '../analyze.js';
import { detectLaunch, motionSegments } from '../signal.js';

const SPEEDS = [0.1, 0.25, 0.5, 1, 2];

export function renderRun(root, id) {
  const run = store.get('runs', id);
  if (!run) { fill(root, h('div', { class: 'empty' }, 'Run not found. ', h('a', { href: '#/' }, 'Back to library'))); return; }
  run.markers ||= { start: null, finish: null, splits: {} };
  run.markers.splits ||= {};
  run.annotations ||= [];
  let ev = store.get('events', run.eventId);
  const cleanups = [];
  let player = null, timeline = null, analysis = null, raf = 0, speedIdx = 3, hudKey = '';
  const save = debounce(() => store.put('runs', run), 300);
  const saveNow = () => save.flush();

  const fps = () => run.fps || store.settings.defaultFps || 30;
  const now = () => player?.time ?? 0;

  // ---------- layout ----------
  const stage = h('div', { class: 'stage' });
  const hud = h('div', { class: 'stage-hud' });
  const stageWrap = h('div', { class: 'stage-wrap' }, stage, hud);
  const canvas = h('canvas', { class: 'timeline' });
  const markBar = h('div', { class: 'mark-bar' });
  const markList = h('div', { class: 'mark-list' });
  const side = h('aside', { class: 'run-side' });
  const playBtn = h('button', { class: 'btn btn-icon', title: 'Play/pause (Space)', onclick: () => togglePlay() }, '▶');
  const speedBtn = h('button', { class: 'btn btn-small', title: 'Playback speed ([ / ])', onclick: () => setSpeed((speedIdx + 1) % SPEEDS.length) }, '1×');
  const statusLine = h('div', { class: 'analysis-line' });

  const transport = h('div', { class: 'transport' },
    h('button', { class: 'btn btn-small', title: 'Jump to start mark (Home)', onclick: () => run.markers.start != null && seek(run.markers.start) }, '⇤ Start'),
    h('button', { class: 'btn btn-small', title: 'Back 1 s (Shift+←)', onclick: () => seek(now() - 1) }, '−1s'),
    h('button', { class: 'btn btn-small', title: 'Back 1 frame (←)', onclick: () => stepFrames(-1) }, '−1f'),
    playBtn,
    h('button', { class: 'btn btn-small', title: 'Forward 1 frame (→)', onclick: () => stepFrames(1) }, '+1f'),
    h('button', { class: 'btn btn-small', title: 'Forward 1 s (Shift+→)', onclick: () => seek(now() + 1) }, '+1s'),
    speedBtn,
    h('span', { class: 'spacer' }),
    h('label', { class: 'fps-pick', title: 'Frame rate used for frame stepping' }, 'fps ',
      h('select', { class: 'input input-small', onchange: (e) => { run.fps = parseFloat(e.target.value); saveNow(); } },
        [24, 25, 29.97, 30, 50, 59.94, 60, 100, 119.88, 120, 240].map((f) => h('option', { value: f, selected: Math.abs(fps() - f) < 0.01 }, String(f))))),
    h('button', { class: 'btn btn-small', title: 'Zoom timeline to the run', onclick: () => zoomRun() }, 'Zoom to run'),
    h('button', { class: 'btn btn-small', title: 'Show whole video', onclick: () => timeline?.fit() }, 'Fit'),
  );

  const prevNext = navLinks(run);
  fill(root, 
    h('div', { class: 'page-head compact' },
      h('div', null,
        h('div', { class: 'crumbs' }, h('a', { href: '#/' }, 'Library'), ' / ', ev ? h('a', { href: `#/event/${ev.id}` }, ev.name || 'Event') : 'No event', ' / ', runTitle(run)),
        h('h1', null, runTitle(run)),
      ),
      h('div', { class: 'actions' }, prevNext,
        h('button', { class: 'btn', onclick: () => { toggleSelected(run.id, true); toast('Added to compare selection.'); } }, '+ Compare tray'),
        h('button', { class: 'btn btn-primary', onclick: () => compareWithBest(run) }, '⇄ Compare with best'),
      ),
    ),
    h('div', { class: 'run-layout' },
      h('div', { class: 'run-main' }, stageWrap, transport, markBar, canvas, statusLine, markList),
      side,
    ),
  );

  // ---------- player ----------
  (async () => {
    const src = await resolveSource(run);
    if (src.none) { add(stage, h('div', { class: 'stage-msg' }, h('p', null, 'This run has no video.'), h('button', { class: 'btn btn-primary', onclick: async () => { if (await relinkFlow(run)) location.reload(); } }, 'Attach a video file'))); return; }
    if (src.missing) {
      add(stage, h('div', { class: 'stage-msg' }, h('p', null, `Video file "${src.name || ''}" isn't available in this browser session.`),
        h('button', { class: 'btn btn-primary', onclick: async () => { if (await relinkFlow(run)) { location.reload(); } } }, 'Re-link file…')));
      return;
    }
    try {
      if (src.kind === 'youtube') player = new YouTubePlayer(stage, src.ytId, { muted: false, startAt: run.markers.start ?? 0 });
      else player = new LocalPlayer(stage, src.kind === 'local' ? URL.createObjectURL(src.file) : src.src, { muted: false });
      await player.ready;
    } catch (e) {
      add(stage, h('div', { class: 'stage-msg error' }, h('p', null, e.message), src.kind === 'local' ? h('p', { class: 'sub' }, 'Tip: H.264 MP4 plays everywhere. HEVC/H.265 files may need conversion depending on browser and OS.') : null));
      return;
    }
    if (src.kind === 'local' && player.el) {
      cleanups.push(() => URL.revokeObjectURL(player.el.src));
      player.el.addEventListener('play', () => { playBtn.textContent = '❚❚'; });
      player.el.addEventListener('pause', () => { playBtn.textContent = '▶'; });
      player.el.addEventListener('click', () => togglePlay());
    }
    let dur = player.duration;
    timeline = new Timeline(canvas, {
      duration: dur,
      getTime: now,
      onSeek: (t) => seek(t),
      getMarkers,
      onMarkerDrag: (m, t) => { setMarker(m.key, t, { quiet: true }); },
    });
    if (run.markers.start != null) seek(run.markers.start);
    if (src.kind === 'local') {
      analysis = await getAnalysis(src.videoId);
      if (analysis) timeline.setAnalysis(analysis);
      updateStatus();
      cleanups.push(onAnalysis(async () => {
        updateStatus();
        const st = analysisStatus(src.videoId);
        if (st?.state === 'done' && !analysis) {
          analysis = await getAnalysis(src.videoId);
          timeline.setAnalysis(analysis);
          setTimeout(() => { renderMarks(); renderSide(); if (run.markers.start != null && player.paused) seek(run.markers.start); }, 600);
        }
      }));
    }
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!dur && player.duration) { dur = player.duration; timeline.setDuration(dur); }
      timeline.draw();
      renderHud();
    };
    loop();
  })();

  function updateStatus() {
    clear(statusLine);
    const vid = run.source?.videoId;
    if (!vid) { add(statusLine, h('span', { class: 'sub' }, run.source?.type === 'youtube' ? 'YouTube video: auto-detection and motion graph need a local file.' : '')); return; }
    const st = analysisStatus(vid);
    if (st?.state === 'running' || st?.state === 'queued') add(statusLine, h('span', null, `Analyzing video… ${Math.round((st.progress || 0) * 100)}%`), h('progress', { max: 1, value: st.progress || 0 }));
    else if (st?.state === 'error') add(statusLine, h('span', { class: 'error' }, `Analysis failed: ${st.error}`), h('button', { class: 'btn btn-small', onclick: () => queueAnalysis(vid, { force: true }) }, 'Retry'));
    else if (analysis) add(statusLine, h('span', { class: 'legend' }, h('i', { class: 'lg-motion' }), 'camera motion', h('i', { class: 'lg-audio' }), 'audio'), h('span', { class: 'sub' }, ' · scroll to zoom, shift+scroll to pan, drag a flag to move a mark'));
    else add(statusLine, h('button', { class: 'btn btn-small', onclick: () => queueAnalysis(vid) }, 'Analyze video'), h('span', { class: 'sub' }, ' — finds the launch automatically and draws motion/audio graphs.'));
  }

  // ---------- controls ----------
  function seek(t) { if (!player) return; player.seek(Math.max(0, Math.min((player.duration || 1e9) - 0.001, t))); }
  function stepFrames(n) { if (!player) return; player.pause(); seek(now() + n / fps() + (n > 0 ? 0.0001 : -0.0001)); }
  function togglePlay() { if (!player) return; if (player.paused) player.play(); else player.pause(); if (player.kind === 'youtube') playBtn.textContent = player.paused ? '❚❚' : '▶'; }
  function setSpeed(i) { speedIdx = i; player?.setRate(SPEEDS[i]); speedBtn.textContent = `${SPEEDS[i]}×`; }
  function zoomRun() {
    const s = run.markers.start;
    if (s == null || !timeline) return timeline?.fit();
    const f = effectiveFinish(run) ?? s + 60;
    timeline.zoomTo(s - 3, f + 3);
  }

  function getMarkers() {
    const out = [];
    const m = run.markers;
    if (m.start != null) out.push({ key: 'start', t: m.start, label: m.startAuto ? 'START?' : 'START', color: '#a3e635', draggable: true });
    (ev?.splits || []).forEach((s, i) => { if (m.splits[s.id] != null) out.push({ key: s.id, t: m.splits[s.id], label: `${i + 1} ${s.name}`, color: '#facc15', draggable: true }); });
    const f = effectiveFinish(run);
    if (f != null) out.push({ key: 'finish', t: f, label: m.finish == null ? 'FINISH (time)' : 'FINISH', color: '#f43f5e', draggable: m.finish != null, dashed: m.finish == null });
    for (const a of run.annotations) out.push({ key: 'note:' + a.id, t: a.t, label: a.text, color: '#a78bfa', kind: 'note' });
    return out;
  }

  function setMarker(key, t, { quiet = false } = {}) {
    t = Math.round(t * 1000) / 1000;
    if (key === 'start') { run.markers.start = t; run.markers.startAuto = false; }
    else if (key === 'finish') run.markers.finish = t;
    else run.markers.splits[key] = t;
    save();
    renderMarks();
    if (!quiet) toast(`${key === 'start' ? 'Start' : key === 'finish' ? 'Finish' : ev.splits.find((s) => s.id === key)?.name} marked at ${fmtTime(t)}`, { ms: 1500 });
    if (key === 'start' && !run.thumb && run.source?.type === 'local') store.getVideoFile(run.source.videoId).then((f) => f && captureThumb(f, t + 3)).then((th) => { if (th) { run.thumb = th; save(); } });
  }
  function clearMarker(key) {
    if (key === 'start') { run.markers.start = null; run.markers.startAuto = false; }
    else if (key === 'finish') run.markers.finish = null;
    else delete run.markers.splits[key];
    save(); renderMarks();
  }

  async function addNote() {
    if (!player) return;
    const t = now();
    player.pause();
    const input = h('textarea', { class: 'input', rows: 3, placeholder: 'e.g. Braked too early for the offset; look further ahead' });
    modal({
      title: `Note at ${fmtTime(t, 2)}${run.markers.start != null ? ` (course ${fmtTime(t - run.markers.start, 2)})` : ''}`,
      body: input,
      actions: [{ label: 'Cancel' }, { label: 'Add note', primary: true, onClick: () => {
        if (!input.value.trim()) return;
        run.annotations.push({ id: store.uid(), t, text: input.value.trim() });
        run.annotations.sort((a, b) => a.t - b.t);
        saveNow(); renderMarks();
      } }],
    });
  }

  async function autoStart() {
    const vid = run.source?.videoId;
    if (!vid) return toast('Auto-detect needs a local video file.', { type: 'warn' });
    if (!analysis) { queueAnalysis(vid); return toast('Analyzing video first — the start will be suggested when done.'); }
    const L = detectLaunch(analysis.times, analysis.act);
    if (!L) return toast('Could not find a clear launch in this video. Mark it manually.', { type: 'warn' });
    let t = L.t;
    const file = await store.getVideoFile(vid);
    try { const r = file ? await refineLaunch(file, t, fps()) : null; if (r != null && Math.abs(r - t) < 0.7) t = r; } catch {}
    run.markers.start = Math.round(t * 1000) / 1000; run.markers.startAuto = true;
    saveNow(); renderMarks(); seek(t); zoomRun();
    toast(`Launch detected at ${fmtTime(t)} — check it with the frame buttons, then press S to confirm.`, { ms: 5000 });
  }

  async function findRuns() {
    if (!analysis) return toast('Analyze the video first.', { type: 'warn' });
    const segs = motionSegments(analysis.times, analysis.act, { minDuration: 15, mergeGap: 2.5 });
    if (!segs.length) return toast('No driving segments found.', { type: 'warn' });
    const others = store.all('runs').filter((r) => r.source?.videoId === run.source.videoId && r.id !== run.id);
    const picks = segs.map((s, i) => ({ s, on: true, i }));
    modal({
      title: `Found ${segs.length} driving segment${segs.length > 1 ? 's' : ''}`,
      body: h('div', null,
        h('p', { class: 'sub' }, 'Each segment of sustained camera motion is probably one run. Create a run per segment (the first one becomes this run if it has no start yet). Other runs already using this video: ' + others.length),
        h('table', { class: 'table compact' }, h('tbody', null, picks.map((p) => h('tr', null,
          h('td', null, h('input', { type: 'checkbox', checked: true, onchange: (e) => { p.on = e.target.checked; } })),
          h('td', null, `Segment ${p.i + 1}`),
          h('td', { class: 'mono' }, `starts ${fmtTime(p.s.onset, 2)}`),
          h('td', { class: 'mono' }, `${p.s.duration.toFixed(0)} s of motion`),
          h('td', null, h('button', { class: 'btn btn-small', onclick: () => seek(p.s.onset) }, 'View')),
        )))),
      ),
      actions: [{ label: 'Cancel' }, { label: 'Create runs', primary: true, onClick: async () => {
        const chosen = picks.filter((p) => p.on);
        let n = nextRunNumber(run.eventId, run.driverId), created = 0;
        for (const [k, p] of chosen.entries()) {
          if (k === 0 && run.markers.start == null) { run.markers.start = p.s.onset; run.markers.startAuto = true; await store.put('runs', run); continue; }
          await store.put('runs', store.newRun({ eventId: run.eventId, driverId: run.driverId, carId: run.carId, runNumber: n++, source: { ...run.source }, fps: run.fps, markers: { start: p.s.onset, startAuto: true, finish: null, splits: {} } }));
          created++;
        }
        toast(created ? `Created ${created} new run(s) from this video — see the event page.` : 'Start mark set for this run.', { type: 'ok' });
        renderMarks();
      } }],
    });
  }

  // ---------- marks panel ----------
  function renderMarks() {
    clear(markBar);
    const splits = ev?.splits || [];
    add(markBar, 
      h('button', { class: 'btn mark-btn mk-start', title: 'Set start at current frame (S)', onclick: () => setMarker('start', now()) }, 'Set start', h('kbd', null, 'S')),
      splits.map((s, i) => h('button', { class: 'btn mark-btn mk-split', title: `Set "${s.name}" at current frame (${i + 1})`, onclick: () => setMarker(s.id, now()) }, s.name, i < 9 ? h('kbd', null, String(i + 1)) : null)),
      h('button', { class: 'btn mark-btn mk-finish', title: 'Set finish at current frame (F)', onclick: () => setMarker('finish', now()) }, 'Set finish', h('kbd', null, 'F')),
      h('button', { class: 'btn mark-btn', title: 'Add a note at the current time (N)', onclick: addNote }, 'Note', h('kbd', null, 'N')),
      h('span', { class: 'spacer' }),
      run.source?.type === 'local' ? h('button', { class: 'btn btn-small', onclick: autoStart, title: 'Detect launch from camera motion' }, '✨ Auto-detect start') : null,
      ev ? null : h('span', { class: 'sub' }, 'Assign an event to use course splits.'),
    );
    if (ev && !splits.length) add(markBar, h('a', { class: 'sub', href: `#/event/${ev.id}` }, 'Add course splits on the event page →'));

    clear(markList);
    const m = run.markers;
    const rows = [];
    const row = (label, t, key, extra) => rows.push(h('tr', null,
      h('td', null, label),
      h('td', { class: 'mono' }, t != null ? fmtTime(t) : '—'),
      h('td', { class: 'mono' }, t != null && m.start != null ? fmtTime(t - m.start) : ''),
      h('td', null, extra || null),
      h('td', { class: 'r' },
        t != null ? h('button', { class: 'btn btn-small', onclick: () => seek(t) }, 'Go') : null,
        t != null && key ? h('button', { class: 'icon-btn', title: 'Nudge −1 frame', onclick: () => setMarker(key, t - 1 / fps(), { quiet: true }) }, '‹') : null,
        t != null && key ? h('button', { class: 'icon-btn', title: 'Nudge +1 frame', onclick: () => setMarker(key, t + 1 / fps(), { quiet: true }) }, '›') : null,
        t != null && key ? h('button', { class: 'icon-btn danger', title: 'Clear', onclick: () => clearMarker(key) }, '✕') : null),
    ));
    row(h('span', { class: 'mk-dot start' }, 'Start'), m.start, 'start', m.startAuto ? h('span', { class: 'badge badge-auto', title: 'Auto-detected — verify and press S (or Confirm) to accept' }, 'auto', h('button', { class: 'linkish', onclick: () => { m.startAuto = false; saveNow(); renderMarks(); } }, ' confirm')) : null);
    for (const s of ev?.splits || []) row(h('span', { class: 'mk-dot split' }, s.name), m.splits[s.id], s.id);
    const f = effectiveFinish(run);
    row(h('span', { class: 'mk-dot finish' }, 'Finish'), f, m.finish != null ? 'finish' : null,
      m.finish == null && f != null ? h('span', { class: 'badge badge-auto', title: 'Start + official time. Mark it on video for split-accurate syncing.' }, 'from time') : null);
    const vt = videoTime(run);
    add(markList, 
      h('table', { class: 'table compact marks-table' },
        h('thead', null, h('tr', null, h('th', null, 'Mark'), h('th', null, 'Video'), h('th', null, 'Course'), h('th', null, ''), h('th', null, ''))),
        h('tbody', null, rows)),
      vt != null && run.rawTime != null ? h('p', { class: 'sub' }, `Video-measured time ${fmtTime(vt)} vs official ${fmtTime(run.rawTime)} (${fmtDelta(vt - run.rawTime)}). Timing lights trigger slightly after the car starts moving, so a small difference is normal.`) : null,
      run.annotations.length ? h('div', { class: 'notes-list' }, h('h3', null, 'Timed notes'), run.annotations.map((a) => h('div', { class: 'note-item' },
        h('button', { class: 'linkish mono', onclick: () => seek(a.t) }, m.start != null ? fmtTime(a.t - m.start, 2) : fmtTime(a.t, 2)),
        h('span', null, a.text),
        h('button', { class: 'icon-btn danger', title: 'Delete note', onclick: () => { run.annotations = run.annotations.filter((x) => x.id !== a.id); saveNow(); renderMarks(); } }, '✕'),
      ))) : null,
    );
  }

  function renderHud() {
    const t = now();
    const m = run.markers;
    const ct = m.start != null ? t - m.start : null;
    const notes = run.annotations.filter((a) => t >= a.t - 0.2 && t <= a.t + 2.5);
    const key = `${t.toFixed(3)}|${ct?.toFixed(2)}|${notes.map((n) => n.id).join()}`;
    if (key === hudKey) return;
    hudKey = key;
    hud.innerHTML = '';
    add(hud, 
      h('div', { class: 'hud-tl mono' }, `video ${fmtTime(t, 3)}`),
      ct != null ? h('div', { class: 'hud-tr mono big' }, ct < -0.005 ? `−${Math.abs(ct).toFixed(2)}` : fmtTime(Math.max(0, ct), 2)) : null,
      notes.length ? h('div', { class: 'hud-note' }, notes.map((n) => h('div', null, '📝 ', n.text))) : null,
    );
  }

  // ---------- details side panel ----------
  function renderSide() {
    clear(side);
    const field = (label, el, hint) => h('label', { class: 'field' }, h('span', null, label), el, hint ? h('small', { class: 'hint' }, hint) : null);
    const pen = store.settings.conePenalty;
    const evRuns = ev ? store.runsOfEvent(ev.id).filter((r) => r.driverId === run.driverId) : [];
    const best = bestRun(evRuns, pen);
    const adj = adjustedTime(run, pen);
    add(side, 
      h('div', { class: 'time-card' },
        h('div', { class: 'tile-label' }, 'Adjusted time'),
        h('div', { class: 'tile-value mono' }, fmtTime(adj)),
        best && adj != null ? h('div', { class: 'tile-sub' }, best.id === run.id ? 'Best run of the day' : `${fmtDelta(adj - adjustedTime(best, pen))} to best (run ${best.runNumber ?? '?'})`) : null,
      ),
      field('Event', h('select', { class: 'input', onchange: (e) => { run.eventId = e.target.value || null; ev = store.get('events', run.eventId); saveNow(); renderMarks(); } },
        h('option', { value: '' }, '— none —'), eventOptions().map((e) => h('option', { value: e.id, selected: e.id === run.eventId }, eventLabel(e))))),
      h('div', { class: 'grid2' },
        field('Driver', entitySelect('drivers', run.driverId, (v) => { run.driverId = v; saveNow(); })),
        field('Run #', h('input', { class: 'input num', type: 'number', min: 1, value: run.runNumber ?? '', onchange: (e) => { run.runNumber = parseInt(e.target.value) || null; saveNow(); } })),
      ),
      field('Car', entitySelect('cars', run.carId, (v) => { run.carId = v; saveNow(); })),
      h('div', { class: 'grid3' },
        field('Raw time', h('input', { class: 'input num time-input', inputmode: 'decimal', value: run.rawTime != null ? fmtTime(run.rawTime) : '', placeholder: '45.123', onchange: (e) => {
          const t = parseTime(e.target.value);
          if (e.target.value.trim() && t == null) return toast('Time format: 45.123 or 1:05.123', { type: 'warn' });
          run.rawTime = t; saveNow(); renderMarks(); renderSide();
        } })),
        field('Cones', h('input', { class: 'input num', type: 'number', min: 0, value: run.cones || 0, onchange: (e) => { run.cones = Math.max(0, parseInt(e.target.value) || 0); saveNow(); renderSide(); } })),
        field('Status', h('select', { class: 'input', onchange: (e) => { run.status = e.target.value; saveNow(); renderSide(); } }, Object.entries(STATUSES).map(([k, v]) => h('option', { value: k, selected: (run.status || 'ok') === k }, v)))),
      ),
      field('Self-rating', h('div', { class: 'stars' }, [1, 2, 3, 4, 5].map((n) => h('button', { class: `star ${n <= (run.rating || 0) ? 'on' : ''}`, title: `${n}/5`, onclick: (e) => { e.preventDefault(); run.rating = run.rating === n ? 0 : n; saveNow(); renderSide(); } }, '★')))),
      field('Tags', h('input', { class: 'input', value: (run.tags || []).join(', '), placeholder: 'e.g. new tires, rain, 2nd gear slalom', onchange: (e) => { run.tags = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); saveNow(); } }), 'Comma-separated. Filter by tag in the library.'),
      field('Setup', h('textarea', { class: 'input', rows: 3, placeholder: 'Tire pressures, shocks, sway bar, alignment…', value: run.setup || '', oninput: (e) => { run.setup = e.target.value; save(); } })),
      field('Notes', h('textarea', { class: 'input', rows: 4, placeholder: 'What went well, what to change next run…', value: run.notes || '', oninput: (e) => { run.notes = e.target.value; save(); } })),
      h('details', { class: 'video-details' },
        h('summary', null, 'Video & data'),
        h('div', { class: 'sub' }, sourceText(run)),
        run.source?.type === 'local' ? h('div', { class: 'row-actions' },
          h('button', { class: 'btn btn-small', onclick: () => queueAnalysis(run.source.videoId, { force: true }) }, 'Re-analyze'),
          h('button', { class: 'btn btn-small', onclick: findRuns, title: 'For videos that contain several runs' }, 'Find runs in this video'),
          h('button', { class: 'btn btn-small', onclick: async () => { if (await relinkFlow(run)) location.reload(); } }, 'Re-link / replace file'),
        ) : null,
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn btn-small btn-ghost danger', onclick: async () => {
            if (await confirmDialog('Delete this run? (If no other run uses its video, the stored video copy is removed too.)', { danger: true, okLabel: 'Delete' })) {
              cleanup(); await store.deleteRun(run.id); location.hash = ev ? `#/event/${ev.id}` : '#/';
            }
          } }, 'Delete run'),
        ),
      ),
    );
  }

  renderMarks();
  renderSide();

  // ---------- keyboard ----------
  const onKey = (e) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || document.querySelector('.modal-overlay')) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (k === 'ArrowLeft' || k === ',') { e.preventDefault(); e.shiftKey ? seek(now() - 1) : stepFrames(-1); }
    else if (k === 'ArrowRight' || k === '.') { e.preventDefault(); e.shiftKey ? seek(now() + 1) : stepFrames(1); }
    else if (k === 's' || k === 'S') setMarker('start', now());
    else if (k === 'f' || k === 'F') setMarker('finish', now());
    else if (k === 'n' || k === 'N') { e.preventDefault(); addNote(); }
    else if (k === 'Home') { e.preventDefault(); if (run.markers.start != null) seek(run.markers.start); }
    else if (k === 'End') { e.preventDefault(); const f = effectiveFinish(run); if (f != null) seek(f); }
    else if (k === '[') setSpeed(Math.max(0, speedIdx - 1));
    else if (k === ']') setSpeed(Math.min(SPEEDS.length - 1, speedIdx + 1));
    else if (/^[1-9]$/.test(k)) { const s = ev?.splits?.[parseInt(k) - 1]; if (s) setMarker(s.id, now()); }
  };
  document.addEventListener('keydown', onKey);

  function cleanup() {
    save.flush();
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    for (const c of cleanups) c();
    timeline?.destroy();
    player?.destroy();
    player = null;
  }
  return cleanup;
}

function sourceText(run) {
  const s = run.source;
  if (!s) return 'No video attached.';
  if (s.type === 'youtube') return h('span', null, 'YouTube: ', h('a', { href: `https://youtu.be/${s.ytId}`, target: '_blank', rel: 'noopener' }, s.ytId));
  if (s.type === 'url') return `URL: ${s.url}`;
  return `Local file: ${s.fileName || '?'}${run.duration ? ` · ${fmtTime(run.duration, 1)}` : ''}${run.fps ? ` · ${run.fps} fps` : ''}`;
}

function navLinks(run) {
  if (!run.eventId) return null;
  const list = store.runsOfEvent(run.eventId);
  const i = list.findIndex((r) => r.id === run.id);
  return h('span', { class: 'prevnext' },
    h('a', { class: `btn btn-small ${i <= 0 ? 'disabled' : ''}`, href: i > 0 ? `#/run/${list[i - 1].id}` : null, title: 'Previous run in event' }, '‹ Prev'),
    h('a', { class: `btn btn-small ${i >= list.length - 1 ? 'disabled' : ''}`, href: i < list.length - 1 ? `#/run/${list[i + 1].id}` : null, title: 'Next run in event' }, 'Next ›'),
  );
}

function compareWithBest(run) {
  const pen = store.settings.conePenalty;
  const pool = store.runsOfEvent(run.eventId).filter((r) => r.source && r.id !== run.id);
  const mine = bestRun(pool.filter((r) => r.driverId === run.driverId), pen);
  const overall = bestRun(pool, pen);
  const ids = [run.id];
  if (overall) ids.push(overall.id);
  if (mine && mine.id !== overall?.id) ids.push(mine.id);
  if (ids.length < 2) { toast('No other timed run with video in this event to compare against.', { type: 'warn' }); return; }
  setSelection(ids);
  location.hash = `#/compare/${ids.join(',')}`;
}
