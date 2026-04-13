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
  red: "bg-accent",
  amber: "bg-amber-400",
  teal: "bg-success",
  white: "bg-foreground",
};

export function VideoPlayer({ run, label }: VideoPlayerProps) {
  const setPlayerState = useStore((s) => s.setPlayerState);
  const playerState = useStore((s) => s.playerStates[run.id]);

  const containerId = `yt-player-${run.id}`;
  const isA = label === "A";

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
    <div className={`relative rounded-xl overflow-hidden border ${isA ? "border-run-a/20" : "border-accent/20"} bg-surface`}>
      {/* Label badge overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span
          className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg backdrop-blur-sm ${
            isA
              ? "bg-run-a/20 text-run-a border border-run-a/30"
              : "bg-accent/20 text-accent border border-accent/30"
          }`}
        >
          {label}
        </span>
        <span className="text-xs text-white/80 font-medium truncate max-w-[100px] sm:max-w-[180px] drop-shadow-md">
          {run.name}
        </span>
      </div>

      {/* Elapsed time overlay */}
      <div className="absolute bottom-[52px] right-3 z-10">
        <span className={`font-mono text-lg font-bold tracking-tight drop-shadow-lg ${isA ? "text-run-a" : "text-accent"}`}>
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Video container */}
      <div className="video-wrapper">
        <div id={containerId} />
      </div>

      {/* Bottom info bar */}
      <div className="px-3 py-2.5 flex items-center justify-between bg-surface-elevated/80 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted uppercase tracking-wider font-medium">Offset</span>
            <span className="font-mono text-xs text-foreground font-medium">
              {run.startOffset.toFixed(1)}s
            </span>
          </div>
          {status === "loading" && (
            <span className="text-[10px] font-mono text-muted animate-pulse">Loading...</span>
          )}
          {status === "error" && (
            <span className="text-[10px] font-mono text-accent">Error</span>
          )}
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
              <span className="text-[10px] text-muted ml-0.5">+{sortedAnnotations.length - 5}</span>
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
