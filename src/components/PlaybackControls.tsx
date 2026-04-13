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
  const session = useStore((s) => s.session);
  const swapRuns = useStore((s) => s.swapRuns);
  const overlayMode = useStore((s) => s.overlayMode);
  const setOverlayMode = useStore((s) => s.setOverlayMode);
  const controlsExpanded = useStore((s) => s.controlsExpanded);
  const setControlsExpanded = useStore((s) => s.setControlsExpanded);

  const hasComparison = !!session.activeComparison;

  return (
    <div className="cockpit-controls rounded-2xl overflow-hidden">
      {/* Main transport — compact floating pill */}
      <div className="flex items-center justify-center gap-1 px-3 py-2">
        {/* Rewind 5s */}
        <button
          onClick={() => onSeek(-5)}
          className="p-2 rounded-lg text-muted hover:text-foreground transition-colors"
          aria-label="Rewind 5 seconds"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062A1.125 1.125 0 0 1 21 8.688v8.123ZM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062a1.125 1.125 0 0 1 1.683.977v8.123Z" />
          </svg>
        </button>

        {/* Rewind 1s */}
        <button
          onClick={() => onSeek(-1)}
          className="p-2 rounded-lg text-muted hover:text-foreground transition-colors"
          aria-label="Rewind 1 second"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className={`p-3 rounded-full mx-1 transition-all ${
            isPlaying
              ? "bg-accent text-white glow-accent"
              : "bg-surface-elevated hover:bg-accent/20 text-foreground hover:text-accent"
          }`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Forward 1s */}
        <button
          onClick={() => onSeek(1)}
          className="p-2 rounded-lg text-muted hover:text-foreground transition-colors"
          aria-label="Forward 1 second"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Forward 5s */}
        <button
          onClick={() => onSeek(5)}
          className="p-2 rounded-lg text-muted hover:text-foreground transition-colors"
          aria-label="Forward 5 seconds"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062A1.125 1.125 0 0 1 3 16.811V8.688ZM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062a1.125 1.125 0 0 1-1.683-.977V8.688Z" />
          </svg>
        </button>

        {/* Restart */}
        <button
          onClick={onRestart}
          className="p-2 rounded-lg text-muted hover:text-foreground transition-colors ml-1"
          aria-label="Restart"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </button>

        {/* Expand toggle */}
        <button
          onClick={() => setControlsExpanded(!controlsExpanded)}
          className={`p-2 rounded-lg transition-colors ml-1 ${
            controlsExpanded ? "text-accent" : "text-muted hover:text-foreground"
          }`}
          aria-label="Expand controls"
        >
          <svg
            className={`w-4 h-4 transition-transform ${controlsExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Expandable drawer */}
      <div className={`controls-drawer ${controlsExpanded ? "expanded" : ""}`}>
        <div className="px-4 pb-3 space-y-3 border-t border-white/5 pt-3">
          {/* Speed selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted uppercase tracking-wider mr-1">Speed</span>
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  playbackSpeed === speed
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* View toggle & Swap */}
          {hasComparison && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOverlayMode(!overlayMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  overlayMode
                    ? "bg-amber/10 text-amber border border-amber/20"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                Overlay
              </button>
              <button
                onClick={swapRuns}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                Swap A/B
              </button>
            </div>
          )}

          {/* Offset adjustments */}
          {hasComparison && (
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as const).map((lbl) => (
                <div
                  key={lbl}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${
                    lbl === "A" ? "bg-accent/5 border border-accent/10" : "bg-teal/5 border border-teal/10"
                  }`}
                >
                  <span className={`text-[10px] font-mono font-bold ${lbl === "A" ? "text-accent" : "text-teal"}`}>
                    {lbl}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onAdjustOffset(lbl, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover text-xs font-mono text-muted hover:text-foreground transition-colors"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => onAdjustOffset(lbl, -0.1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover text-[10px] font-mono text-muted hover:text-foreground transition-colors"
                    >
                      -.1
                    </button>
                    <button
                      onClick={() => onAdjustOffset(lbl, 0.1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover text-[10px] font-mono text-muted hover:text-foreground transition-colors"
                    >
                      +.1
                    </button>
                    <button
                      onClick={() => onAdjustOffset(lbl, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover text-xs font-mono text-muted hover:text-foreground transition-colors"
                    >
                      +1
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
