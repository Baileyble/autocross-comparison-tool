"use client";

import { usePlayer } from "@/hooks/usePlayer";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/youtube";
import type { Run } from "@/types";

export function VideoPane({ run, label }: { run: Run; label: "A" | "B" }) {
  const state = useStore((s) => s.playerStates[run.id]);
  const containerId = `pane-${run.id}`;
  const isA = label === "A";

  usePlayer({ runId: run.id, videoId: run.videoId, offset: run.startOffset, containerId });

  const status = state?.status ?? "idle";
  const elapsed = state?.elapsed ?? 0;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border bg-surface ${
        isA ? "border-run-a/25" : "border-run-b/25"
      }`}
    >
      {/* Top overlay: badge + name */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2 pointer-events-none">
        <span
          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
            isA ? "bg-run-a text-background" : "bg-run-b text-background"
          }`}
        >
          {label}
        </span>
        <span className="text-xs font-medium text-white/85 drop-shadow truncate max-w-[110px] sm:max-w-[200px]">
          {run.name}
        </span>
      </div>

      {/* Status dot */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none">
        <span
          className={`block w-2 h-2 rounded-full ${
            status === "playing"
              ? "bg-good"
              : status === "loading"
              ? "bg-lime animate-pulse"
              : status === "error"
              ? "bg-bad"
              : "bg-subtle"
          }`}
        />
      </div>

      <div className="video-shell">
        <div id={containerId} />
      </div>

      {/* Bottom bar */}
      <div className="px-3 py-2 flex items-center justify-between bg-elevated/60 border-t border-white/[0.05]">
        <span className={`font-mono text-base font-bold tracking-tight ${isA ? "text-run-a" : "text-run-b"}`}>
          {formatTime(elapsed)}
        </span>
        <span className="font-mono text-[11px] text-subtle">
          launch {run.startOffset.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
