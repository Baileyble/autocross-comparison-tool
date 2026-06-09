"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { formatTime, loadYouTubeAPI } from "@/lib/youtube";
import type { Run } from "@/types";

export function SyncWizard() {
  const session = useStore((s) => s.session);
  const syncTarget = useStore((s) => s.syncTarget);
  const setSyncTarget = useStore((s) => s.setSyncTarget);
  const setLaunchPoint = useStore((s) => s.setLaunchPoint);

  if (!syncTarget || !session.activeComparison) return null;

  const runA = session.runs.find((r) => r.id === session.activeComparison![0]);
  const runB = session.runs.find((r) => r.id === session.activeComparison![1]);
  if (!runA || !runB) return null;

  const run = syncTarget === "A" ? runA : runB;

  const advance = () => setSyncTarget(syncTarget === "A" ? "B" : null);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade">
      <WizardStep
        key={run.id}
        run={run}
        target={syncTarget}
        onMark={(time) => {
          setLaunchPoint(run.id, Math.round(time * 10) / 10);
          advance();
        }}
        onSkip={advance}
        onCancel={() => setSyncTarget(null)}
      />
    </div>
  );
}

function WizardStep({
  run,
  target,
  onMark,
  onSkip,
  onCancel,
}: {
  run: Run;
  target: "A" | "B";
  onMark: (time: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  // Stable per run — the wizard remounts per run via key, so this never changes mid-life
  const containerId = `wiz-${run.id}`;

  const playerRef = useRef<YT.Player | null>(null);
  const [time, setTime] = useState(run.startOffset);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const isA = target === "A";
  const tone = isA ? "text-run-a" : "text-run-b";

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        await loadYouTubeAPI();
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled || !document.getElementById(containerId)) return;

        const player = new window.YT.Player(containerId, {
          videoId: run.videoId,
          playerVars: {
            autoplay: 0,
            controls: 1, // native YouTube controls — scrub and play right in the video
            enablejsapi: 1,
            rel: 0,
            playsinline: 1,
            fs: 0,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              playerRef.current = player;
              try {
                const d = player.getDuration();
                if (d > 0) setDuration(d);
                player.seekTo(run.startOffset, true);
              } catch {}
              poll = setInterval(() => {
                try {
                  setTime(player.getCurrentTime());
                  const d = player.getDuration();
                  if (d > 0) setDuration(d);
                } catch {}
              }, 150);
            },
            onStateChange: (e: YT.OnStateChangeEvent) => {
              if (!cancelled) setIsPlaying((e.data as number) === 1);
            },
          },
        });
      } catch {
        // YouTube API failed to load; cancel surface remains usable
      }
    }

    init();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
    };
  }, [run.videoId, run.startOffset, containerId]);

  const seekTo = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, duration || 99999));
      setTime(clamped);
      try {
        playerRef.current?.seekTo(clamped, true);
      } catch {}
    },
    [duration]
  );

  const step = useCallback(
    (delta: number) => {
      try {
        playerRef.current?.pauseVideo();
      } catch {}
      setIsPlaying(false);
      seekTo(time + delta);
    },
    [time, seekTo]
  );

  const togglePlay = useCallback(() => {
    try {
      if (isPlaying) playerRef.current?.pauseVideo();
      else playerRef.current?.playVideo();
    } catch {}
  }, [isPlaying]);

  return (
    <>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] shrink-0">
        <button
          onClick={onCancel}
          className="text-sm font-semibold text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2.5">
          <StepDot active={isA} done={!isA} />
          <div className="w-8 h-px bg-elevated" />
          <StepDot active={!isA} done={false} />
        </div>

        <button
          onClick={onSkip}
          className="text-sm font-semibold text-muted hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
          <div className="text-center">
            <div className="label-micro mb-1">Set launch point · step {isA ? 1 : 2} of 2</div>
            <h2 className={`text-xl font-extrabold tracking-tight ${tone}`}>
              Run {target} — {run.name}
            </h2>
          </div>

          {/* Video with native controls */}
          <div className="video-shell rounded-xl">
            <div id={containerId} />
          </div>

          {/* Time readout */}
          <div className="text-center">
            <div className={`font-mono text-5xl font-bold tracking-tight ${tone}`}>
              {formatTime(time)}
            </div>
            {run.startOffset > 0 && (
              <div className="text-xs text-subtle mt-1.5 font-mono">
                current launch point: {run.startOffset.toFixed(1)}s
              </div>
            )}
          </div>

          {/* Fine scrub */}
          {duration > 0 && (
            <div className="px-2">
              <input
                type="range"
                className="scrub-lg"
                min={0}
                max={duration}
                step={0.1}
                value={Math.min(time, duration)}
                onChange={(e) => {
                  try {
                    playerRef.current?.pauseVideo();
                  } catch {}
                  seekTo(parseFloat(e.target.value));
                }}
              />
              <div className="flex justify-between text-[10px] font-mono text-subtle mt-1">
                <span>0:00.0</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="flex items-center justify-center gap-2">
            <StepButton label="-1s" onClick={() => step(-1)} />
            <StepButton label="-0.1s" onClick={() => step(-0.1)} />
            <button
              onClick={togglePlay}
              className={`px-6 py-3 rounded-xl font-mono text-sm font-bold transition-colors ${
                isPlaying
                  ? `${isA ? "bg-run-a/15 text-run-a" : "bg-run-b/15 text-run-b"}`
                  : "bg-elevated hover:bg-hover"
              }`}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <StepButton label="+0.1s" onClick={() => step(0.1)} />
            <StepButton label="+1s" onClick={() => step(1)} />
          </div>

          {/* Mark */}
          <button
            onClick={() => onMark(time)}
            className="w-full py-4 rounded-xl bg-lime text-background font-extrabold text-base tracking-tight hover:bg-lime-bright active:scale-[0.99] transition-all"
          >
            Mark launch point — {formatTime(time)}
          </button>

          <p className="text-xs text-subtle text-center pb-4">
            Scrub to the exact frame the car launches — use the video itself or the
            buttons above — then mark it. It&apos;s remembered for this video from now on.
          </p>
        </div>
      </div>
    </>
  );
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div
      className={`w-2.5 h-2.5 rounded-full transition-colors ${
        active ? "bg-lime" : done ? "bg-lime/40" : "bg-elevated"
      }`}
    />
  );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-3 rounded-xl bg-elevated hover:bg-hover font-mono text-sm font-medium transition-colors"
    >
      {label}
    </button>
  );
}
