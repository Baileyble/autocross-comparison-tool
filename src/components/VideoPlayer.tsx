"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/youtube";
import type { Run } from "@/types";

interface VideoPlayerProps {
  run: Run;
  label: "A" | "B";
}

const LABEL_COLORS: Record<string, { text: string; border: string }> = {
  A: { text: "text-accent", border: "border-accent/20" },
  B: { text: "text-teal", border: "border-teal/20" },
};

export function VideoPlayer({ run, label }: VideoPlayerProps) {
  const setPlayerState = useStore((s) => s.setPlayerState);
  const playerState = useStore((s) => s.playerStates[run.id]);

  const containerId = `yt-player-${run.id}`;
  const colors = LABEL_COLORS[label];

  const onTimeUpdate = useCallback(
    (time: number) => {
      setPlayerState(run.id, {
        currentTime: time,
        elapsed: Math.max(0, time - run.startOffset),
      });
    },
    [run.id, run.startOffset, setPlayerState]
  );

  const onStateChange = useCallback(
    (status: "idle" | "loading" | "ready" | "playing" | "paused" | "error") => {
      setPlayerState(run.id, { status });
    },
    [run.id, setPlayerState]
  );

  const { status, getDuration } = useYouTubePlayer({
    videoId: run.videoId,
    startOffset: run.startOffset,
    containerId,
    onTimeUpdate,
    onStateChange,
  });

  useEffect(() => {
    const duration = getDuration();
    if (duration > 0) {
      setPlayerState(run.id, { duration });
    }
  }, [status, getDuration, run.id, setPlayerState]);

  const elapsed = playerState?.elapsed ?? 0;

  return (
    <div className={`cockpit-video-slot ${colors.border} border`}>
      {/* Label badge — tiny, top-left */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
        <span className={`${colors.text} text-[10px] font-bold font-mono px-1.5 py-0.5 rounded glass`}>
          {label}
        </span>
        <span className="text-[10px] text-white/50 truncate max-w-[100px] sm:max-w-[160px] hidden sm:inline">
          {run.name}
        </span>
      </div>

      {/* Status — top-right, tiny */}
      {status === "loading" && (
        <div className="absolute top-2 right-2 z-10">
          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber/20 text-amber animate-pulse-live">
            Loading
          </span>
        </div>
      )}

      {/* Video container */}
      <div className="video-wrapper">
        <div id={containerId} />
      </div>

      {/* Elapsed time overlay — bottom-left, directly on video */}
      <div className="video-time-overlay">
        <span className={colors.text}>{formatTime(elapsed)}</span>
      </div>

      {/* Offset — bottom-right overlay */}
      {run.startOffset > 0 && (
        <div className="absolute bottom-2 right-2 z-10 font-mono text-[10px] text-white/40 pointer-events-none">
          @{run.startOffset.toFixed(1)}s
        </div>
      )}
    </div>
  );
}
