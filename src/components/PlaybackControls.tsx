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
  const setSyncSetupMode = useStore((s) => s.setSyncSetupMode);

  const hasComparison = !!session.activeComparison;

  return (
    <div className="glass rounded-xl border border-foreground/5 p-3 space-y-3">
      {/* Main transport controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onSeek(-5)}
          className="p-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors btn-tactile"
          aria-label="Rewind 5 seconds"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062A1.125 1.125 0 0 1 21 8.688v8.123ZM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062a1.125 1.125 0 0 1 1.683.977v8.123Z" />
          </svg>
        </button>

        <button
          onClick={() => onSeek(-1)}
          className="p-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors btn-tactile"
          aria-label="Rewind 1 second"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <button
          onClick={onPlayPause}
          className={`p-4 rounded-full transition-all btn-tactile ${
            isPlaying
              ? "bg-gulf-orange text-white glow-accent"
              : "bg-surface-elevated hover:bg-gulf-orange/20 text-foreground hover:text-gulf-orange"
          }`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => onSeek(1)}
          className="p-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors btn-tactile"
          aria-label="Forward 1 second"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <button
          onClick={() => onSeek(5)}
          className="p-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors btn-tactile"
          aria-label="Forward 5 seconds"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062A1.125 1.125 0 0 1 3 16.811V8.688ZM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062a1.125 1.125 0 0 1-1.683-.977V8.688Z" />
          </svg>
        </button>

        <button
          onClick={onRestart}
          className="p-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors ml-2 btn-tactile"
          aria-label="Restart"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>

      {/* Secondary controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted uppercase tracking-wider mr-1">Speed</span>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                playbackSpeed === speed
                  ? "bg-gulf-orange/15 text-gulf-orange border border-gulf-orange/30"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {hasComparison && (
            <>
              <button
                onClick={() => setSyncSetupMode("runA")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-muted hover:text-gulf-orange hover:bg-gulf-orange/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
                </svg>
                Adjust Sync
              </button>
              <button
                onClick={() => setOverlayMode(!overlayMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  overlayMode
                    ? "bg-gulf-orange/10 text-gulf-orange border border-gulf-orange/20"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                Overlay
              </button>
              <button
                onClick={swapRuns}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                Swap A/B
              </button>
            </>
          )}
        </div>
      </div>

      {/* Offset adjustments */}
      {hasComparison && (
        <div className="grid grid-cols-2 gap-2">
          {(["A", "B"] as const).map((lbl) => (
            <div
              key={lbl}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                lbl === "A" ? "bg-gulf-blue/5 border border-gulf-blue/10" : "bg-gulf-orange/5 border border-gulf-orange/10"
              }`}
            >
              <span className={`text-[10px] font-mono font-bold ${lbl === "A" ? "text-gulf-blue" : "text-gulf-orange"}`}>
                RUN {lbl}
              </span>
              <div className="flex items-center gap-1">
                {[
                  { label: "-1", delta: -1 },
                  { label: "-.1", delta: -0.1 },
                  { label: "+.1", delta: 0.1 },
                  { label: "+1", delta: 1 },
                ].map(({ label: btnLabel, delta }) => (
                  <button
                    key={btnLabel}
                    onClick={() => onAdjustOffset(lbl, delta)}
                    className="w-7 h-7 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover text-[10px] font-mono text-muted hover:text-foreground transition-colors"
                  >
                    {btnLabel}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
