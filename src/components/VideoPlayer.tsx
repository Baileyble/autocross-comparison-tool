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

const LABEL_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: "text-run-a", bg: "bg-run-a/10", border: "border-run-a/30" },
  B: { text: "text-run-b", bg: "bg-run-b/10", border: "border-run-b/30" },
};

export function VideoPlayer({ run, label }: VideoPlayerProps) {
  const setPlayerState = useStore((s) => s.setPlayerState);
  const playerState = useStore((s) => s.playerStates[run.id]);

  const containerId = `yt-player-${run.id}`;
  const styles = LABEL_STYLES[label];

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
  const currentTime = playerState?.currentTime ?? 0;

  return (
    <div className="relative h-full flex flex-col">
      {/* Label badge — compact */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
        <span
          className={`${styles.bg} ${styles.text} text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${styles.border}`}
        >
          {label}
        </span>
        <span className="text-[10px] text-muted truncate max-w-[100px]">
          {run.name}
        </span>
      </div>

      {/* Status indicator */}
      <div className="absolute top-2 right-2 z-10">
        <div
          className={`w-2 h-2 rounded-full ${
            status === "playing"
              ? "status-green"
              : status === "loading"
              ? "status-amber animate-pulse"
              : status === "error"
              ? "status-red"
              : "bg-subtle"
          }`}
          title={status}
        />
      </div>

      {/* Video container */}
      <div className="video-wrapper flex-1">
        <div id={containerId} />
      </div>

      {/* Bottom info bar — data-dense, compact */}
      <div className="px-2 py-1 flex items-center justify-between bg-surface pw-border-t">
        <div className={`font-mono text-sm font-bold ${styles.text}`}>
          {formatTime(elapsed)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-subtle font-mono">
            off:{run.startOffset.toFixed(1)}s
          </span>
          <span className="text-[9px] text-subtle font-mono">
            @{formatTime(currentTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
