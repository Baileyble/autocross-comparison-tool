"use client";

import { useCallback, useMemo } from "react";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/youtube";
import type { Run, AnnotationColor } from "@/types";

interface VideoPlayerProps {
  run: Run;
  label: "A" | "B";
}

const ANNOTATION_DOTS: Record<AnnotationColor, string> = {
  red: "bg-gulf-orange",
  amber: "bg-gulf-orange",
  teal: "bg-gulf-blue",
  white: "bg-foreground",
};

export function VideoPlayer({ run, label }: VideoPlayerProps) {
  const setPlayerState = useStore((s) => s.setPlayerState);
  const playerState = useStore((s) => s.playerStates[run.id]);

  const containerId = `yt-player-${run.id}`;
  const isBlue = label === "A";

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

  const { status } = useYouTubePlayer({
    videoId: run.videoId,
    startOffset: run.startOffset,
    containerId,
    onTimeUpdate,
    onStateChange,
  });

  const elapsed = playerState?.elapsed ?? 0;
  const currentTime = playerState?.currentTime ?? 0;

  const sortedAnnotations = useMemo(
    () => [...run.annotations].sort((a, b) => a.time - b.time),
    [run.annotations]
  );

  return (
    <div className={`relative rounded-xl overflow-hidden border ${isBlue ? "border-gulf-blue/20" : "border-gulf-orange/20"} bg-surface`}>
      {/* Label badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span
          className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
            isBlue
              ? "bg-gulf-blue/15 text-gulf-blue border-gulf-blue/30"
              : "bg-gulf-orange/15 text-gulf-orange border-gulf-orange/30"
          }`}
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
              ? "bg-gulf-blue/20 text-gulf-blue"
              : status === "loading"
              ? "bg-gulf-orange/20 text-gulf-orange animate-pulse-live"
              : status === "error"
              ? "bg-red-500/20 text-red-400"
              : "bg-surface-elevated text-muted"
          }`}
        >
          {status === "playing" ? "LIVE" : status.toUpperCase()}
        </span>
      </div>

      {/* Video container */}
      <div className="video-wrapper">
        <div id={containerId} />
      </div>

      {/* Bottom info bar */}
      <div className="px-3 py-2 flex items-center justify-between bg-surface-elevated/50 border-t border-foreground/5">
        <div className="flex items-center gap-3">
          <div className={`font-mono text-lg font-bold tracking-tight ${isBlue ? "text-gulf-blue" : "text-gulf-orange"}`}>
            {formatTime(elapsed)}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted uppercase tracking-wider">offset</span>
            <span className="font-mono text-xs text-subtle">
              {run.startOffset.toFixed(1)}s
            </span>
          </div>
        </div>

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

        <div className="font-mono text-xs text-subtle">
          {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
}
