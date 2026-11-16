// Small DOM helpers: element builder, modal dialogs, toasts, and the compare-selection tray.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** Re-run the current route (re-renders the view without reloading the page or losing session state). */
export function rerenderRoute() { window.dispatchEvent(new HashChangeEvent('hashchange')); }

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
/** Append children (flattening arrays, skipping null/false). */
export function add(el, ...children) { append(el, children); return el; }
/** Replace all children. */
export function fill(el, ...children) { clear(el); append(el, children); return el; }

// Dialogs and toasts must live inside the fullscreen element, or they are invisible in fullscreen.
const layerHost = () => document.fullscreenElement || document.body;

// ---------- toasts ----------
export function toast(msg, { type = 'info', ms = 3200 } = {}) {
  let host = $('#toasts');
  if (!host) host = h('div', { id: 'toasts' });
  if (host.parentNode !== layerHost()) layerHost().appendChild(host);
  const t = h('div', { class: `toast toast-${type}` }, msg);
  host.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

// ---------- modals ----------
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); onClose?.(); };
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    const overlays = document.querySelectorAll('.modal-overlay');
    if (overlays[overlays.length - 1] !== overlay) return; // only the topmost dialog closes
    e.stopPropagation();
    close();
  };
  let busy = false; // ignore double clicks while an async action (e.g. import) is running
  const footer = h('div', { class: 'modal-actions' }, actions.map((a) => h('button', {
    class: `btn ${a.primary ? 'btn-primary' : ''} ${a.danger ? 'btn-danger' : ''}`,
    onclick: async () => {
      if (busy) return;
      busy = true;
      const btns = [...footer.querySelectorAll('button')];
      btns.forEach((b) => { b.disabled = true; });
      let r;
      try { r = await a.onClick?.(close); } catch (e) { console.error(e); toast(e.message || String(e), { type: 'error' }); r = false; }
      finally { busy = false; btns.forEach((b) => { b.disabled = false; }); }
      if (r !== false && !a.keepOpen) close();
    },
  }, a.label)));
  const box = h('div', { class: `modal ${wide ? 'modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, '✕')),
    h('div', { class: 'modal-body' }, body),
    actions.length ? footer : null,
  );
  const overlay = h('div', { class: 'modal-overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, box);
  layerHost().appendChild(overlay);
  document.addEventListener('keydown', onKey, true);
  setTimeout(() => box.querySelector('input,select,textarea')?.focus(), 30);
  return { close, box };
}

export function confirmDialog(message, { title = 'Are you sure?', okLabel = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    modal({
      title,
      body: h('p', null, message),
      actions: [
        { label: 'Cancel' },
        { label: okLabel, primary: !danger, danger, onClick: () => { ok = true; } },
      ],
      onClose: () => resolve(ok),
    });
  });
}

export function promptDialog(label, value = '', { title = label, okLabel = 'Save' } = {}) {
  return new Promise((resolve) => {
    let result = null;
    const input = h('input', { class: 'input', value, onkeydown: (e) => { if (e.key === 'Enter') { result = input.value; m.close(); } } });
    const m = modal({
      title,
      body: h('label', { class: 'field' }, h('span', null, label), input),
      actions: [{ label: 'Cancel' }, { label: okLabel, primary: true, onClick: () => { result = input.value; } }],
      onClose: () => resolve(result),
    });
  });
}

export function pickFiles({ accept = 'video/*', multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    input.addEventListener('change', () => { resolve([...input.files]); input.remove(); });
    document.body.appendChild(input);
    input.click();
  });
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- compare selection (persists across views for this tab) ----------
const SEL_KEY = 'autox-selection';
const selListeners = new Set();
let selection = [];
try { selection = JSON.parse(sessionStorage.getItem(SEL_KEY) || '[]'); } catch { selection = []; }

export const getSelection = () => [...selection];
export function isSelected(id) { return selection.includes(id); }
export function toggleSelected(id, on = !selection.includes(id)) {
  if (on && !selection.includes(id)) {
    if (selection.length >= 4) { toast('You can compare up to 4 runs at once.', { type: 'warn' }); return false; }
    selection.push(id);
  } else if (!on) selection = selection.filter((x) => x !== id);
  saveSel();
  return true;
}
export function setSelection(ids) { selection = ids.slice(0, 4); saveSel(); }
function saveSel() {
  sessionStorage.setItem(SEL_KEY, JSON.stringify(selection));
  for (const fn of selListeners) fn(selection);
}
export function onSelection(fn) { selListeners.add(fn); return () => selListeners.delete(fn); }

/** Keyboard shortcuts should not fire while typing in a form field. */
export function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function debounce(fn, ms = 400) {
  let t = null, pendingArgs = null;
  const d = (...a) => { clearTimeout(t); pendingArgs = a; t = setTimeout(() => { t = null; pendingArgs = null; fn(...a); }, ms); };
  /** Run now if a call is pending (or if args are given explicitly). */
  d.flush = (...a) => {
    const pending = t != null;
    clearTimeout(t); t = null;
    const args = a.length ? a : pendingArgs;
    pendingArgs = null;
    if (pending || a.length) fn(...(args || []));
  };
  d.cancel = () => { clearTimeout(t); t = null; pendingArgs = null; };
  return d;
}

export function select(options, value, onchange, attrs = {}) {
  return h('select', { class: 'input', onchange: (e) => onchange(e.target.value), ...attrs },
    options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value ?? '') }, label)));
}
