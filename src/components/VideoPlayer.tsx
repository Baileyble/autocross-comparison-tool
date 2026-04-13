"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/youtube";
import type { Run, AnnotationColor } from "@/types";

interface VideoPlayerProps {
  run: Run;
  label: "A" | "B";
  onTapSync?: (time: number) => void;
}

const ANNOTATION_DOTS: Record<AnnotationColor, string> = {
  red: "bg-muted",
  amber: "bg-muted",
  teal: "bg-muted",
  white: "bg-foreground",
};

export function VideoPlayer({ run, label, onTapSync }: VideoPlayerProps) {
  const setPlayerState = useStore((s) => s.setPlayerState);
  const playerState = useStore((s) => s.playerStates[run.id]);
  const tapSyncMode = useStore((s) => s.tapSyncMode);
  const setTapSyncMode = useStore((s) => s.setTapSyncMode);
  const updateRun = useStore((s) => s.updateRun);

  const containerId = `yt-player-${run.id}`;

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

  const { status, getCurrentTime, getDuration } = useYouTubePlayer({
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

  const isTapTarget = (tapSyncMode === "runA" && label === "A") || (tapSyncMode === "runB" && label === "B");
  const elapsed = playerState?.elapsed ?? 0;
  const currentTime = playerState?.currentTime ?? 0;

  const handleTapSync = useCallback(() => {
    if (isTapTarget) {
      const time = getCurrentTime();
      updateRun(run.id, { startOffset: time });
      setTapSyncMode("off");
      onTapSync?.(time);
    }
  }, [isTapTarget, getCurrentTime, updateRun, run.id, setTapSyncMode, onTapSync]);

  // Sort annotations by time
  const sortedAnnotations = useMemo(
    () => [...run.annotations].sort((a, b) => a.time - b.time),
    [run.annotations]
  );

  return (
    <div className="relative rounded-lg overflow-hidden border border-surface-elevated bg-surface">
      {/* Label badge */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
        <span className="bg-surface-elevated/90 text-muted text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border border-subtle/20">
          {label}
        </span>
        <span className="text-[10px] text-subtle truncate max-w-[100px] sm:max-w-[160px]">
          {run.name}
        </span>
      </div>

      {/* Status indicator */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
            status === "playing"
              ? "bg-surface-elevated/90 text-muted"
              : status === "loading"
              ? "bg-surface-elevated/90 text-subtle animate-pulse-live"
              : status === "error"
              ? "bg-surface-elevated/90 text-subtle"
              : "bg-surface-elevated/90 text-subtle"
          }`}
        >
          {status === "playing" ? "LIVE" : status.toUpperCase()}
        </span>
      </div>

      {/* Video container */}
      <div
        className={`video-wrapper ${isTapTarget ? "ring-1 ring-muted ring-offset-1 ring-offset-background cursor-pointer" : ""}`}
        onClick={isTapTarget ? handleTapSync : undefined}
      >
        <div id={containerId} />
        {/* Tap-to-sync overlay */}
        {isTapTarget && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 pointer-events-none">
            <div className="text-center animate-slide-up">
              <div className="text-foreground font-mono text-sm font-medium tracking-wide uppercase mb-1">Tap at launch</div>
              <div className="text-muted text-xs">Tap when the car starts moving</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="px-3 py-1.5 flex items-center justify-between bg-surface border-t border-surface-elevated">
        <div className="flex items-center gap-3">
          {/* Elapsed time */}
          <div className="font-mono text-sm font-medium tracking-tight text-foreground">
            {formatTime(elapsed)}
          </div>
          {/* Offset badge */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-subtle uppercase tracking-wider">offset</span>
            <span className="font-mono text-[10px] text-subtle">
              {run.startOffset.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Annotations dots */}
        {sortedAnnotations.length > 0 && (
          <div className="flex items-center gap-1">
            {sortedAnnotations.slice(0, 5).map((ann) => (
              <div
                key={ann.id}
                className={`w-2 h-2 rounded-full ${ANNOTATION_DOTS[ann.color]}`}
                title={`${ann.label} @ ${formatTime(ann.time)}`}
              />
            ))}
            {sortedAnnotations.length > 5 && (
              <span className="text-[10px] text-muted">+{sortedAnnotations.length - 5}</span>
            )}
          </div>
        )}

        {/* Video timestamp */}
        <div className="font-mono text-xs text-subtle">
          {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
}
