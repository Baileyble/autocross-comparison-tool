// End-to-end smoke test in headless Chromium using synthetic videos with known ground truth.
// Usage: node tests/e2e.mjs [--shots dir]
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright is resolved via require so a globally installed copy works too.
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fx = path.join(root, 'tests', 'fixtures');
const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });

let truth;
if (!existsSync(path.join(fx, 'run_b.webm')) || !existsSync(path.join(fx, 'truth.json'))) {
  mkdirSync(fx, { recursive: true });
  const out = execFileSync('python3', [path.join(root, 'tests', 'make_fixtures.py'), fx]).toString();
  (await import('node:fs')).writeFileSync(path.join(fx, 'truth.json'), out);
}
truth = JSON.parse((await import('node:fs')).readFileSync(path.join(fx, 'truth.json'), 'utf8'));

const PORT = 8765;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ' — ' + detail : ''}`); };
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: false }); };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const store = (fn, arg) => page.evaluate(async ([src, a]) => { const s = await import('/js/store.js'); return new Function('s', 'a', `return (${src})(s, a)`)(s, a); }, [fn.toString(), arg]);

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForSelector('.welcome');
  check('welcome screen renders', true);
  await shot(page, '01-welcome');

  // ---- import two videos via the dialog ----
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Import run videos').then(() => page.click('.import .dropzone'))]);
  await chooser.setFiles([path.join(fx, 'run_a.webm'), path.join(fx, 'run_b.webm')]);
  await page.fill('input[placeholder="e.g. Points Event #4"]', 'Test Event');
  // create a driver via the "+ New driver…" option
  const drvSel = page.locator('.import .grid3 select').nth(1);
  await drvSel.selectOption('__new');
  await page.fill('.modal-overlay:last-child input', 'Alex');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await shot(page, '02-import');
  await page.click('.modal-actions >> text=Import');
  await page.waitForSelector('.entry-table');
  check('import creates event with 2 runs', (await page.locator('.entry-table tbody tr').count()) === 2);

  // ---- wait for background analysis & auto start detection ----
  const t0 = Date.now();
  let runs = [];
  while (Date.now() - t0 < 90000) {
    runs = await store((s) => s.all('runs').map((r) => ({ id: r.id, start: r.markers.start, auto: r.markers.startAuto, name: r.source.fileName, fps: r.fps, thumb: !!r.thumb })));
    if (runs.length === 2 && runs.every((r) => r.start != null && r.thumb)) break;
    await page.waitForTimeout(500);
  }
  console.log('analysis took', ((Date.now() - t0) / 1000).toFixed(1), 's', runs);
  const ra = runs.find((r) => r.name === 'run_a.webm'), rb = runs.find((r) => r.name === 'run_b.webm');
  // Motion from standstill starts sub-pixel, so detection lands a few frames after the true onset.
  // What matters for syncing is that the bias is the same for both runs.
  check('launch A auto-detected (±0.15 s)', ra?.start != null && Math.abs(ra.start - truth.launchA) <= 0.15, `got ${ra?.start?.toFixed(3)}, truth ${truth.launchA}`);
  check('launch B auto-detected, skipping the creep (±0.15 s)', rb?.start != null && Math.abs(rb.start - truth.launchB) <= 0.15, `got ${rb?.start?.toFixed(3)}, truth ${truth.launchB}`);
  const rel = (ra.start - truth.launchA) - (rb.start - truth.launchB);
  check('detection bias consistent between runs (≤1 frame)', Math.abs(rel) <= 1 / 30 + 1e-3, `relative ${rel.toFixed(3)} s`);
  check('fps detected', ra?.fps === 30, `fps=${ra?.fps}`);

  // ---- enter official times in the event table ----
  await page.waitForTimeout(500);
  const timeInputs = page.locator('.entry-table .time-input');
  const order = await store((s) => s.runsOfEvent(s.all('events')[0].id).map((r) => r.source.fileName));
  for (let i = 0; i < 2; i++) {
    await timeInputs.nth(i).fill(order[i] === 'run_a.webm' ? String(truth.finishA) : String(truth.finishB));
    await timeInputs.nth(i).press('Tab');
    await page.waitForTimeout(150);
  }
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.waitForTimeout(600);
  await shot(page, '03-event');
  const times = await store((s) => s.all('runs').map((r) => r.rawTime));
  check('times saved from quick entry', times.every((t) => t > 20), JSON.stringify(times));

  // ---- add a split on the event, mark it on both runs via the run editor ----
  await page.click('text=+ Add split');
  await page.fill('.modal-overlay input', 'Halfway');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  for (const [r, tHalfCourse] of [[ra, 10.5], [rb, 11.5]]) {
    await page.goto(`http://127.0.0.1:${PORT}/#/run/${r.id}`);
    await page.waitForSelector('.stage video');
    await page.waitForFunction(() => document.querySelector('.stage video').readyState >= 2);
    await page.evaluate((t) => { document.querySelector('.stage video').currentTime = t; }, r.start + tHalfCourse);
    await page.waitForTimeout(400);
    await page.keyboard.press('1');
    await page.waitForTimeout(300);
  }
  const splits = await store((s) => s.all('runs').map((r) => Object.values(r.markers.splits)[0]));
  check('split marked via keyboard in run editor', splits.every((x) => x > 10), JSON.stringify(splits));
  await page.goto(`http://127.0.0.1:${PORT}/#/run/${ra.id}`);
  await page.waitForSelector('.stage video');
  await page.waitForTimeout(1200);
  await shot(page, '04-run-editor');

  // ---- compare: real-time sync ----
  await page.goto(`http://127.0.0.1:${PORT}/#/compare/${ra.id},${rb.id}`);
  await page.waitForSelector('.panel video');
  await page.waitForFunction(() => [...document.querySelectorAll('.panel video')].every((v) => v.readyState >= 2));
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(4000);
  const syncErr = await page.evaluate(async ([a, b]) => {
    const vids = [...document.querySelectorAll('.panel video')];
    const out = [];
    const t0 = vids[0].currentTime;
    for (let k = 0; k < 10; k++) { out.push((vids[0].currentTime - a) - (vids[1].currentTime - b)); await new Promise((r) => setTimeout(r, 100)); }
    return { out, advanced: vids[0].currentTime - t0, paused: vids.map((v) => v.paused), pos: vids[0].currentTime - a };
  }, [ra.start, rb.start]);
  const maxErr = Math.max(...syncErr.out.map(Math.abs));
  check('compare playback is running', syncErr.advanced > 0.7 && !syncErr.paused.some(Boolean), `advanced ${syncErr.advanced.toFixed(2)} s in 1 s, course t=${syncErr.pos.toFixed(2)}`);
  check('real-time playback stays in sync', maxErr < 0.08, `max error ${maxErr.toFixed(3)} s`);
  await shot(page, '05-compare-realtime');
  await page.keyboard.press('Space');

  // live delta HUD present
  const deltaText = await page.locator('.panel .hud-bl').first().textContent().catch(() => '');
  check('live delta shown', /[+−±]\d/.test(deltaText || ''), deltaText);

  // ---- position-locked mode: at A's course time t, B should be at its matching knot-warped time ----
  await page.click('.seg-btn:has-text("Position-locked")');
  await page.waitForTimeout(300);
  await page.keyboard.press('Home');
  await page.keyboard.press('Space');
  await page.waitForTimeout(5000);
  const lockErr = await page.evaluate(async ([a, b, fa, fb]) => {
    const vids = [...document.querySelectorAll('.panel video')];
    const ref = [...document.querySelectorAll('.panel')].findIndex((p) => p.querySelector('.hud-ref'));
    const out = [];
    for (let k = 0; k < 8; k++) {
      const tA = vids[0].currentTime - a, tB = vids[1].currentTime - b;
      // knots: start (0,0), halfway (10.5, 11.5), finish (fa, fb)
      const exp = tA < 10.5 ? tA * (11.5 / 10.5) : 11.5 + (tA - 10.5) * ((fb - 11.5) / (fa - 10.5));
      out.push(tB - exp);
      await new Promise((r) => setTimeout(r, 120));
    }
    return { ref, out };
  }, [ra.start, rb.start, truth.finishA, truth.finishB]);
  const lockMax = Math.max(...lockErr.out.map(Math.abs));
  check('position-locked playback follows split warp', lockMax < 0.1, `ref panel ${lockErr.ref}, max error ${lockMax.toFixed(3)} s`);
  await shot(page, '06-compare-locked');
  await page.keyboard.press('Space');

  // ---- video auto-alignment vs ground truth ----
  await page.click('.seg-btn:has-text("Video")');
  await page.waitForTimeout(2500);
  const al = await store((s) => s.all('alignments').map((a) => a.knots));
  if (al.length) {
    const { Warp } = await import(path.join(root, 'js', 'model.js'));
    const w = new Warp(al[0]);
    // Compare in video time: A at video 3.0+tA should map to B at video 5.0+truth[tA].
    const errs = Object.entries(truth.truth).map(([tA, tB]) => Math.abs((rb.start + w.map(truth.launchA + +tA - ra.start)) - (truth.launchB + tB)));
    check('video auto-alignment matches ground truth (±0.3 s)', Math.max(...errs) < 0.3, `errors ${errs.map((e) => e.toFixed(2)).join(', ')}`);
  } else check('video auto-alignment produced', false);
  await shot(page, '07-compare-autoalign');

  // ---- overlay layout + split loop ----
  await page.click('.seg-btn:has-text("Overlay")');
  await page.locator('.cmp-split-table tbody tr').first().click();
  await page.waitForTimeout(1500);
  await shot(page, '08-overlay-loop');
  await page.keyboard.press('Space');
  await page.click('.seg-btn:has-text("Side by side")');

  // ---- adjust sync: nudge B one frame and set it as the new start ----
  await page.goto(`http://127.0.0.1:${PORT}/#/compare/${ra.id},${rb.id}`);
  await page.waitForFunction(() => [...document.querySelectorAll('.panel video')].every((v) => v.readyState >= 2));
  await page.click('button:has-text("Adjust sync")');
  const bBar = page.locator('.panel[data-i="1"] .adjust-bar');
  const vBefore = await page.evaluate(() => document.querySelectorAll('.panel video')[1].currentTime);
  await bBar.locator('button:has-text("+1f")').click();
  await page.waitForTimeout(300);
  await bBar.locator('button:has-text("Set start here")').click();
  await page.waitForTimeout(300);
  const after = await store((s, id) => s.get('runs', id).markers.start, rb.id);
  check('adjust sync: "+1f" then "Set start here" marks that exact frame', Math.abs(after - (vBefore + 1 / 30)) < 0.005, `${vBefore.toFixed(3)} + 1f → ${after.toFixed(3)}`);
  await page.click('button:has-text("Done adjusting")');
  await store((s, a) => { const r = s.get('runs', a.id); r.markers.start = a.start; s.put('runs', r); }, rb);

  // ---- timed note in run editor ----
  await page.goto(`http://127.0.0.1:${PORT}/#/run/${ra.id}`);
  await page.waitForFunction(() => document.querySelector('.stage video')?.readyState >= 2);
  await page.keyboard.press('n');
  await page.fill('.modal textarea', 'Late on the brakes into the slalom');
  await page.click('.modal-actions >> text=Add note');
  await page.waitForTimeout(500);
  const notes = await store((s, id) => s.get('runs', id).annotations.length, ra.id);
  check('timed note added with N', notes === 1);

  // ---- finish mark on A calibrates the launch→beam offset used for B's estimated finish ----
  await page.goto(`http://127.0.0.1:${PORT}/#/run/${ra.id}`);
  await page.waitForFunction(() => document.querySelector('.stage video')?.readyState >= 2);
  const trueFinishA = truth.launchA + truth.finishA; // video time the car actually reaches the finish
  await page.evaluate((t) => { document.querySelector('.stage video').currentTime = t; }, trueFinishA);
  await page.waitForTimeout(400);
  await page.keyboard.press('f');
  await page.waitForTimeout(600);
  const off = await store((s) => s.all('events')[0].beamOffset);
  const expectedOff = trueFinishA - ra.start - truth.finishA;
  check('launch→beam offset calibrated from a marked finish', off != null && Math.abs(off - expectedOff) < 0.01, `offset ${off} (expected ${expectedOff.toFixed(3)})`);
  const { effectiveFinish } = await import(path.join(root, 'js', 'model.js'));
  const finB = await store((s, id) => { const r = s.get('runs', id); return { r, ev: s.get('events', r.eventId) }; }, rb.id);
  const estB = effectiveFinish(finB.r, finB.ev);
  check('estimated finish for B lands near its true finish', Math.abs(estB - (truth.launchB + truth.finishB)) < 0.06, `${estB.toFixed(3)} vs ${truth.launchB + truth.finishB}`);

  // ---- auto-mark splits: clear B's split, copy from A by video alignment ----
  const evIdA = await store((s) => s.all('events')[0].id);
  await store((s, id) => { const r = s.get('runs', id); r.markers.splits = {}; return s.put('runs', r); }, rb.id);
  await page.goto(`http://127.0.0.1:${PORT}/#/event/${evIdA}`);
  await page.click('button:has-text("Auto-mark splits")');
  await page.click('.modal-actions >> text=Auto-mark');
  await page.waitForTimeout(2500);
  const bSplit = await store((s, id) => { const r = s.get('runs', id); return { t: Object.values(r.markers.splits)[0], auto: Object.values(r.markers.splitAuto || {})[0] }; }, rb.id);
  // Truth: where B's camera shows what A's camera showed at A's split.
  const aSplitCourse = (ra.start + 10.5) - truth.launchA;
  const keys = Object.keys(truth.truth).map(Number).sort((x, y) => x - y);
  const k = keys.findIndex((x) => x > aSplitCourse);
  const tB = truth.truth[keys[k - 1]] + (aSplitCourse - keys[k - 1]) * (truth.truth[keys[k]] - truth.truth[keys[k - 1]]) / (keys[k] - keys[k - 1]);
  check('auto-marked split matches ground truth (±0.15 s) and is flagged auto', bSplit.t != null && Math.abs(bSplit.t - (truth.launchB + tB)) < 0.15 && bSplit.auto === true, `${bSplit.t} vs ${(truth.launchB + tB).toFixed(3)}`);

  // ---- event page: segment table & YouTube import ----
  const evId = await store((s) => s.all('events')[0].id);
  await page.goto(`http://127.0.0.1:${PORT}/#/event/${evId}`);
  await page.waitForSelector('.split-table');
  check('segment table with theoretical best shown', (await page.locator('.split-table .tb-row').count()) >= 1);
  await shot(page, '12-event-splits');
  await page.click('button:has-text("Import runs")');
  await page.fill('.import textarea', 'https://youtu.be/dQw4w9WgXcQ?t=12');
  await page.click('.modal-actions >> text=Import');
  await page.waitForTimeout(600);
  const yt = await store((s) => s.all('runs').filter((r) => r.source?.type === 'youtube').map((r) => r.markers.start));
  check('YouTube link imported with ?t= as start mark', yt.length === 1 && yt[0] === 12, JSON.stringify(yt));

  // ---- regressions: marks need a loaded video; deleted runs stay deleted ----
  const ytId = await store((s) => s.all('runs').find((r) => r.source?.type === 'youtube').id);
  await page.goto(`http://127.0.0.1:${PORT}/#/run/${ytId}`);
  await page.waitForSelector('.run-side');
  await page.waitForTimeout(500);
  await page.keyboard.press('f'); // YouTube can't load in this sandbox, so there is no current frame
  await page.waitForTimeout(300);
  const fin = await store((s, id) => s.get('runs', id).markers.finish, ytId);
  check('mark keys do nothing without a loaded video', fin == null, `finish=${fin}`);
  await page.click('.video-details summary');
  await page.click('button:has-text("Delete run")');
  await page.click('.modal-actions >> text=Delete');
  await page.waitForSelector('.entry-table');
  await page.waitForTimeout(800);
  const stillThere = await store((s, id) => !!s.get('runs', id), ytId);
  const inDb = await page.evaluate((id) => new Promise((res) => { const r = indexedDB.open('autox-compare'); r.onsuccess = () => { const g = r.result.transaction('runs').objectStore('runs').get(id); g.onsuccess = () => res(!!g.result); }; }), ytId);
  check('deleting a run from the editor keeps it deleted', !stillThere && !inDb, `cache=${stillThere} db=${inDb}`);

  // ---- settings dialog ----
  await page.click('#btn-settings');
  await page.waitForSelector('.settings h3');
  check('settings dialog opens', await page.locator('text=Seconds per cone').isVisible());
  await shot(page, '13-settings');
  await page.keyboard.press('Escape');

  // ---- progress page & library ----
  await page.goto(`http://127.0.0.1:${PORT}/#/progress`);
  await page.waitForSelector('h1:has-text("Progress")');
  await shot(page, '09-progress');
  await page.goto(`http://127.0.0.1:${PORT}/#/`);
  await page.waitForSelector('.event-card');
  await shot(page, '10-library');

  // ---- legacy share link & new share links decode ----
  await page.goto(`http://127.0.0.1:${PORT}/?v1=https://youtu.be/dQw4w9WgXcQ&v2=https://youtu.be/9bZkp7q19f0&t1=1.5&t2=2`);
  await page.waitForSelector('.run-chip');
  check('legacy ?v1=&v2= link opens shared compare', (await page.locator('.run-chip').count()) === 2);

  // ---- dialogs: Escape closes only the top one; import dialog fits a phone screen ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${PORT}/#/`);
  await page.waitForSelector('.event-card');
  await page.click('button:has-text("Import runs")');
  await page.locator('.import .grid3 select').nth(1).selectOption('__new');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape closes only the topmost dialog', (await page.locator('.modal-overlay').count()) === 1);
  const box = await page.locator('.modal').boundingBox();
  check('import dialog fits a 390px-wide screen', box && box.x >= 0 && box.x + box.width <= 390.5, `x=${box?.x} w=${box?.width}`);
  await page.keyboard.press('Escape');

  // ---- mobile layout ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${PORT}/#/compare/${ra.id},${rb.id}`);
  await page.waitForSelector('.panel video');
  await page.waitForTimeout(800);
  await shot(page, '11-mobile-compare');
} catch (e) {
  check('no exception', false, e.stack);
  await shot(page, 'zz-failure');
} finally {
  const relevant = errors.filter((e) => !/ytimg|youtube\.com|ERR_|net::|Failed to load resource/i.test(e));
  check('no page errors', relevant.length === 0, relevant.slice(0, 5).join(' | '));
  await browser.close();
  server.kill();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
