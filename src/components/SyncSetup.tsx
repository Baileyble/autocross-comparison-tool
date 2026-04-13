"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/youtube";
import type { Run } from "@/types";

export function SyncSetup() {
  const syncSetupMode = useStore((s) => s.syncSetupMode);
  const setSyncSetupMode = useStore((s) => s.setSyncSetupMode);
  const session = useStore((s) => s.session);
  const updateRun = useStore((s) => s.updateRun);
  const playerStates = useStore((s) => s.playerStates);

  const [seekTime, setSeekTime] = useState(0);
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<string>("");

  if (syncSetupMode === "off" || !session.activeComparison) return null;

  const runA = session.runs.find((r) => r.id === session.activeComparison![0]);
  const runB = session.runs.find((r) => r.id === session.activeComparison![1]);
  if (!runA || !runB) return null;

  const currentRun = syncSetupMode === "runA" ? runA : runB;
  const label = syncSetupMode === "runA" ? "A" : "B";
  const color = syncSetupMode === "runA" ? "text-run-a" : "text-run-b";
  const bgColor = syncSetupMode === "runA" ? "bg-run-a" : "bg-run-b";

  return (
    <SyncSetupInner
      key={currentRun.id}
      run={currentRun}
      label={label}
      color={color}
      bgColor={bgColor}
      syncSetupMode={syncSetupMode}
      setSyncSetupMode={setSyncSetupMode}
      updateRun={updateRun}
      playerStates={playerStates}
    />
  );
}

function SyncSetupInner({
  run,
  label,
  color,
  bgColor,
  syncSetupMode,
  setSyncSetupMode,
  updateRun,
  playerStates,
}: {
  run: Run;
  label: string;
  color: string;
  bgColor: string;
  syncSetupMode: "runA" | "runB";
  setSyncSetupMode: (mode: "off" | "runA" | "runB") => void;
  updateRun: (id: string, updates: Partial<Run>) => void;
  playerStates: Record<string, { currentTime: number; duration: number }>;
}) {
  const [currentTime, setCurrentTime] = useState(run.startOffset);
  const [markedTime, setMarkedTime] = useState<number | null>(run.startOffset);
  const seekPlayerRef = useRef<YT.Player | null>(null);
  const containerId = `sync-player-${run.id}`;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const duration = playerStates[run.id]?.duration ?? 120;

  // Initialize a standalone player for sync setup
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Wait for YT API
      if (!window.YT || !window.YT.Player) {
        const { loadYouTubeAPI } = await import("@/lib/youtube");
        await loadYouTubeAPI();
      }
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
            seekPlayerRef.current = player;
            player.seekTo(run.startOffset, true);
            player.pauseVideo();
            setReady(true);
          },
        },
      });
    }

    init();

    return () => {
      cancelled = true;
      if (seekPlayerRef.current) {
        try { seekPlayerRef.current.destroy(); } catch {}
        seekPlayerRef.current = null;
      }
    };
  }, [run.videoId, run.id, containerId, run.startOffset]);

  // Poll time from player
  useEffect(() => {
    if (!ready) return;
    intervalRef.current = setInterval(() => {
      if (seekPlayerRef.current) {
        try {
          const t = seekPlayerRef.current.getCurrentTime();
          setCurrentTime(t);
        } catch {}
      }
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ready]);

  const seekTo = useCallback((time: number) => {
    if (seekPlayerRef.current) {
      seekPlayerRef.current.seekTo(time, true);
      seekPlayerRef.current.pauseVideo();
      setCurrentTime(time);
    }
  }, []);

  const handleStep = useCallback(
    (delta: number) => {
      const newTime = Math.max(0, currentTime + delta);
      seekTo(newTime);
    },
    [currentTime, seekTo]
  );

  const handleMarkLaunch = useCallback(() => {
    setMarkedTime(currentTime);
    updateRun(run.id, { startOffset: currentTime });
  }, [currentTime, run.id, updateRun]);

  const handleNext = useCallback(() => {
    if (syncSetupMode === "runA") {
      setSyncSetupMode("runB");
    } else {
      setSyncSetupMode("off");
    }
  }, [syncSetupMode, setSyncSetupMode]);

  const handleRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = parseFloat(e.target.value);
      seekTo(t);
    },
    [seekTo]
  );

  return (
    <div className="sync-overlay flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${bgColor}`} />
            <div>
              <div className="section-label">Sync Setup</div>
              <h2 className="text-lg font-bold text-foreground">
                Set Launch Point for <span className={color}>Run {label}</span>
              </h2>
            </div>
          </div>
          <button
            onClick={() => setSyncSetupMode("off")}
            className="pw-btn text-muted hover:text-foreground"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        </div>

        {/* Video */}
        <div className="w-full rounded-lg overflow-hidden pw-border mb-4">
          <div className="video-wrapper">
            <div id={containerId} />
          </div>
        </div>

        {/* Large time display */}
        <div className="text-center mb-4">
          <div className="font-mono text-4xl font-bold text-foreground tracking-tight">
            {formatTime(currentTime)}
          </div>
          {markedTime !== null && (
            <div className="text-xs text-muted mt-1">
              Launch marked at <span className={`font-mono font-bold ${color}`}>{formatTime(markedTime)}</span>
            </div>
          )}
        </div>

        {/* Scrub bar */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 120}
            step={0.1}
            value={currentTime}
            onChange={handleRangeChange}
            className="w-full"
          />
        </div>

        {/* Frame-step buttons */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button onClick={() => handleStep(-1)} className="pw-btn bg-surface-elevated hover:bg-surface-hover font-mono text-sm">
            -1s
          </button>
          <button onClick={() => handleStep(-0.1)} className="pw-btn bg-surface-elevated hover:bg-surface-hover font-mono text-sm">
            -0.1s
          </button>
          <button onClick={() => handleStep(0.1)} className="pw-btn bg-surface-elevated hover:bg-surface-hover font-mono text-sm">
            +0.1s
          </button>
          <button onClick={() => handleStep(1)} className="pw-btn bg-surface-elevated hover:bg-surface-hover font-mono text-sm">
            +1s
          </button>
        </div>

        {/* Mark launch + next */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkLaunch}
            className="flex-1 py-3 rounded-lg bg-accent text-background font-bold text-sm uppercase tracking-wider hover:bg-accent-glow pw-transition"
          >
            Mark Launch Point
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-lg bg-surface-elevated text-foreground font-bold text-sm uppercase tracking-wider hover:bg-surface-hover pw-transition pw-border"
          >
            {syncSetupMode === "runA" ? "Next: Run B" : "Enter Comparison"}
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className={`w-2 h-2 rounded-full ${syncSetupMode === "runA" ? "bg-run-a" : "bg-muted"}`} />
          <div className={`w-2 h-2 rounded-full ${syncSetupMode === "runB" ? "bg-run-b" : "bg-muted"}`} />
        </div>
      </div>
    </div>
  );
}
