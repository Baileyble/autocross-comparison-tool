"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/youtube";
import type { AnnotationColor, Run } from "@/types";

interface AnnotationPanelProps {
  run: Run;
  currentTime: number;
}

const COLOR_OPTIONS: { value: AnnotationColor; label: string; dot: string }[] = [
  { value: "red", label: "Issue", dot: "bg-accent" },
  { value: "amber", label: "Note", dot: "bg-amber-400" },
  { value: "teal", label: "Good", dot: "bg-success" },
  { value: "white", label: "Other", dot: "bg-foreground" },
];

const QUICK_LABELS = ["Cone hit", "Late apex", "Good turn", "Spun", "Early brake", "Wide exit"];

export function AnnotationPanel({ run, currentTime }: AnnotationPanelProps) {
  const addAnnotation = useStore((s) => s.addAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<AnnotationColor>("amber");
  const [expanded, setExpanded] = useState(false);

  const handleAdd = (customLabel?: string) => {
    const text = customLabel || label;
    if (!text.trim()) return;
    addAnnotation(run.id, currentTime, text.trim(), color);
    setLabel("");
  };

  const sortedAnnotations = [...run.annotations].sort((a, b) => a.time - b.time);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm text-muted hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="font-semibold">
            Markers
          </span>
          <span className="text-xs text-subtle font-mono">({run.annotations.length})</span>
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 animate-slide-up">
          {/* Quick add buttons */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_LABELS.map((ql) => (
              <button
                key={ql}
                onClick={() => handleAdd(ql)}
                className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-xs text-muted hover:text-foreground transition-colors font-medium"
              >
                {ql}
              </button>
            ))}
          </div>

          {/* Custom add */}
          <div className="flex gap-1.5 items-center">
            <div className="flex gap-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    color === c.value ? "bg-surface-hover ring-1 ring-white/20" : "hover:bg-surface-hover"
                  }`}
                  title={c.label}
                >
                  <div className={`w-3 h-3 rounded-full ${c.dot}`} />
                </button>
              ))}
            </div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Custom marker..."
              className="flex-1 bg-surface-elevated border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-run-a/40 transition-colors"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button
              onClick={() => handleAdd()}
              disabled={!label.trim()}
              className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 disabled:opacity-30 transition-colors"
            >
              Add
            </button>
          </div>

          {/* Annotation list */}
          {sortedAnnotations.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {sortedAnnotations.map((ann) => (
                <div
                  key={ann.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-elevated/50 hover:bg-surface-elevated group transition-colors"
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      ann.color === "red" ? "bg-accent" :
                      ann.color === "amber" ? "bg-amber-400" :
                      ann.color === "teal" ? "bg-success" :
                      "bg-foreground"
                    }`}
                  />
                  <span className="font-mono text-[11px] text-subtle w-12 shrink-0">
                    {formatTime(ann.time)}
                  </span>
                  <span className="text-xs text-foreground truncate flex-1">{ann.label}</span>
                  <button
                    onClick={() => removeAnnotation(run.id, ann.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-subtle hover:text-accent transition-all"
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
