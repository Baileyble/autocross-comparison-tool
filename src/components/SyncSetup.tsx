"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { formatTime, loadYouTubeAPI } from "@/lib/youtube";
import type { Run } from "@/types";

export function SyncSetup() {
  const session = useStore((s) => s.session);
  const syncSetupMode = useStore((s) => s.syncSetupMode);
  const setSyncSetupMode = useStore((s) => s.setSyncSetupMode);
  const updateRun = useStore((s) => s.updateRun);
  const setShowGarage = useStore((s) => s.setShowGarage);

  if (!session.activeComparison || syncSetupMode === "off") return null;

  const runA = session.runs.find((r) => r.id === session.activeComparison![0]);
  const runB = session.runs.find((r) => r.id === session.activeComparison![1]);

  if (!runA || !runB) return null;

  const activeRun = syncSetupMode === "runA" ? runA : runB;
  const label = syncSetupMode === "runA" ? "A" : "B";
  const stepLabel = syncSetupMode === "runA" ? "Step 1 of 2" : "Step 2 of 2";

  return (
    <div className="sync-setup-view animate-fade-in">
      <SyncSetupInner
        key={activeRun.id}
        run={activeRun}
        label={label}
        stepLabel={stepLabel}
        syncSetupMode={syncSetupMode}
        onSetLaunchPoint={(time) => {
          updateRun(activeRun.id, { startOffset: time });
          if (syncSetupMode === "runA") {
            setSyncSetupMode("runB");
          } else {
            setSyncSetupMode("off");
          }
        }}
        onSkip={() => {
          if (syncSetupMode === "runA") {
            setSyncSetupMode("runB");
          } else {
            setSyncSetupMode("off");
          }
        }}
        onCancel={() => {
          setSyncSetupMode("off");
          setShowGarage(true);
        }}
      />
    </div>
  );
}

function SyncSetupInner({
  run,
  label,
  stepLabel,
  syncSetupMode,
  onSetLaunchPoint,
  onSkip,
  onCancel,
}: {
  run: Run;
  label: string;
  stepLabel: string;
  syncSetupMode: string;
  onSetLaunchPoint: (time: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const containerId = `sync-player-${run.id}`;
  const playerRef = useRef<YT.Player | null>(null);
  const [currentTime, setCurrentTime] = useState(run.startOffset);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize the player
  useEffect(() => {
    let cancelled = false;

    async function init() {
      await loadYouTubeAPI();
      if (cancelled) return;

      const player = new window.YT.Player(containerId, {
        videoId: run.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          start: Math.floor(run.startOffset),
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = player;
            setReady(true);
            try {
              const dur = player.getDuration();
              if (dur > 0) setDuration(dur);
              // Seek to the current startOffset
              player.seekTo(run.startOffset, true);
              player.pauseVideo();
            } catch {}
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (cancelled) return;
            if (event.data === 1) {
              setIsPlaying(true);
            } else {
              setIsPlaying(false);
            }
          },
        },
      });
    }

    init();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [run.videoId, run.startOffset, containerId]);

  // Poll current time when playing
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && playerRef.current) {
      intervalRef.current = setInterval(() => {
        try {
          const t = playerRef.current?.getCurrentTime() ?? 0;
          setCurrentTime(t);
        } catch {}
      }, 100);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, duration || 9999));
    setCurrentTime(clamped);
    try {
      playerRef.current?.seekTo(clamped, true);
      playerRef.current?.pauseVideo();
    } catch {}
    setIsPlaying(false);
  }, [duration]);

  const handleStep = useCallback((delta: number) => {
    const newTime = Math.max(0, currentTime + delta);
    seekTo(newTime);
  }, [currentTime, seekTo]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch {}
  }, [isPlaying]);

  const accentColor = label === "A" ? "text-accent" : "text-teal";
  const accentBg = label === "A" ? "bg-accent" : "bg-teal";
  const accentBorder = label === "A" ? "border-accent/30" : "border-teal/30";

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Cancel
        </button>
        <div className="text-center">
          <div className="text-[10px] text-muted uppercase tracking-widest">{stepLabel}</div>
          <div className={`font-display text-sm font-bold ${accentColor}`}>
            Set Launch — Run {label}
          </div>
        </div>
        <button
          onClick={onSkip}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Video — large, full width */}
      <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center">
        <div className="w-full h-full max-h-[60vh]">
          <div className="video-wrapper">
            <div id={containerId} />
          </div>
        </div>

        {/* Run label overlay */}
        <div className={`absolute top-3 left-3 z-10 ${accentColor} font-mono text-xs font-bold px-2 py-0.5 rounded glass`}>
          RUN {label}: {run.name}
        </div>

        {/* Play/pause overlay button */}
        {ready && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 z-5 flex items-center justify-center group"
          >
            {!isPlaying && (
              <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-black/70 transition-colors">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </button>
        )}
      </div>

      {/* Controls below video */}
      <div className="px-4 py-4 space-y-4 glass-strong border-t border-white/5">
        {/* Current time display */}
        <div className="text-center">
          <div className="font-mono text-4xl font-bold tracking-tight">
            <span className={accentColor}>{formatTime(currentTime)}</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {run.startOffset > 0 && (
              <span>Current offset: {run.startOffset.toFixed(1)}s</span>
            )}
          </div>
        </div>

        {/* Scrub bar */}
        <div className="sync-scrub px-2">
          <input
            type="range"
            min={0}
            max={duration || 300}
            step={0.1}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] font-mono text-subtle mt-1">
            <span>0:00.0</span>
            <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
          </div>
        </div>

        {/* Step buttons */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleStep(-1)}
            className="px-4 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground font-mono text-sm font-medium transition-colors"
          >
            -1s
          </button>
          <button
            onClick={() => handleStep(-0.1)}
            className="px-4 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground font-mono text-sm font-medium transition-colors"
          >
            -0.1s
          </button>
          <button
            onClick={togglePlay}
            className={`px-4 py-3 rounded-xl font-mono text-sm font-medium transition-colors ${
              isPlaying
                ? "bg-accent/20 text-accent border border-accent/30"
                : "bg-surface-elevated hover:bg-surface-hover text-foreground"
            }`}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => handleStep(0.1)}
            className="px-4 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground font-mono text-sm font-medium transition-colors"
          >
            +0.1s
          </button>
          <button
            onClick={() => handleStep(1)}
            className="px-4 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground font-mono text-sm font-medium transition-colors"
          >
            +1s
          </button>
        </div>

        {/* Set launch point button */}
        <button
          onClick={() => onSetLaunchPoint(currentTime)}
          className={`w-full py-4 rounded-xl ${accentBg} text-white font-display text-lg font-bold tracking-wide uppercase transition-all glow-accent active:scale-[0.98]`}
        >
          Set Launch Point — {formatTime(currentTime)}
        </button>
      </div>
    </div>
  );
}
