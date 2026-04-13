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
      // Auto-save offset changes
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
    <div className="flex-1 flex flex-col gap-3 p-3 sm:p-4 animate-slide-up">
      <button
        onClick={() => setShowGarage(true)}
        className="self-start flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mb-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Garage
      </button>

      <div className={overlayMode ? "relative" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
        <div className={overlayMode ? "relative z-10" : ""}>
          <VideoPlayer run={runA} label="A" />
        </div>
        <div className={overlayMode ? "absolute inset-0 z-20 opacity-50 mix-blend-screen" : ""}>
          <VideoPlayer run={runB} label="B" />
        </div>
      </div>

      <PlaybackControls
        onPlayPause={handlePlayPause}
        onRestart={handleRestart}
        onSeek={handleSeek}
        onAdjustOffset={handleAdjustOffset}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass rounded-xl border border-gulf-blue/10 p-3">
          <AnnotationPanel run={runA} currentTime={stateA?.currentTime ?? 0} />
        </div>
        <div className="glass rounded-xl border border-gulf-orange/10 p-3">
          <AnnotationPanel run={runB} currentTime={stateB?.currentTime ?? 0} />
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-center gap-4 text-[10px] text-subtle py-2">
        <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted font-mono">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted font-mono">R</kbd> Restart</span>
        <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted font-mono">J/L</kbd> Seek ±5s</span>
        <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted font-mono">[ ]</kbd> Run A offset</span>
        <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted font-mono">; &apos;</kbd> Run B offset</span>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    __gridlinePlayers: YT.Player[];
  }
}
