// Uniform player interface over <video> and the YouTube IFrame API.
//   ready: Promise, time (s), duration, seek(t), play(), pause(), setRate(r), buffering, muted, el, destroy()

export class LocalPlayer {
  constructor(container, src, { muted = true } = {}) {
    this.kind = 'local';
    const v = document.createElement('video');
    v.playsInline = true;
    v.preload = 'auto';
    v.muted = muted;
    v.disablePictureInPicture = true;
    v.src = src;
    v.className = 'player-media';
    container.appendChild(v);
    this.el = v;
    this._waiting = false;
    v.addEventListener('waiting', () => { this._waiting = true; });
    v.addEventListener('playing', () => { this._waiting = false; });
    v.addEventListener('canplay', () => { this._waiting = false; });
    v.addEventListener('seeked', () => { this._waiting = false; });
    this.ready = new Promise((res, rej) => {
      if (v.readyState >= 1) return res();
      v.addEventListener('loadedmetadata', () => res(), { once: true });
      v.addEventListener('error', () => rej(new Error(mediaErrorText(v.error))), { once: true });
    });
  }
  get time() { return this.el.currentTime; }
  get duration() { return this.el.duration || 0; }
  get paused() { return this.el.paused; }
  get buffering() { return this._waiting || (!this.el.paused && this.el.readyState < 3) || this.el.seeking; }
  get muted() { return this.el.muted; }
  set muted(m) { this.el.muted = m; }
  get rate() { return this.el.playbackRate; }
  seek(t) {
    const d = this.duration || Infinity;
    const tt = Math.max(0, Math.min(d - 0.001, t));
    this.el.currentTime = tt; // precise (not fastSeek) so frame stepping is exact
  }
  play() { const p = this.el.play(); if (p?.catch) p.catch(() => {}); }
  pause() { this.el.pause(); }
  setRate(r) {
    const rr = Math.max(0.0625, Math.min(16, r));
    if (Math.abs(this.el.playbackRate - rr) > 0.002) this.el.playbackRate = rr;
  }
  canFineRate() { return true; }
  destroy() { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.el.remove(); }
}

function mediaErrorText(err) {
  if (!err) return 'Video failed to load.';
  const map = { 1: 'Loading aborted.', 2: 'Network error while loading video.', 3: 'Video could not be decoded (codec not supported by this browser?).', 4: 'Video format not supported by this browser.' };
  return map[err.code] || err.message || 'Video failed to load.';
}

// ---------- YouTube ----------
let ytApi = null;
export function loadYouTubeAPI() {
  if (ytApi) return ytApi;
  ytApi = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytApi = null; reject(new Error('Could not load YouTube player (offline or blocked?).')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!window.YT?.Player) { ytApi = null; reject(new Error('YouTube player could not load (offline or blocked?).')); } }, 12000);
  });
  return ytApi;
}

const YT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export class YouTubePlayer {
  constructor(container, videoId, { muted = true, startAt = 0 } = {}) {
    this.kind = 'youtube';
    this.videoId = videoId;
    const host = document.createElement('div');
    host.className = 'player-media';
    const inner = document.createElement('div');
    host.appendChild(inner);
    container.appendChild(host);
    this.el = host;
    this._muted = muted;
    this._t = startAt;
    this._tWall = performance.now();
    this._state = -1;
    this._rate = 1;
    this.ready = loadYouTubeAPI().then((YT) => new Promise((res, rej) => {
      this.p = new YT.Player(inner, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, start: Math.floor(startAt), iv_load_policy: 3, fs: 0 },
        events: {
          onReady: () => {
            if (this._muted) this.p.mute();
            // Cue the video so a frame shows without autoplay.
            this.p.seekTo(startAt, true);
            this.p.pauseVideo();
            res();
          },
          onStateChange: (e) => { this._state = e.data; },
          onError: (e) => rej(new Error(`YouTube error ${e.data} (video private, removed, or embedding disabled?)`)),
          onPlaybackRateChange: (e) => { this._rate = e.data; },
        },
      });
    }));
  }
  get time() { try { return this.p?.getCurrentTime?.() ?? this._t; } catch { return this._t; } }
  get duration() { try { return this.p?.getDuration?.() || 0; } catch { return 0; } }
  get paused() { return this._state !== 1 && this._state !== 3; }
  get buffering() { return this._state === 3; }
  get muted() { return this._muted; }
  set muted(m) { this._muted = m; try { m ? this.p?.mute() : this.p?.unMute(); } catch {} }
  get rate() { return this._rate; }
  seek(t) { try { this.p?.seekTo(Math.max(0, t), true); } catch {} }
  play() { try { this.p?.playVideo(); } catch {} }
  pause() { try { this.p?.pauseVideo(); } catch {} }
  setRate(r) {
    let best = 1, bd = Infinity;
    for (const x of YT_RATES) { const d = Math.abs(x - r); if (d < bd) { bd = d; best = x; } }
    if (best !== this._rate) { this._rate = best; try { this.p?.setPlaybackRate(best); } catch {} }
  }
  canFineRate() { return false; }
  destroy() { try { this.p?.destroy(); } catch {} this.el.remove(); }
}

export function ytThumb(id) { return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; }
