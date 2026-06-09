"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { sync } from "@/lib/sync";
import { formatTime } from "@/lib/youtube";
import type { Run, AnnotationColor } from "@/types";

const QUICK_LABELS: { label: string; color: AnnotationColor }[] = [
  { label: "Cone hit", color: "red" },
  { label: "Early brake", color: "red" },
  { label: "Late apex", color: "amber" },
  { label: "Wide exit", color: "amber" },
  { label: "Good turn", color: "teal" },
  { label: "Good launch", color: "teal" },
];

/** One combined marker panel for both runs — markers land at the current timeline position. */
export function MarkerPanel({ runA, runB }: { runA: Run; runB: Run }) {
  const addAnnotation = useStore((s) => s.addAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);

  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState<"A" | "B">("A");
  const [custom, setCustom] = useState("");

  const total = runA.annotations.length + runB.annotations.length;
  const targetRun = target === "A" ? runA : runB;

  const add = (label: string, color: AnnotationColor) => {
    if (!label.trim()) return;
    const rel = sync.getTime();
    addAnnotation(targetRun.id, rel + targetRun.startOffset, label.trim(), color);
    setCustom("");
  };

  const allMarkers = [
    ...runA.annotations.map((a) => ({ ...a, run: "A" as const, rel: a.time - runA.startOffset, runId: runA.id })),
    ...runB.annotations.map((a) => ({ ...a, run: "B" as const, rel: a.time - runB.startOffset, runId: runB.id })),
  ].sort((a, b) => a.rel - b.rel);

  return (
    <div className="panel p-3 sm:p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm font-semibold text-muted hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          Markers
          <span className="font-mono text-xs text-subtle">({total})</span>
        </span>
        <span className="text-[10px] text-subtle font-normal hidden sm:block">
          dropped at the current timeline position
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 animate-rise">
          {/* Target + quick add */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-elevated rounded-lg p-0.5">
              {(["A", "B"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={`px-3 py-1 rounded-md font-mono text-xs font-bold transition-colors ${
                    target === t
                      ? t === "A"
                        ? "bg-run-a text-background"
                        : "bg-run-b text-background"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {QUICK_LABELS.map((q) => (
              <button
                key={q.label}
                onClick={() => add(q.label, q.color)}
                className="px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-hover text-xs font-medium text-muted hover:text-foreground transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Custom */}
          <div className="flex gap-2">
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add(custom, "white")}
              placeholder="Custom marker…"
              className="flex-1 min-w-0 bg-elevated border border-white/[0.06] rounded-lg px-3 py-2 text-xs placeholder:text-subtle focus:outline-none focus:border-lime/40 transition-colors"
            />
            <button
              onClick={() => add(custom, "white")}
              disabled={!custom.trim()}
              className="px-3 py-2 rounded-lg bg-lime/10 text-lime text-xs font-bold hover:bg-lime/20 disabled:opacity-25 transition-colors"
            >
              Add
            </button>
          </div>

          {/* List */}
          {allMarkers.length > 0 && (
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {allMarkers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-elevated/60 group"
                >
                  <span
                    className={`font-mono text-[10px] font-bold w-4 ${
                      m.run === "A" ? "text-run-a" : "text-run-b"
                    }`}
                  >
                    {m.run}
                  </span>
                  <button
                    onClick={() => sync.seekTo(Math.max(0, m.rel))}
                    className="font-mono text-[11px] text-muted hover:text-lime w-14 text-left transition-colors"
                    title="Jump here"
                  >
                    {formatTime(Math.max(0, m.rel))}
                  </button>
                  <span className="text-xs flex-1 truncate">{m.label}</span>
                  <button
                    onClick={() => removeAnnotation(m.runId, m.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-subtle hover:text-bad transition-all"
                    aria-label="Delete marker"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
