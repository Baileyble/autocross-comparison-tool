"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { sync } from "@/lib/sync";
import { VideoPane } from "./VideoPane";
import { ControlBar } from "./ControlBar";
import { MarkerPanel } from "./MarkerPanel";
import { ShortcutsModal } from "./ShortcutsModal";

export function ComparisonView() {
  const session = useStore((s) => s.session);

  const ac = session.activeComparison;
  const runA = ac ? session.runs.find((r) => r.id === ac[0]) : undefined;
  const runB = ac ? session.runs.find((r) => r.id === ac[1]) : undefined;

  if (!runA || !runB) return null;

  return <Inner key={`${runA.id}-${runB.id}`} runAId={runA.id} runBId={runB.id} />;
}

function Inner({ runAId, runBId }: { runAId: string; runBId: string }) {
  const session = useStore((s) => s.session);
  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const adjustOffset = useStore((s) => s.adjustOffset);
  const setShowShortcuts = useStore((s) => s.setShowShortcuts);

  const runA = session.runs.find((r) => r.id === runAId)!;
  const runB = session.runs.find((r) => r.id === runBId)!;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (isPlaying) {
            sync.pause();
            setIsPlaying(false);
          } else {
            sync.play(playbackSpeed);
            setIsPlaying(true);
          }
          break;
        case "r":
        case "R":
          sync.restart();
          setIsPlaying(false);
          break;
        case "j":
        case "J":
          sync.seekBy(-5);
          break;
        case "l":
        case "L":
          sync.seekBy(5);
          break;
        case "[":
          adjustOffset(runAId, e.shiftKey ? -1 : -0.1);
          break;
        case "]":
          adjustOffset(runAId, e.shiftKey ? 1 : 0.1);
          break;
        case ";":
          adjustOffset(runBId, e.shiftKey ? -1 : -0.1);
          break;
        case "'":
          adjustOffset(runBId, e.shiftKey ? 1 : 0.1);
          break;
        case "?":
          setShowShortcuts(true);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, playbackSpeed, runAId, runBId, setIsPlaying, adjustOffset, setShowShortcuts]);

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-3 sm:gap-4 animate-rise">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <VideoPane run={runA} label="A" />
        <VideoPane run={runB} label="B" />
      </div>

      <ControlBar runA={runA} runB={runB} />

      <MarkerPanel runA={runA} runB={runB} />

      <div className="hidden sm:flex items-center justify-center pb-2">
        <button
          onClick={() => setShowShortcuts(true)}
          className="text-[11px] text-subtle hover:text-muted transition-colors"
        >
          Keyboard shortcuts — press <kbd className="px-1 py-0.5 mx-0.5 rounded bg-elevated font-mono text-[10px]">?</kbd>
        </button>
      </div>

      <ShortcutsModal />
    </div>
  );
}
