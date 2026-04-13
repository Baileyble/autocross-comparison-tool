"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { formatTime, loadYouTubeAPI } from "@/lib/youtube";

export function SyncSetup() {
  const session = useStore((s) => s.session);
  const syncSetupMode = useStore((s) => s.syncSetupMode);
  const setSyncSetupMode = useStore((s) => s.setSyncSetupMode);
  const updateRun = useStore((s) => s.updateRun);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const saveToHistory = useStore((s) => s.saveToHistory);

  if (!session.activeComparison || syncSetupMode === "off") return null;

  const runA = session.runs.find((r) => r.id === session.activeComparison![0]);
  const runB = session.runs.find((r) => r.id === session.activeComparison![1]);
  if (!runA || !runB) return null;

  const activeRun = syncSetupMode === "runA" ? runA : runB;
  const label = syncSetupMode === "runA" ? "A" : "B";
  const step = syncSetupMode === "runA" ? 1 : 2;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
      <SyncSetupInner
        key={activeRun.id}
        run={activeRun}
        label={label}
        step={step}
        onSetLaunchPoint={(time) => {
          updateRun(activeRun.id, { startOffset: time });
          // Auto-save to localStorage so sync persists
          setTimeout(() => saveToHistory(), 100);
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
  step,
  onSetLaunchPoint,
  onSkip,
  onCancel,
}: {
  run: { id: string; videoId: string; name: string; startOffset: number };
  label: string;
  step: number;
  onSetLaunchPoint: (time: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const stableId = useRef(`sync-player-${run.id}-${Math.random().toString(36).slice(2, 8)}`);
  const containerId = stableId.current;
  const playerRef = useRef<YT.Player | null>(null);
  const [currentTime, setCurrentTime] = useState(run.startOffset);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBlue = label === "A";
  const accentColor = isBlue ? "text-gulf-blue" : "text-gulf-orange";
  const accentBg = isBlue ? "bg-gulf-blue" : "bg-gulf-orange";

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadYouTubeAPI();
        if (cancelled) return;

        // Small delay to ensure DOM element exists
        await new Promise((r) => setTimeout(r, 100));
        if (cancelled) return;

        const el = document.getElementById(containerId);
        if (!el) return;

        const player = new window.YT.Player(containerId, {
          videoId: run.videoId,
          playerVars: {
            autoplay: 0,
            controls: 1, // IMPORTANT: Enable native YouTube controls
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            fs: 0,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              playerRef.current = player;
              setReady(true);
              try {
                const dur = player.getDuration();
                if (dur > 0) setDuration(dur);
                player.seekTo(run.startOffset, true);
              } catch {}
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (cancelled) return;
              setIsPlaying(event.data === 1);
              // Update duration once we know it
              try {
                const dur = player.getDuration();
                if (dur > 0) setDuration(dur);
              } catch {}
            },
          },
        });
      } catch (e) {
        console.error("SyncSetup player init failed:", e);
      }
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
  }, [run.videoId, containerId, run.startOffset]);

  // Poll time
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (ready) {
      intervalRef.current = setInterval(() => {
        try {
          const t = playerRef.current?.getCurrentTime() ?? 0;
          setCurrentTime(t);
          const dur = playerRef.current?.getDuration() ?? 0;
          if (dur > 0) setDuration(dur);
        } catch {}
      }, 150);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ready]);

  const seekTo = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, duration || 99999));
    setCurrentTime(clamped);
    try {
      playerRef.current?.seekTo(clamped, true);
    } catch {}
  }, [duration]);

  const handleStep = useCallback((delta: number) => {
    const newTime = Math.max(0, currentTime + delta);
    seekTo(newTime);
    // Pause when stepping for precision
    try { playerRef.current?.pauseVideo(); } catch {}
    setIsPlaying(false);
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

  return (
    <>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/5 shrink-0">
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
          <div className="text-[10px] text-muted uppercase tracking-widest">Step {step} of 2</div>
          <div className={`font-display text-xl ${accentColor}`}>
            SET LAUNCH — RUN {label}
          </div>
        </div>
        <button
          onClick={onSkip}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
        {/* Run name */}
        <div className={`text-sm ${accentColor} font-medium`}>
          {run.name}
        </div>

        {/* Video player — using YouTube native controls */}
        <div className="sync-video-container w-full">
          <div className="sync-player-wrap">
            <div id={containerId} />
          </div>
        </div>

        {/* Time display */}
        <div className="text-center">
          <div className={`font-mono text-4xl sm:text-5xl font-bold tracking-tight ${accentColor}`}>
            {formatTime(currentTime)}
          </div>
          {run.startOffset > 0 && (
            <div className="text-xs text-muted mt-1">
              Current offset: {run.startOffset.toFixed(1)}s
            </div>
          )}
        </div>

        {/* Scrub bar */}
        {duration > 0 && (
          <div className="w-full max-w-lg px-4">
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] font-mono text-subtle mt-1">
              <span>0:00.0</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Step buttons + play/pause */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => handleStep(-1)}
            className="px-4 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground font-mono text-sm font-medium transition-colors btn-tactile"
          >
            -1s
          </button>
          <button
            onClick={() => handleStep(-0.1)}
            className="px-4 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground font-mono text-sm font-medium transition-colors btn-tactile"
          >
            -0.1s
          </button>
          <button
            onClick={togglePlay}
            className={`px-5 py-3 rounded-xl font-mono text-sm font-medium transition-colors btn-tactile ${
              isPlaying
                ? `${isBlue ? "bg-gulf-blue/20 text-gulf-blue border border-gulf-blue/30" : "bg-gulf-orange/20 text-gulf-orange border border-gulf-orange/30"}`
                : "bg-surface-elevated hover:bg-surface-hover text-foreground"
            }`}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => handleStep(0.1)}
            className="px-4 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground font-mono text-sm font-medium transition-colors btn-tactile"
          >
            +0.1s
          </button>
          <button
            onClick={() => handleStep(1)}
            className="px-4 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground font-mono text-sm font-medium transition-colors btn-tactile"
          >
            +1s
          </button>
        </div>

        {/* Set launch point button */}
        <button
          onClick={() => onSetLaunchPoint(currentTime)}
          className={`w-full max-w-lg py-4 rounded-xl ${accentBg} text-white font-display text-2xl tracking-wide uppercase transition-all btn-tactile glow-accent active:scale-[0.98]`}
        >
          SET LAUNCH POINT — {formatTime(currentTime)}
        </button>

        <p className="text-xs text-muted text-center max-w-sm">
          Use YouTube&apos;s controls or the step buttons to find the exact moment the car launches, then set it as the start point.
        </p>
      </div>
    </>
  );
}
