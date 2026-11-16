// Master-clock playback synchronizer for N players.
// Each track maps the master time (reference run's course time) to its own video time.
// Local <video> players are kept in sync by tiny playback-rate nudges (smooth),
// YouTube players (coarse rate control) by occasional seeks.

export class SyncEngine {
  /**
   * @param {Array<{player, toVideo:(t)=>number, fromVideo:(v)=>number, slope:(t)=>number, isRef?:boolean}>} tracks
   */
  constructor(tracks, { onTick = () => {}, range = { min: -2, max: 60 } } = {}) {
    this.tracks = tracks.map((t) => ({ lastSeek: 0, ...t }));
    this.onTick = onTick;
    this.range = range;
    this.t = range.min;
    this.rate = 1;
    this.playing = false;
    this.loop = null; // {a, b}
    this.holding = false;
    this._last = 0;
    this._raf = 0;
    this._destroyed = false;
    this._frame = this._frame.bind(this);
    this._raf = requestAnimationFrame(this._frame);
  }

  setTracks(tracks) {
    const old = new Map(this.tracks.map((t) => [t.player, t]));
    this.tracks = tracks.map((t) => ({ lastSeek: old.get(t.player)?.lastSeek || 0, ...t }));
    this.seek(this.t);
  }

  setRange(range) { this.range = range; if (this.t > range.max) this.seek(range.max); }

  setRate(r) { this.rate = r; }

  play() {
    if (this.t >= this.range.max - 0.05) this.t = this.loop ? this.loop.a : this.range.min;
    if (this.loop && (this.t < this.loop.a || this.t >= this.loop.b)) this.t = this.loop.a;
    this.playing = true;
    this.holding = false;
    this._last = performance.now();
    for (const tr of this.tracks) {
      const target = tr.toVideo(this.t);
      tr.player.seek(target);
      tr.lastSeek = this._last;
      if (this._active(tr, target)) { tr.player.setRate(this.rate * tr.slope(this.t)); tr.player.play(); }
    }
  }

  pause() {
    this.playing = false;
    for (const tr of this.tracks) tr.player.pause();
    this.seek(this.t);
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  seek(t) {
    this.t = Math.max(this.range.min, Math.min(this.range.max, t));
    const now = performance.now();
    for (const tr of this.tracks) {
      const target = tr.toVideo(this.t);
      tr.player.seek(this._clampTarget(tr, target));
      tr.lastSeek = now;
      if (this.playing) {
        if (this._active(tr, target)) tr.player.play(); else tr.player.pause();
      }
    }
    this.onTick(this.t);
  }

  step(dt) {
    if (this.playing) this.pause();
    this.seek(this.t + dt);
  }

  _clampTarget(tr, target) {
    const d = tr.player.duration || Infinity;
    return Math.max(0, Math.min(d - 0.01, target));
  }

  _active(tr, target) {
    const d = tr.player.duration || Infinity;
    return target >= 0 && target < d - 0.05;
  }

  _frame(now) {
    if (this._destroyed) return;
    this._raf = requestAnimationFrame(this._frame);
    if (!this.playing) { this._last = now; return; }
    const dt = Math.min(0.25, (now - this._last) / 1000);
    this._last = now;

    // Hold the clock while any active player is buffering; resume everybody together.
    const stalled = this.tracks.some((tr) => this._active(tr, tr.toVideo(this.t)) && tr.player.buffering && now - tr.lastSeek > 50);
    if (stalled) {
      if (!this.holding) {
        this.holding = true;
        for (const tr of this.tracks) if (!tr.player.buffering) tr.player.pause();
      }
      this.onTick(this.t);
      return;
    }
    if (this.holding) {
      this.holding = false;
      for (const tr of this.tracks) if (this._active(tr, tr.toVideo(this.t))) tr.player.play();
    }

    // Advance: follow the reference <video> when it is running cleanly (smoothest), else the wall clock.
    let next = this.t + dt * this.rate;
    const ref = this.tracks.find((tr) => tr.isRef);
    if (ref && ref.player.kind === 'local' && !ref.player.paused && now - ref.lastSeek > 300 && this._active(ref, ref.toVideo(this.t))) {
      const tRef = ref.fromVideo(ref.player.time);
      if (Math.abs(tRef - next) < 0.3) next = tRef;
    }
    this.t = next;

    if (this.loop && this.t >= this.loop.b) { this.seek(this.loop.a); return; }
    if (this.t >= this.range.max) {
      this.t = this.range.max;
      this.pause();
      return;
    }

    for (const tr of this.tracks) {
      const target = tr.toVideo(this.t);
      const p = tr.player;
      if (!this._active(tr, target)) {
        if (!p.paused) p.pause();
        const c = this._clampTarget(tr, target);
        if (Math.abs(p.time - c) > 0.1 && now - tr.lastSeek > 500) { p.seek(c); tr.lastSeek = now; }
        continue;
      }
      const wantRate = this.rate * tr.slope(this.t);
      if (p.paused) {
        p.seek(target); tr.lastSeek = now;
        p.setRate(wantRate); p.play();
        continue;
      }
      const err = p.time - target;
      const fine = p.canFineRate();
      const hard = fine ? 0.2 : 0.35;
      if (Math.abs(err) > hard && now - tr.lastSeek > (fine ? 400 : 1200)) {
        p.seek(target + (fine ? 0 : 0.08 * this.rate));
        tr.lastSeek = now;
      } else if (fine) {
        const k = Math.max(-0.12, Math.min(0.12, err * 2));
        p.setRate(wantRate * (1 - k));
      } else {
        p.setRate(wantRate);
      }
    }
    this.onTick(this.t);
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    for (const tr of this.tracks) tr.player.pause();
  }
}
