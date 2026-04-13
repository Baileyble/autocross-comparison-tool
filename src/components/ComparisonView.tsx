"use client";

import { useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import { VideoPlayer } from "./VideoPlayer";
import { PlaybackControls } from "./PlaybackControls";
import { AnnotationPanel } from "./AnnotationPanel";
import type { Run, PlayerState } from "@/types";

export function ComparisonView() {
  const session = useStore((s) => s.session);
  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const updateRun = useStore((s) => s.updateRun);
  const playerStates = useStore((s) => s.playerStates);
  const overlayMode = useStore((s) => s.overlayMode);
  const setShowGarage = useStore((s) => s.setShowGarage);

  if (!session.activeComparison) return null;

  const runA = session.runs.find((r) => r.id === session.activeComparison![0]);
  const runB = session.runs.find((r) => r.id === session.activeComparison![1]);

  if (!runA || !runB) return null;

  const stateA = playerStates[runA.id];
  const stateB = playerStates[runB.id];

  return (
    <ComparisonViewInner
      runA={runA}
      runB={runB}
      stateA={stateA}
      stateB={stateB}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      playbackSpeed={playbackSpeed}
      updateRun={updateRun}
      overlayMode={overlayMode}
      setShowGarage={setShowGarage}
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
  setShowGarage,
  stateA,
  stateB,
}: {
  runA: Run;
  runB: Run;
  stateA: PlayerState | undefined;
  stateB: PlayerState | undefined;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  playbackSpeed: number;
  updateRun: (id: string, updates: Partial<Run>) => void;
  overlayMode: boolean;
  setShowGarage: (s: boolean) => void;
}) {
  const handlePlayPause = useCallback(() => {
    const players = window.__gridlinePlayers;
    if (!players) return;

    if (isPlaying) {
      players.forEach((p) => { try { p.pauseVideo(); } catch {} });
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

  const saveToHistory = useStore((s) => s.saveToHistory);

  const handleAdjustOffset = useCallback(
    (label: "A" | "B", delta: number) => {
      const run = label === "A" ? runA : runB;
      const newOffset = Math.max(0, run.startOffset + delta);
      updateRun(run.id, { startOffset: newOffset });
      setTimeout(() => saveToHistory(), 100);
    },
    [runA, runB, updateRun, saveToHistory]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": e.preventDefault(); handlePlayPause(); break;
        case "r": case "R": handleRestart(); break;
        case "j": case "J": handleSeek(-5); break;
        case "l": case "L": handleSeek(5); break;
        case "[": handleAdjustOffset("A", e.shiftKey ? -1 : -0.1); break;
        case "]": handleAdjustOffset("A", e.shiftKey ? 1 : 0.1); break;
        case ";": handleAdjustOffset("B", e.shiftKey ? -1 : -0.1); break;
        case "'": handleAdjustOffset("B", e.shiftKey ? 1 : 0.1); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePlayPause, handleRestart, handleSeek, handleAdjustOffset]);

  // Sync playback speed
  useEffect(() => {
    const players = window.__gridlinePlayers;
    if (!players) return;
    players.forEach((p) => { try { p.setPlaybackRate(playbackSpeed); } catch {} });
  }, [playbackSpeed]);

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 sm:p-6 animate-slide-up max-w-7xl mx-auto w-full">
      {/* Video grid */}
      <div className={overlayMode ? "relative" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
        <div className={overlayMode ? "relative z-10" : ""}>
          <VideoPlayer run={runA} label="A" />
        </div>
        <div className={overlayMode ? "absolute inset-0 z-20 opacity-50 mix-blend-screen" : ""}>
          <VideoPlayer run={runB} label="B" />
        </div>
      </div>

      {/* Playback controls */}
      <PlaybackControls
        onPlayPause={handlePlayPause}
        onRestart={handleRestart}
        onSeek={handleSeek}
        onAdjustOffset={handleAdjustOffset}
      />

      {/* Annotation panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 border-t-2 border-t-run-a/30">
          <AnnotationPanel run={runA} currentTime={stateA?.currentTime ?? 0} />
        </div>
        <div className="card p-4 border-t-2 border-t-accent/30">
          <AnnotationPanel run={runB} currentTime={stateB?.currentTime ?? 0} />
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden sm:flex items-center justify-center gap-4 text-[11px] text-subtle py-2">
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-muted font-mono text-[10px]">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-muted font-mono text-[10px]">R</kbd> Restart</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-muted font-mono text-[10px]">J/L</kbd> Seek</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-muted font-mono text-[10px]">[ ]</kbd> Offset A</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-muted font-mono text-[10px]">; &apos;</kbd> Offset B</span>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    __gridlinePlayers: YT.Player[];
  }
}
