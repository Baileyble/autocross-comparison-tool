"use client";

import { useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import { VideoPlayer } from "./VideoPlayer";
import { PlaybackControls } from "./PlaybackControls";
import { Timeline } from "./Timeline";

export function ComparisonView() {
  const session = useStore((s) => s.session);
  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const updateRun = useStore((s) => s.updateRun);
  const overlayMode = useStore((s) => s.overlayMode);

  if (!session.activeComparison) return null;

  const runA = session.runs.find((r) => r.id === session.activeComparison![0]);
  const runB = session.runs.find((r) => r.id === session.activeComparison![1]);

  if (!runA || !runB) return null;

  return (
    <ComparisonViewInner
      runA={runA}
      runB={runB}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      playbackSpeed={playbackSpeed}
      updateRun={updateRun}
      overlayMode={overlayMode}
    />
  );
}

function ComparisonViewInner({
  runA,
  runB,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  updateRun,
  overlayMode,
}: {
  runA: NonNullable<ReturnType<typeof useStore.getState>["session"]["runs"][number]>;
  runB: NonNullable<ReturnType<typeof useStore.getState>["session"]["runs"][number]>;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  playbackSpeed: number;
  updateRun: (id: string, updates: Record<string, unknown>) => void;
  overlayMode: boolean;
}) {
  const handlePlayPause = useCallback(() => {
    const players = window.__gridlinePlayers;
    if (!players) return;

    if (isPlaying) {
      players.forEach((p) => {
        try { p.pauseVideo(); } catch {}
      });
      setIsPlaying(false);
    } else {
      players.forEach((p) => {
        try {
          p.setPlaybackRate(playbackSpeed);
          p.playVideo();
        } catch {}
      });
      setIsPlaying(true);
    }
  }, [isPlaying, setIsPlaying, playbackSpeed]);

  const handleRestart = useCallback(() => {
    const players = window.__gridlinePlayers;
    if (!players) return;

    setIsPlaying(false);
    const runs = [runA, runB];
    players.forEach((p, i) => {
      try {
        p.seekTo(runs[i]?.startOffset ?? 0, true);
        p.pauseVideo();
      } catch {}
    });
  }, [runA, runB, setIsPlaying]);

  const handleSeek = useCallback((delta: number) => {
    const players = window.__gridlinePlayers;
    if (!players) return;

    players.forEach((p) => {
      try {
        const current = p.getCurrentTime();
        p.seekTo(current + delta, true);
      } catch {}
    });
  }, []);

  const handleAdjustOffset = useCallback(
    (label: "A" | "B", delta: number) => {
      const run = label === "A" ? runA : runB;
      const newOffset = Math.max(0, run.startOffset + delta);
      updateRun(run.id, { startOffset: newOffset });
    },
    [runA, runB, updateRun]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "r":
        case "R":
          handleRestart();
          break;
        case "j":
        case "J":
          handleSeek(-5);
          break;
        case "l":
        case "L":
          handleSeek(5);
          break;
        case "[":
          handleAdjustOffset("A", e.shiftKey ? -1 : -0.1);
          break;
        case "]":
          handleAdjustOffset("A", e.shiftKey ? 1 : 0.1);
          break;
        case ";":
          handleAdjustOffset("B", e.shiftKey ? -1 : -0.1);
          break;
        case "'":
          handleAdjustOffset("B", e.shiftKey ? 1 : 0.1);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePlayPause, handleRestart, handleSeek, handleAdjustOffset]);

  // Sync playback speed
  useEffect(() => {
    const players = window.__gridlinePlayers;
    if (!players) return;
    players.forEach((p) => {
      try { p.setPlaybackRate(playbackSpeed); } catch {}
    });
  }, [playbackSpeed]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Video area — top 60% */}
      <div className="flex-[6] min-h-0">
        <div
          className={
            overlayMode
              ? "relative h-full"
              : "grid grid-cols-1 md:grid-cols-2 gap-px h-full bg-white/3"
          }
        >
          <div className={overlayMode ? "relative z-10 h-full" : "bg-background"}>
            <VideoPlayer run={runA} label="A" />
          </div>
          <div className={overlayMode ? "absolute inset-0 z-20 opacity-50 mix-blend-screen" : "bg-background"}>
            <VideoPlayer run={runB} label="B" />
          </div>
        </div>
      </div>

      {/* Unified Timeline — spans full width below videos */}
      <div className="pw-border-t">
        <Timeline runA={runA} runB={runB} />
      </div>

      {/* Compact transport controls strip */}
      <div className="pw-border-t">
        <PlaybackControls
          onPlayPause={handlePlayPause}
          onRestart={handleRestart}
          onSeek={handleSeek}
          onAdjustOffset={handleAdjustOffset}
        />
      </div>
    </div>
  );
}

// Global player registry for sync control
declare global {
  interface Window {
    __gridlinePlayers: YT.Player[];
  }
}
