"use client";

import { useState } from "react";
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

  const [showOffsets, setShowOffsets] = useState(false);

  const hasComparison = !!session.activeComparison;

  return (
    <div className="card p-4 space-y-4">
      {/* Transport controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onSeek(-5)}
          className="p-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
          aria-label="Rewind 5 seconds"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062A1.125 1.125 0 0 1 21 8.688v8.123ZM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062a1.125 1.125 0 0 1 1.683.977v8.123Z" />
          </svg>
        </button>

        <button
          onClick={() => onSeek(-1)}
          className="p-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
          aria-label="Rewind 1 second"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Big play/pause button */}
        <button
          onClick={onPlayPause}
          className={`p-4 rounded-full transition-all ${
            isPlaying
              ? "bg-accent text-white shadow-lg shadow-accent/25"
              : "bg-surface-elevated hover:bg-surface-hover text-foreground"
          }`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => onSeek(1)}
          className="p-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
          aria-label="Forward 1 second"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <button
          onClick={() => onSeek(5)}
          className="p-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
          aria-label="Forward 5 seconds"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062A1.125 1.125 0 0 1 3 16.811V8.688ZM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062a1.125 1.125 0 0 1-1.683-.977V8.688Z" />
          </svg>
        </button>

        <button
          onClick={onRestart}
          className="p-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-muted hover:text-foreground transition-colors ml-1"
          aria-label="Restart"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>

      {/* Speed selector + secondary actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Speed */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted font-medium mr-1">Speed</span>
          <div className="flex bg-surface-elevated rounded-lg p-0.5">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                  playbackSpeed === speed
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {hasComparison && (
            <>
              <button
                onClick={() => setSyncSetupMode("runA")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
                </svg>
                Adjust Sync
              </button>
              <button
                onClick={() => setOverlayMode(!overlayMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  overlayMode
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                Overlay
              </button>
              <button
                onClick={swapRuns}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                Swap A/B
              </button>
              <button
                onClick={() => setShowOffsets(!showOffsets)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showOffsets
                    ? "bg-surface-hover text-foreground"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                Fine-tune
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapsible offset adjustment */}
      {hasComparison && showOffsets && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
          {(["A", "B"] as const).map((lbl) => (
            <div
              key={lbl}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                lbl === "A"
                  ? "bg-run-a/5 border border-run-a/15"
                  : "bg-accent/5 border border-accent/15"
              }`}
            >
              <span className={`text-xs font-mono font-bold ${lbl === "A" ? "text-run-a" : "text-accent"}`}>
                Run {lbl}
              </span>
              <div className="flex items-center gap-1">
                {[
                  { label: "-1s", delta: -1 },
                  { label: "-0.1", delta: -0.1 },
                  { label: "+0.1", delta: 0.1 },
                  { label: "+1s", delta: 1 },
                ].map(({ label: btnLabel, delta }) => (
                  <button
                    key={btnLabel}
                    onClick={() => onAdjustOffset(lbl, delta)}
                    className="px-2 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-xs font-mono text-muted hover:text-foreground transition-colors"
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
