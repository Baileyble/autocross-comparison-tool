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
  A: { bg: "bg-gulf-blue/10", text: "text-gulf-blue", border: "border-gulf-blue/30", glow: "glow-gulf-blue" },
  B: { bg: "bg-gulf-orange/10", text: "text-gulf-orange", border: "border-gulf-orange/30", glow: "glow-gulf-orange" },
};

const ANNOTATION_DOTS: Record<AnnotationColor, string> = {
  red: "bg-gulf-orange",
  amber: "bg-gulf-orange",
  teal: "bg-gulf-blue",
  white: "bg-cream",
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
      {/* Label badge — analog gauge style */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span
          className={`${colors.bg} ${colors.text} text-xs font-bold font-mono px-2.5 py-0.5 rounded-full border ${colors.border}`}
        >
          RUN {label}
        </span>
        <span className="text-xs text-cream/60 truncate max-w-[120px] sm:max-w-[200px]">
          {run.name}
        </span>
      </div>

      {/* Status indicator — analog gauge readout */}
      <div className="absolute top-3 right-3 z-10">
        <span
          className={`badge-gauge ${
            status === "playing"
              ? "bg-gulf-blue/20 text-gulf-blue border-gulf-blue/30"
              : status === "loading"
              ? "bg-gulf-orange/20 text-gulf-orange border-gulf-orange/30 animate-pulse-live"
              : status === "error"
              ? "bg-gulf-orange/20 text-gulf-orange border-gulf-orange/30"
              : "bg-surface-elevated text-muted border-cream/10"
          }`}
        >
          {status === "playing" ? "LIVE" : status.toUpperCase()}
        </span>
      </div>

      {/* Video container */}
      <div
        className={`video-wrapper ${isTapTarget ? "ring-2 ring-gulf-orange ring-offset-2 ring-offset-background cursor-pointer" : ""}`}
        onClick={isTapTarget ? handleTapSync : undefined}
      >
        <div id={containerId} />
        {/* Tap-to-sync overlay */}
        {isTapTarget && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-none">
            <div className="text-center animate-slide-up">
              <div className="text-gulf-orange font-display text-3xl font-bold mb-1">TAP AT LAUNCH</div>
              <div className="text-gulf-orange/70 text-sm">Tap the video when the car starts moving</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom info bar — warm tinted */}
      <div className="px-3 py-2 flex items-center justify-between bg-surface-elevated/60 border-t border-cream/5">
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
