// Copy course-split marks from a reference run to other runs by aligning what the cameras see.
// Marks made this way are flagged as auto (markers.splitAuto[id] = true) until the user confirms them.

import * as store from './store.js';
import { getAnalysis } from './analyze.js';
import { alignRuns } from './signal.js';
import { Warp, effectiveFinish } from './model.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Why a run can't take part in video alignment, or null if it can. */
export async function alignProblem(run, event) {
  if (run.source?.type !== 'local') return 'not a local video';
  if (!isNum(run.markers?.start)) return 'no start mark';
  if (effectiveFinish(run, event) == null) return 'no finish mark or official time';
  if (!(await getAnalysis(run.source.videoId))) return 'video not analyzed yet';
  return null;
}

/** Align ref → other (cached in the alignments store). Returns {knots, cost} or null. */
export async function alignPair(ref, other, evRef, evOther) {
  const fr = effectiveFinish(ref, evRef), fo = effectiveFinish(other, evOther);
  const sig = [ref.markers.start, fr, other.markers.start, fo].map((x) => x?.toFixed(3)).join(',');
  const key = `${ref.id}|${other.id}`;
  const cached = store.get('alignments', key);
  if (cached && cached.sig === sig) return cached;
  const [a, b] = await Promise.all([getAnalysis(ref.source.videoId), getAnalysis(other.source.videoId)]);
  if (!a || !b) return null;
  const res = alignRuns(
    { times: a.times, frames: a.frames, size: a.W * a.H, start: ref.markers.start, finish: fr },
    { times: b.times, frames: b.frames, size: b.W * b.H, start: other.markers.start, finish: fo },
  );
  if (!res) return null;
  const rec = { id: key, knots: res.knots, cost: res.cost, sig };
  await store.put('alignments', rec);
  return rec;
}

/**
 * Mark splits on `targets` using `ref`'s split marks. Only fills splits that are empty or were
 * auto-marked before (never overwrites a mark the user set by hand).
 * Returns {marked: [{run, count, cost}], skipped: [{run, reason}]}.
 */
export async function autoMarkSplits(ref, targets, event) {
  const out = { marked: [], skipped: [] };
  const refProblem = await alignProblem(ref, event);
  if (refProblem) throw new Error(`Reference run: ${refProblem}.`);
  const refSplits = (event?.splits || []).filter((s) => isNum(ref.markers.splits?.[s.id]));
  if (!refSplits.length) throw new Error('The reference run has no split marks to copy.');
  for (const run of targets) {
    if (run.id === ref.id) continue;
    const problem = await alignProblem(run, event);
    if (problem) { out.skipped.push({ run, reason: problem }); continue; }
    // let the UI breathe between alignments
    await new Promise((r) => setTimeout(r, 0));
    const al = await alignPair(ref, run, event, event);
    if (!al) { out.skipped.push({ run, reason: 'alignment failed' }); continue; }
    const w = new Warp(al.knots);
    run.markers.splits ||= {};
    run.markers.splitAuto ||= {};
    let count = 0;
    for (const s of refSplits) {
      const manual = isNum(run.markers.splits[s.id]) && !run.markers.splitAuto[s.id];
      if (manual) continue;
      const ct = ref.markers.splits[s.id] - ref.markers.start;
      run.markers.splits[s.id] = Math.round((run.markers.start + w.map(ct)) * 1000) / 1000;
      run.markers.splitAuto[s.id] = true;
      count++;
    }
    if (count) await store.put('runs', run);
    out.marked.push({ run, count, cost: al.cost });
  }
  return out;
}
