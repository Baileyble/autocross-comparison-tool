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

const LABEL_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  A: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/30", glow: "glow-accent" },
  B: { bg: "bg-teal/10", text: "text-teal", border: "border-teal/30", glow: "glow-teal" },
};

const ANNOTATION_DOTS: Record<AnnotationColor, string> = {
  red: "bg-accent",
  amber: "bg-amber",
  teal: "bg-teal",
  white: "bg-foreground",
};

export function VideoPlayer({ run, label, onTapSync }: VideoPlayerProps) {
  const setPlayerState = useStore((s) => s.setPlayerState);
  const playerState = useStore((s) => s.playerStates[run.id]);
  const tapSyncMode = useStore((s) => s.tapSyncMode);
  const setTapSyncMode = useStore((s) => s.setTapSyncMode);
  const updateRun = useStore((s) => s.updateRun);

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
    <div className={`relative rounded-xl overflow-hidden border ${colors.border} bg-surface`}>
      {/* Label badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span
          className={`${colors.bg} ${colors.text} text-xs font-bold font-mono px-2 py-0.5 rounded border ${colors.border}`}
        >
          RUN {label}
        </span>
        <span className="text-xs text-muted truncate max-w-[120px] sm:max-w-[200px]">
          {run.name}
        </span>
      </div>

      {/* Status indicator */}
      <div className="absolute top-3 right-3 z-10">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
            status === "playing"
              ? "bg-teal/20 text-teal"
              : status === "loading"
              ? "bg-amber/20 text-amber animate-pulse-live"
              : status === "error"
              ? "bg-accent/20 text-accent"
              : "bg-surface-elevated text-muted"
          }`}
        >
          {status === "playing" ? "LIVE" : status.toUpperCase()}
        </span>
      </div>

      {/* Video container */}
      <div
        className={`video-wrapper ${isTapTarget ? "ring-2 ring-amber ring-offset-2 ring-offset-background cursor-pointer" : ""}`}
        onClick={isTapTarget ? handleTapSync : undefined}
      >
        <div id={containerId} />
        {/* Tap-to-sync overlay */}
        {isTapTarget && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-none">
            <div className="text-center animate-slide-up">
              <div className="text-amber font-display text-2xl font-bold mb-1">TAP AT LAUNCH</div>
              <div className="text-amber/70 text-sm">Tap the video when the car starts moving</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="px-3 py-2 flex items-center justify-between bg-surface-elevated/50">
        <div className="flex items-center gap-3">
          {/* Elapsed time (big) */}
          <div className="font-mono text-lg font-bold tracking-tight">
            <span className={colors.text}>{formatTime(elapsed)}</span>
          </div>
          {/* Offset badge */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted uppercase tracking-wider">offset</span>
            <span className="font-mono text-xs text-subtle">
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
