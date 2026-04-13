"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatTime, formatTimeDelta } from "@/lib/youtube";
import { AnnotationPanel } from "./AnnotationPanel";
import type { Run } from "@/types";

interface DataPanelProps {
  runA: Run;
  runB: Run;
}

export function DataPanel({ runA, runB }: DataPanelProps) {
  const playerStates = useStore((s) => s.playerStates);
  const setSyncSetupMode = useStore((s) => s.setSyncSetupMode);

  const stateA = playerStates[runA.id];
  const stateB = playerStates[runB.id];

  const elapsedA = stateA?.elapsed ?? 0;
  const elapsedB = stateB?.elapsed ?? 0;
  const currentTimeA = stateA?.currentTime ?? 0;
  const currentTimeB = stateB?.currentTime ?? 0;
  const delta = elapsedA - elapsedB;

  return (
    <div className="flex flex-col h-full">
      {/* Section: Run comparison */}
      <div className="p-3 pw-border-b">
        <div className="section-label mb-2">Run Comparison</div>

        {/* Run A */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-run-a" />
            <span className="text-[10px] font-mono font-bold text-run-a uppercase">Run A</span>
            <span className="text-[10px] text-muted truncate">{runA.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] text-muted uppercase tracking-wider">Elapsed</div>
              <div className="font-mono text-lg font-bold text-run-a leading-tight">
                {formatTime(elapsedA)}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-muted uppercase tracking-wider">Offset</div>
              <div className="font-mono text-sm text-muted leading-tight mt-0.5">
                {runA.startOffset.toFixed(1)}s
              </div>
            </div>
          </div>
        </div>

        {/* Run B */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-run-b" />
            <span className="text-[10px] font-mono font-bold text-run-b uppercase">Run B</span>
            <span className="text-[10px] text-muted truncate">{runB.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] text-muted uppercase tracking-wider">Elapsed</div>
              <div className="font-mono text-lg font-bold text-run-b leading-tight">
                {formatTime(elapsedB)}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-muted uppercase tracking-wider">Offset</div>
              <div className="font-mono text-sm text-muted leading-tight mt-0.5">
                {runB.startOffset.toFixed(1)}s
              </div>
            </div>
          </div>
        </div>

        {/* Delta */}
        <div className="p-2 rounded bg-surface-elevated">
          <div className="text-[9px] text-muted uppercase tracking-wider mb-0.5">Time Delta</div>
          <div
            className={`font-mono text-xl font-bold leading-tight ${
              delta > 0 ? "text-run-b" : delta < 0 ? "text-run-a" : "text-foreground"
            }`}
          >
            {formatTimeDelta(delta)}
          </div>
          <div className="text-[9px] text-muted mt-0.5">
            {delta > 0.05
              ? "B is ahead"
              : delta < -0.05
              ? "A is ahead"
              : "Even"}
          </div>
        </div>
      </div>

      {/* Section: Adjust Sync */}
      <div className="p-3 pw-border-b">
        <button
          onClick={() => setSyncSetupMode("runA")}
          className="pw-btn pw-btn-accent w-full"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          Adjust Sync
        </button>
      </div>

      {/* Section: Annotations */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 pw-border-b">
          <div className="section-label mb-2">
            <span className="text-run-a">Run A</span> Annotations
          </div>
          <AnnotationPanel run={runA} currentTime={currentTimeA} />
        </div>
        <div className="p-3">
          <div className="section-label mb-2">
            <span className="text-run-b">Run B</span> Annotations
          </div>
          <AnnotationPanel run={runB} currentTime={currentTimeB} />
        </div>
      </div>
    </div>
  );
}
