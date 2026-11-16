// Zoomable canvas timeline for the run editor: motion + audio graphs, draggable markers, playhead.

export class Timeline {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{duration:number, getTime:()=>number, onSeek:(t)=>void, getMarkers:()=>Array, onMarkerDrag:(m,t)=>void}} o
   */
  constructor(canvas, o) {
    this.c = canvas;
    this.o = o;
    this.duration = o.duration || 1;
    this.v0 = 0;
    this.v1 = this.duration;
    this.analysis = null;
    this.drag = null;
    this.hover = null;
    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerup', (e) => this._up(e));
    canvas.addEventListener('pointercancel', (e) => this._up(e));
    canvas.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    this._ro = new ResizeObserver(() => this.draw());
    this._ro.observe(canvas);
  }
  setDuration(d) { const fit = this.v0 === 0 && this.v1 === this.duration; this.duration = d || 1; if (fit) this.v1 = this.duration; this.draw(); }
  setAnalysis(a) { this.analysis = a; this.draw(); }
  zoomTo(a, b) {
    const span = Math.max(0.2, b - a);
    this.v0 = Math.max(0, a); this.v1 = Math.min(this.duration, this.v0 + span);
    if (this.v1 - this.v0 < span) this.v0 = Math.max(0, this.v1 - span);
    this.draw();
  }
  fit() { this.v0 = 0; this.v1 = this.duration; this.draw(); }
  _x(t) { return ((t - this.v0) / (this.v1 - this.v0)) * this.w; }
  _t(x) { return this.v0 + (x / this.w) * (this.v1 - this.v0); }
  _pos(e) { const r = this.c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  _hit(x, y) {
    if (y > 20) return null;
    let best = null, bd = 8;
    for (const m of this.o.getMarkers()) {
      if (!m.draggable) continue;
      const d = Math.abs(this._x(m.t) - x);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  _down(e) {
    const { x, y } = this._pos(e);
    this.c.setPointerCapture(e.pointerId);
    const m = this._hit(x, y);
    if (m) { this.drag = { marker: m }; return; }
    this.drag = { scrub: true };
    this.o.onSeek(this._clamp(this._t(x)));
  }
  _move(e) {
    const { x, y } = this._pos(e);
    if (!this.drag) {
      const m = this._hit(x, y);
      this.c.style.cursor = m ? 'ew-resize' : 'pointer';
      return;
    }
    const t = this._clamp(this._t(x));
    if (this.drag.marker) { this.o.onMarkerDrag(this.drag.marker, t); this.o.onSeek(t); }
    else this.o.onSeek(t);
  }
  _up() { this.drag = null; }
  _clamp(t) { return Math.max(0, Math.min(this.duration, t)); }
  _wheel(e) {
    e.preventDefault();
    const { x } = this._pos(e);
    const span = this.v1 - this.v0;
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const d = ((e.deltaX || e.deltaY) / this.w) * span;
      let a = this.v0 + d;
      a = Math.max(0, Math.min(this.duration - span, a));
      this.v0 = a; this.v1 = a + span;
    } else {
      const tc = this._t(x);
      const f = Math.exp(e.deltaY * 0.0015);
      const ns = Math.max(0.3, Math.min(this.duration, span * f));
      let a = tc - ((tc - this.v0) / span) * ns;
      a = Math.max(0, Math.min(this.duration - ns, a));
      this.v0 = a; this.v1 = a + ns;
    }
    this.draw();
  }
  draw() {
    const c = this.c, dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    this.w = W;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0d1218';
    g.fillRect(0, 0, W, H);
    // ticks
    const span = this.v1 - this.v0;
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => (s / span) * W > 70) || 600;
    g.font = '10px ui-monospace, monospace';
    g.fillStyle = '#5b6b7c';
    g.strokeStyle = '#1b2530';
    g.lineWidth = 1;
    for (let t = Math.ceil(this.v0 / step) * step; t <= this.v1; t += step) {
      const x = Math.round(this._x(t)) + 0.5;
      g.beginPath(); g.moveTo(x, 20); g.lineTo(x, H); g.stroke();
      const m = Math.floor(t / 60), s = t - m * 60;
      g.fillText(`${m}:${s.toFixed(step < 1 ? 1 : 0).padStart(step < 1 ? 4 : 2, '0')}`, x + 3, H - 4);
    }
    const top = 22, bottom = H - 16, mid = (top + bottom) / 2;
    // audio
    const a = this.analysis;
    if (a?.audio?.env) {
      const { hz, env } = a.audio;
      g.fillStyle = 'rgba(148,163,184,0.35)';
      const amp = (bottom - top) / 2;
      for (let x = 0; x < W; x++) {
        const i0 = Math.floor(this._t(x) * hz), i1 = Math.max(i0 + 1, Math.floor(this._t(x + 1) * hz));
        let v = 0;
        for (let i = i0; i < i1 && i < env.length; i++) if (env[i] > v) v = env[i];
        const hgt = Math.sqrt(v) * amp;
        g.fillRect(x, mid - hgt, 1, hgt * 2);
      }
    }
    // motion
    if (a?.times?.length) {
      g.strokeStyle = '#22d3ee';
      g.lineWidth = 1.5;
      g.beginPath();
      let started = false;
      for (let i = 0; i < a.times.length; i++) {
        const t = a.times[i];
        if (t < this.v0 - 1 || t > this.v1 + 1) continue;
        const x = this._x(t), y = bottom - Math.min(1, a.act[i] * 1.6) * (bottom - top);
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.stroke();
    }
    // markers
    for (const m of this.o.getMarkers()) {
      if (m.t < this.v0 || m.t > this.v1) continue;
      const x = Math.round(this._x(m.t)) + 0.5;
      g.strokeStyle = m.color; g.fillStyle = m.color;
      g.lineWidth = m.kind === 'note' ? 1 : 2;
      g.setLineDash(m.dashed ? [4, 3] : []);
      g.beginPath(); g.moveTo(x, m.kind === 'note' ? 14 : 18); g.lineTo(x, bottom); g.stroke();
      g.setLineDash([]);
      if (m.kind === 'note') {
        g.beginPath(); g.arc(x, 10, 4, 0, Math.PI * 2); g.fill();
      } else {
        g.font = 'bold 10px system-ui, sans-serif';
        const tw = g.measureText(m.label).width + 8;
        g.fillRect(x, 2, tw, 16);
        g.fillStyle = '#0b0f14';
        g.fillText(m.label, x + 4, 14);
      }
    }
    // playhead
    const pt = this.o.getTime();
    if (pt >= this.v0 && pt <= this.v1) {
      const x = Math.round(this._x(pt)) + 0.5;
      g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    }
    // overview strip (when zoomed)
    if (this.v0 > 0 || this.v1 < this.duration) {
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(0, H - 2, W, 2);
      g.fillStyle = '#ff7a1a';
      g.fillRect((this.v0 / this.duration) * W, H - 2, Math.max(2, ((this.v1 - this.v0) / this.duration) * W), 2);
    }
  }
  destroy() { this._ro.disconnect(); }
}
