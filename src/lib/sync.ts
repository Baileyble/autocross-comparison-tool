"use client";

/**
 * SyncController coordinates two YouTube players that have different
 * launch offsets. All timing is in "relative time" T — seconds since
 * each run's launch point — so T=0 means both cars are launching.
 *
 * YouTube players drift apart during playback (buffering, rate hiccups),
 * so while playing we re-align the second player to the first whenever
 * they diverge past a small threshold.
 */

interface Entry {
  player: YT.Player;
  offset: number;
}

const DRIFT_THRESHOLD = 0.15; // seconds
const DRIFT_INTERVAL = 1000; // ms

class SyncController {
  private entries = new Map<string, Entry>();
  private driftTimer: ReturnType<typeof setInterval> | null = null;

  register(id: string, player: YT.Player, offset: number) {
    this.entries.set(id, { player, offset });
  }

  unregister(id: string) {
    this.entries.delete(id);
    if (this.entries.size === 0) this.stopDriftLoop();
  }

  setOffset(id: string, offset: number) {
    const entry = this.entries.get(id);
    if (entry) entry.offset = offset;
  }

  private list(): Entry[] {
    return [...this.entries.values()];
  }

  /** Relative time of the lead (first) player. */
  getTime(): number {
    const first = this.list()[0];
    if (!first) return 0;
    try {
      return Math.max(0, first.player.getCurrentTime() - first.offset);
    } catch {
      return 0;
    }
  }

  /** The shared usable duration — shortest (duration - offset) of the pair. */
  getDuration(): number {
    let min = Infinity;
    for (const e of this.list()) {
      try {
        const d = e.player.getDuration();
        if (d > 0) min = Math.min(min, d - e.offset);
      } catch {
        // ignore players that aren't ready
      }
    }
    return isFinite(min) ? Math.max(0, min) : 0;
  }

  play(speed = 1) {
    for (const e of this.list()) {
      try {
        e.player.setPlaybackRate(speed);
        e.player.playVideo();
      } catch {}
    }
    this.startDriftLoop();
  }

  pause() {
    this.stopDriftLoop();
    for (const e of this.list()) {
      try {
        e.player.pauseVideo();
      } catch {}
    }
  }

  setSpeed(speed: number) {
    for (const e of this.list()) {
      try {
        e.player.setPlaybackRate(speed);
      } catch {}
    }
  }

  seekTo(t: number) {
    const clamped = Math.max(0, t);
    for (const e of this.list()) {
      try {
        e.player.seekTo(e.offset + clamped, true);
      } catch {}
    }
  }

  seekBy(delta: number) {
    this.seekTo(this.getTime() + delta);
  }

  restart() {
    this.pause();
    this.seekTo(0);
  }

  /** Re-align everyone to the lead player's current relative time. */
  realign() {
    this.seekTo(this.getTime());
  }

  private startDriftLoop() {
    this.stopDriftLoop();
    this.driftTimer = setInterval(() => {
      const list = this.list();
      if (list.length < 2) return;
      const [lead, ...rest] = list;
      try {
        if (lead.player.getPlayerState() !== 1) return; // lead not playing
        const tLead = lead.player.getCurrentTime() - lead.offset;
        for (const e of rest) {
          if (e.player.getPlayerState() !== 1) continue;
          const t = e.player.getCurrentTime() - e.offset;
          if (Math.abs(t - tLead) > DRIFT_THRESHOLD) {
            e.player.seekTo(e.offset + tLead, true);
          }
        }
      } catch {}
    }, DRIFT_INTERVAL);
  }

  private stopDriftLoop() {
    if (this.driftTimer) {
      clearInterval(this.driftTimer);
      this.driftTimer = null;
    }
  }
}

export const sync = new SyncController();
