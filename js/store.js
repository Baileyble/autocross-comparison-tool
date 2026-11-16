// IndexedDB persistence with an in-memory cache for the small metadata stores.
// Video blobs and analysis data are large, so they are read on demand.

const DB_NAME = 'autox-compare';
const DB_VERSION = 1;
const META = ['events', 'runs', 'drivers', 'cars', 'alignments'];
const BIG = ['videos', 'analysis'];

let db = null;
const cache = Object.fromEntries(META.map((s) => [s, new Map()]));
const listeners = new Set();
export const settings = {
  conePenalty: 2,
  leadIn: 2,
  leadOut: 2,
  keepVideoCopies: true,
  autoAnalyze: true,
  defaultFps: 30,
};
// Files picked this session for videos whose blob isn't stored (keepVideoCopies off, or relinked).
const sessionFiles = new Map();

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
}

function req(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function openDB() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of [...META, ...BIG]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Database upgrade blocked — close other tabs of this app.'));
  });
  for (const s of META) {
    const all = await req(db.transaction(s).objectStore(s).getAll());
    for (const o of all) cache[s].set(o.id, o);
  }
  const st = await req(db.transaction('settings').objectStore('settings').getAll());
  for (const { key, value } of st) settings[key] = value;
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  return db;
}

export function closeDB() { try { db?.close(); } catch {} db = null; }

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(store, id) { for (const fn of listeners) { try { fn(store, id); } catch (e) { console.error(e); } } }

// ---------- metadata (synchronous reads) ----------
export const all = (store) => [...cache[store].values()];
export const get = (store, id) => cache[store].get(id) || null;
export const maps = () => ({ events: cache.events, runs: cache.runs, drivers: cache.drivers, cars: cache.cars });

export async function put(store, obj) {
  obj.updatedAt = Date.now();
  if (!obj.createdAt) obj.createdAt = obj.updatedAt;
  if (cache[store]) cache[store].set(obj.id, obj);
  await req(db.transaction(store, 'readwrite').objectStore(store).put(obj));
  emit(store, obj.id);
  return obj;
}

export async function del(store, id) {
  cache[store]?.delete(id);
  await req(db.transaction(store, 'readwrite').objectStore(store).delete(id));
  emit(store, id);
}

export async function saveSetting(key, value) {
  settings[key] = value;
  await req(db.transaction('settings', 'readwrite').objectStore('settings').put({ key, value }));
  emit('settings', key);
}

// ---------- large records ----------
export async function getBig(store, id) {
  return (await req(db.transaction(store).objectStore(store).get(id))) || null;
}
export async function putBig(store, obj) {
  await req(db.transaction(store, 'readwrite').objectStore(store).put(obj));
  emit(store, obj.id);
}
export async function delBig(store, id) {
  await req(db.transaction(store, 'readwrite').objectStore(store).delete(id));
  emit(store, id);
}
export async function allKeys(store) {
  return req(db.transaction(store).objectStore(store).getAllKeys());
}

/** Store a local video. Returns its video id. Blob is kept only if keepVideoCopies is on. */
export async function addVideo(file) {
  const id = uid();
  const rec = { id, name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, blob: null };
  sessionFiles.set(id, file);
  if (settings.keepVideoCopies) {
    rec.blob = file;
    try {
      await putBig('videos', rec);
      return id;
    } catch (e) {
      console.warn('Could not store video copy (quota?)', e);
      rec.blob = null;
      rec.storeError = String(e?.message || e);
    }
  }
  await putBig('videos', rec);
  return id;
}

/** Returns a Blob/File for a video id, or null if it must be relinked. */
export async function getVideoFile(videoId) {
  if (sessionFiles.has(videoId)) return sessionFiles.get(videoId);
  const rec = await getBig('videos', videoId);
  if (rec?.blob) { sessionFiles.set(videoId, rec.blob); return rec.blob; }
  return null;
}

export async function relinkVideo(videoId, file, persist = settings.keepVideoCopies) {
  sessionFiles.set(videoId, file);
  const rec = (await getBig('videos', videoId)) || { id: videoId };
  Object.assign(rec, { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified });
  if (persist) rec.blob = file;
  try { await putBig('videos', rec); } catch (e) { rec.blob = null; await putBig('videos', rec); }
}

export async function videoMeta(videoId) {
  const rec = await getBig('videos', videoId);
  if (!rec) return null;
  const { blob, ...meta } = rec;
  meta.stored = !!blob;
  meta.available = !!blob || sessionFiles.has(videoId);
  return meta;
}

/** Delete video records no longer referenced by any run. */
export async function gcVideos() {
  const used = new Set(all('runs').map((r) => r.source?.videoId).filter(Boolean));
  for (const id of await allKeys('videos')) {
    if (!used.has(id)) { await delBig('videos', id); await delBig('analysis', id).catch(() => {}); sessionFiles.delete(id); }
  }
}

export async function dropStoredCopies() {
  for (const id of await allKeys('videos')) {
    const rec = await getBig('videos', id);
    if (rec?.blob) { sessionFiles.set(id, rec.blob); rec.blob = null; await putBig('videos', rec); }
  }
}

export async function storageEstimate() {
  try { return await navigator.storage.estimate(); } catch { return null; }
}

// ---------- export / import ----------
export function exportJSON() {
  return {
    app: 'autox-compare',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: { ...settings },
    events: all('events'),
    runs: all('runs'),
    drivers: all('drivers'),
    cars: all('cars'),
    alignments: all('alignments'),
  };
}

export async function importJSON(data, { replace = false } = {}) {
  if (!data || data.app !== 'autox-compare') throw new Error('Not an autocross compare backup file.');
  if (replace) for (const s of META) for (const id of [...cache[s].keys()]) await del(s, id);
  let n = 0;
  for (const s of META) for (const o of data[s] || []) { await put(s, o); n++; }
  return n;
}

// ---------- convenience ----------
export function runsOfEvent(eventId) {
  return all('runs').filter((r) => r.eventId === eventId).sort((a, b) => (a.runNumber ?? 999) - (b.runNumber ?? 999) || a.createdAt - b.createdAt);
}

export async function deleteRun(id) {
  await del('runs', id);
  for (const a of all('alignments')) if (a.id.includes(id)) await del('alignments', a.id);
  await gcVideos();
}

export async function deleteEvent(id) {
  for (const r of runsOfEvent(id)) await del('runs', r.id);
  await del('events', id);
  await gcVideos();
}

export function newRun(fields = {}) {
  return {
    id: uid(),
    eventId: null,
    driverId: null,
    carId: null,
    runNumber: null,
    rawTime: null,
    cones: 0,
    status: 'ok',
    tags: [],
    notes: '',
    setup: '',
    rating: 0,
    source: null,
    markers: { start: null, finish: null, splits: {} },
    annotations: [],
    fps: null,
    ...fields,
  };
}
