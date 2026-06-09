"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { sync } from "@/lib/sync";
import { formatTime } from "@/lib/youtube";
import type { Run } from "@/types";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

export function ControlBar({ runA, runB }: { runA: Run; runB: Run }) {
  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const speed = useStore((s) => s.playbackSpeed);
  const setSpeed = useStore((s) => s.setPlaybackSpeed);
  const setSyncTarget = useStore((s) => s.setSyncTarget);
  const swapRuns = useStore((s) => s.swapRuns);
  const adjustOffset = useStore((s) => s.adjustOffset);

  const [showFineTune, setShowFineTune] = useState(false);

  const togglePlay = () => {
    if (isPlaying) {
      sync.pause();
      setIsPlaying(false);
    } else {
      sync.play(speed);
      setIsPlaying(true);
    }
  };

  const restart = () => {
    sync.restart();
    setIsPlaying(false);
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    sync.setSpeed(s);
  };

  const nudgeOffset = (runId: string, delta: number) => {
    const t = sync.getTime();
    adjustOffset(runId, delta);
    // sync.setOffset happens via the player hook's offset effect; re-align now
    setTimeout(() => sync.seekTo(t), 50);
  };

  return (
    <div className="panel p-3 sm:p-4 space-y-3">
      <Timeline runA={runA} runB={runB} />

      {/* Transport */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
        <TransportButton onClick={() => sync.seekBy(-5)} label="Back 5 seconds">
          <span className="font-mono text-xs font-bold">-5</span>
        </TransportButton>
        <TransportButton onClick={() => sync.seekBy(-1)} label="Back 1 second">
          <span className="font-mono text-xs font-bold">-1</span>
        </TransportButton>

        <button
          onClick={togglePlay}
          className={`p-4 rounded-full transition-all active:scale-95 ${
            isPlaying
              ? "bg-lime text-background"
              : "bg-elevated hover:bg-hover text-foreground"
          }`}
          aria-label={isPlaying ? "Pause both" : "Play both"}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <TransportButton onClick={() => sync.seekBy(1)} label="Forward 1 second">
          <span className="font-mono text-xs font-bold">+1</span>
        </TransportButton>
        <TransportButton onClick={() => sync.seekBy(5)} label="Forward 5 seconds">
          <span className="font-mono text-xs font-bold">+5</span>
        </TransportButton>

        <div className="w-px h-6 bg-elevated mx-1" />

        <TransportButton onClick={restart} label="Restart both runs">
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </TransportButton>
      </div>

      {/* Speed + secondary actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center bg-elevated rounded-lg p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`px-2.5 py-1 rounded-md font-mono text-xs font-medium transition-colors ${
                speed === s ? "bg-lime text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <ActionButton onClick={() => setSyncTarget("A")}>Adjust sync</ActionButton>
          <ActionButton onClick={swapRuns}>Swap A/B</ActionButton>
          <ActionButton onClick={() => setShowFineTune(!showFineTune)} active={showFineTune}>
            Fine-tune
          </ActionButton>
        </div>
      </div>

      {/* Fine-tune offsets */}
      {showFineTune && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-rise">
          {([{ run: runA, label: "A" as const }, { run: runB, label: "B" as const }]).map(
            ({ run, label }) => (
              <div
                key={run.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                  label === "A" ? "bg-run-a/[0.06] border-run-a/20" : "bg-run-b/[0.06] border-run-b/20"
                }`}
              >
                <div className="min-w-0 mr-2">
                  <span className={`font-mono text-[10px] font-bold ${label === "A" ? "text-run-a" : "text-run-b"}`}>
                    {label}
                  </span>
                  <span className="font-mono text-[10px] text-subtle ml-2">
                    {run.startOffset.toFixed(1)}s
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[-1, -0.1, 0.1, 1].map((d) => (
                    <button
                      key={d}
                      onClick={() => nudgeOffset(run.id, d)}
                      className="min-w-9 h-8 px-1 flex items-center justify-center rounded-md bg-elevated hover:bg-hover font-mono text-[10px] text-muted hover:text-foreground transition-colors"
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Unified scrubber: one bar drives both videos, markers from both runs shown. */
function Timeline({ runA, runB }: { runA: Run; runB: Run }) {
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!draggingRef.current) {
        setT(sync.getTime());
        setDuration(sync.getDuration());
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  if (duration <= 0) {
    return (
      <div className="h-10 flex items-center justify-center">
        <span className="text-[11px] font-mono text-subtle animate-pulse">loading timeline…</span>
      </div>
    );
  }

  const markers = [
    ...runA.annotations.map((a) => ({ ...a, rel: a.time - runA.startOffset, run: "A" as const })),
    ...runB.annotations.map((a) => ({ ...a, rel: a.time - runB.startOffset, run: "B" as const })),
  ].filter((m) => m.rel >= 0 && m.rel <= duration);

  return (
    <div>
      {/* Marker layer */}
      <div className="relative h-3 mx-1">
        {markers.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              sync.seekTo(m.rel);
              setT(m.rel);
            }}
            title={`${m.label} · ${formatTime(m.rel)}`}
            className={`absolute -translate-x-1/2 w-2 h-2 rounded-full top-0.5 ${
              m.run === "A" ? "bg-run-a" : "bg-run-b"
            } hover:scale-150 transition-transform`}
            style={{ left: `${(m.rel / duration) * 100}%` }}
          />
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={Math.min(t, duration)}
        onPointerDown={() => (draggingRef.current = true)}
        onPointerUp={() => (draggingRef.current = false)}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setT(v);
          sync.seekTo(v);
        }}
        aria-label="Timeline"
      />

      <div className="flex justify-between mt-1 px-1">
        <span className="font-mono text-[11px] text-muted">{formatTime(t)}</span>
        <span className="font-mono text-[11px] text-subtle">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function TransportButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-10 h-10 flex items-center justify-center rounded-xl bg-elevated hover:bg-hover text-muted hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  active = false,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active ? "bg-hover text-foreground" : "text-muted hover:text-foreground hover:bg-hover"
      }`}
    >
      {children}
    </button>
  );
}
