"use client";

import { useStore } from "@/lib/store";

interface PlaybackControlsProps {
  onPlayPause: () => void;
  onRestart: () => void;
  onSeek: (delta: number) => void;
  onAdjustOffset: (runLabel: "A" | "B", delta: number) => void;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2];

export function PlaybackControls({
  onPlayPause,
  onRestart,
  onSeek,
  onAdjustOffset,
}: PlaybackControlsProps) {
  const isPlaying = useStore((s) => s.isPlaying);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed);
  const swapRuns = useStore((s) => s.swapRuns);
  const overlayMode = useStore((s) => s.overlayMode);
  const setOverlayMode = useStore((s) => s.setOverlayMode);

  return (
    <div className="controls-strip">
      {/* Transport — compact horizontal */}
      <div className="flex items-center gap-1">
        {/* Rewind 5s */}
        <button
          onClick={() => onSeek(-5)}
          className="pw-btn text-muted hover:text-foreground"
          aria-label="Rewind 5s"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062A1.125 1.125 0 0 1 21 8.688v8.123ZM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062a1.125 1.125 0 0 1 1.683.977v8.123Z" />
          </svg>
        </button>

        {/* Rewind 1s */}
        <button
          onClick={() => onSeek(-1)}
          className="pw-btn text-muted hover:text-foreground"
          aria-label="Rewind 1s"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className={`pw-btn px-3 py-1.5 rounded ${
            isPlaying
              ? "bg-accent text-background font-bold"
              : "bg-surface-elevated hover:bg-accent/20 text-foreground hover:text-accent"
          }`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Forward 1s */}
        <button
          onClick={() => onSeek(1)}
          className="pw-btn text-muted hover:text-foreground"
          aria-label="Forward 1s"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Forward 5s */}
        <button
          onClick={() => onSeek(5)}
          className="pw-btn text-muted hover:text-foreground"
          aria-label="Forward 5s"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062A1.125 1.125 0 0 1 3 16.811V8.688ZM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062a1.125 1.125 0 0 1-1.683-.977V8.688Z" />
          </svg>
        </button>

        {/* Restart */}
        <button
          onClick={onRestart}
          className="pw-btn text-muted hover:text-foreground"
          aria-label="Restart"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/6 mx-1" />

      {/* Speed selector — inline */}
      <div className="flex items-center gap-0.5">
        <span className="text-[9px] text-muted uppercase tracking-wider mr-1">Spd</span>
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => setPlaybackSpeed(speed)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono pw-transition ${
              playbackSpeed === speed
                ? "bg-accent/15 text-accent"
                : "text-subtle hover:text-muted"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/6 mx-1" />

      {/* View controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOverlayMode(!overlayMode)}
          className={`pw-btn text-[10px] ${
            overlayMode ? "bg-amber/10 text-amber" : "text-subtle hover:text-muted"
          }`}
        >
          OVL
        </button>
        <button
          onClick={swapRuns}
          className="pw-btn text-[10px] text-subtle hover:text-muted"
        >
          A/B
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Keyboard hints (desktop) */}
      <div className="hidden lg:flex items-center gap-2 text-[9px] text-subtle">
        <span><kbd className="font-mono text-muted">Space</kbd> Play</span>
        <span><kbd className="font-mono text-muted">J/L</kbd> Seek</span>
        <span><kbd className="font-mono text-muted">R</kbd> Reset</span>
      </div>
    </div>
  );
}
