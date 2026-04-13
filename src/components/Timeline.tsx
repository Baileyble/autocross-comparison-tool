"use client";

import { useCallback, useRef, useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/youtube";
import type { Run } from "@/types";

interface TimelineProps {
  runA: Run;
  runB: Run;
}

export function Timeline({ runA, runB }: TimelineProps) {
  const playerStates = useStore((s) => s.playerStates);
  const trackRef = useRef<HTMLDivElement>(null);

  const stateA = playerStates[runA.id];
  const stateB = playerStates[runB.id];

  const durationA = stateA?.duration ?? 0;
  const durationB = stateB?.duration ?? 0;
  const maxDuration = Math.max(durationA, durationB, 1);

  const currentTimeA = stateA?.currentTime ?? 0;
  const currentTimeB = stateB?.currentTime ?? 0;

  // Use the average position for the playhead (relative to each run's timeline)
  const progressA = durationA > 0 ? currentTimeA / maxDuration : 0;
  const progressB = durationB > 0 ? currentTimeB / maxDuration : 0;
  // Show the playhead at the midpoint of both runs' progress
  const playheadPosition = Math.max(progressA, progressB);

  const annotationsA = useMemo(
    () => runA.annotations.map((a) => ({ ...a, position: a.time / maxDuration })),
    [runA.annotations, maxDuration]
  );
  const annotationsB = useMemo(
    () => runB.annotations.map((a) => ({ ...a, position: a.time / maxDuration })),
    [runB.annotations, maxDuration]
  );

  const seekToPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetTime = fraction * maxDuration;

      const players = window.__gridlinePlayers;
      if (!players) return;
      players.forEach((p) => {
        try {
          p.seekTo(targetTime, true);
        } catch {}
      });
    },
    [maxDuration]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      seekToPosition(e.clientX);
    },
    [seekToPosition]
  );

  const handleDrag = useCallback(
    (e: React.MouseEvent) => {
      if (e.buttons !== 1) return;
      seekToPosition(e.clientX);
    },
    [seekToPosition]
  );

  const ANNOTATION_COLOR_MAP: Record<string, string> = {
    red: "bg-red",
    amber: "bg-amber",
    teal: "bg-accent",
    white: "bg-foreground",
  };

  return (
    <div className="w-full px-3 py-2">
      {/* Time labels */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-muted">0:00</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-run-a">
            A {formatTime(currentTimeA)}
          </span>
          <span className="font-mono text-[10px] text-run-b">
            B {formatTime(currentTimeB)}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted">{formatTime(maxDuration)}</span>
      </div>

      {/* Dual-track timeline */}
      <div
        ref={trackRef}
        className="relative h-6 cursor-pointer select-none"
        onClick={handleClick}
        onMouseMove={handleDrag}
      >
        {/* Run A track (top half) */}
        <div className="absolute top-0 left-0 right-0 h-3 rounded-t bg-surface-elevated overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-run-a/30 pw-transition"
            style={{ width: `${progressA * 100}%` }}
          />
          {/* Run A annotation markers */}
          {annotationsA.map((ann) => (
            <div
              key={ann.id}
              className={`absolute top-1 w-1.5 h-1.5 rounded-full ${ANNOTATION_COLOR_MAP[ann.color] || "bg-foreground"}`}
              style={{ left: `${ann.position * 100}%` }}
              title={`${ann.label} @ ${formatTime(ann.time)}`}
            />
          ))}
          {/* Run A label */}
          <span className="absolute top-0 left-1 text-[8px] font-mono font-bold text-run-a/60 leading-3">A</span>
        </div>

        {/* Run B track (bottom half) */}
        <div className="absolute bottom-0 left-0 right-0 h-3 rounded-b bg-surface-elevated overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-run-b/30 pw-transition"
            style={{ width: `${progressB * 100}%` }}
          />
          {/* Run B annotation markers */}
          {annotationsB.map((ann) => (
            <div
              key={ann.id}
              className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${ANNOTATION_COLOR_MAP[ann.color] || "bg-foreground"}`}
              style={{ left: `${ann.position * 100}%` }}
              title={`${ann.label} @ ${formatTime(ann.time)}`}
            />
          ))}
          {/* Run B label */}
          <span className="absolute bottom-0 left-1 text-[8px] font-mono font-bold text-run-b/60 leading-3">B</span>
        </div>

        {/* Playhead — vertical white line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none pw-transition"
          style={{ left: `${playheadPosition * 100}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}
