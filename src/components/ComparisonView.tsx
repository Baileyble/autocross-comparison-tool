"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { VideoPlayer } from "./VideoPlayer";
import { PlaybackControls } from "./PlaybackControls";
import { AnnotationPanel } from "./AnnotationPanel";

export function ComparisonView() {
  const session = useStore((s) => s.session);
  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const updateRun = useStore((s) => s.updateRun);
  const playerStates = useStore((s) => s.playerStates);
  const overlayMode = useStore((s) => s.overlayMode);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const setSyncSetupMode = useStore((s) => s.setSyncSetupMode);

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
      setSyncSetupMode={setSyncSetupMode}
    />
  );
}

function ComparisonViewInner({
  runA,
  runB,
  stateA,
  stateB,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  updateRun,
  overlayMode,
  setShowGarage,
  setSyncSetupMode,
}: {
  runA: NonNullable<ReturnType<typeof useStore.getState>["session"]["runs"][number]>;
  runB: NonNullable<ReturnType<typeof useStore.getState>["session"]["runs"][number]>;
  stateA: ReturnType<typeof useStore.getState>["playerStates"][string];
  stateB: ReturnType<typeof useStore.getState>["playerStates"][string];
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  playbackSpeed: number;
  updateRun: (id: string, updates: Record<string, unknown>) => void;
  overlayMode: boolean;
  setShowGarage: (s: boolean) => void;
  setSyncSetupMode: (mode: "off" | "runA" | "runB") => void;
}) {
  const [showAnnotations, setShowAnnotations] = useState(false);

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
    <div className="flex-1 flex flex-col h-full min-h-0 animate-fade-in">
      {/* Video area — immersive, takes most of the screen */}
      <div
        className={
          overlayMode
            ? "flex-1 min-h-0 relative"
            : "cockpit-videos flex-1 min-h-0 p-1"
        }
      >
        {overlayMode ? (
          <>
            <div className="absolute inset-0 z-10">
              <VideoPlayer run={runA} label="A" />
            </div>
            <div className="absolute inset-0 z-20 opacity-50 mix-blend-screen">
              <VideoPlayer run={runB} label="B" />
            </div>
          </>
        ) : (
          <>
            <VideoPlayer run={runA} label="A" />
            <VideoPlayer run={runB} label="B" />
          </>
        )}
      </div>

      {/* Floating controls — bottom */}
      <div className="px-2 pb-2 pt-1 sm:px-4 sm:pb-3">
        {/* Adjust Sync quick button */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <button
            onClick={() => setSyncSetupMode("runA")}
            className="text-[10px] text-muted hover:text-accent transition-colors px-2 py-1 rounded-lg hover:bg-surface-hover"
          >
            Adjust Sync
          </button>
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`text-[10px] transition-colors px-2 py-1 rounded-lg ${
              showAnnotations ? "text-accent bg-accent/10" : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            Markers
          </button>
        </div>

        <PlaybackControls
          onPlayPause={handlePlayPause}
          onRestart={handleRestart}
          onSeek={handleSeek}
          onAdjustOffset={handleAdjustOffset}
        />

        {/* Annotation panels — collapsible */}
        {showAnnotations && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 animate-slide-up">
            <div className="glass rounded-xl border border-accent/10 p-2.5">
              <AnnotationPanel run={runA} currentTime={stateA?.currentTime ?? 0} />
            </div>
            <div className="glass rounded-xl border border-teal/10 p-2.5">
              <AnnotationPanel run={runB} currentTime={stateB?.currentTime ?? 0} />
            </div>
          </div>
        )}

        {/* Keyboard shortcut hints — desktop only */}
        <div className="hidden sm:flex items-center justify-center gap-4 text-[9px] text-subtle/60 py-1 mt-1">
          <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted/60 font-mono">Space</kbd> Play</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted/60 font-mono">R</kbd> Restart</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted/60 font-mono">J/L</kbd> Seek</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted/60 font-mono">[ ]</kbd> A offset</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface-elevated text-muted/60 font-mono">; &apos;</kbd> B offset</span>
        </div>
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
