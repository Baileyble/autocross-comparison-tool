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
  { value: "amber", label: "Note", dot: "bg-amber" },
  { value: "teal", label: "Good", dot: "bg-teal" },
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
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors w-full"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="uppercase tracking-wider font-medium">
          Markers ({run.annotations.length})
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 animate-slide-up">
          {/* Quick add buttons */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_LABELS.map((ql) => (
              <button
                key={ql}
                onClick={() => handleAdd(ql)}
                className="px-2 py-1 rounded-md bg-surface-elevated hover:bg-surface-hover text-xs text-muted hover:text-foreground transition-colors"
              >
                {ql}
              </button>
            ))}
          </div>

          {/* Custom add */}
          <div className="flex gap-1.5">
            <div className="flex gap-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                    color === c.value ? "bg-surface-hover ring-1 ring-white/20" : "hover:bg-surface-hover"
                  }`}
                  title={c.label}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                </button>
              ))}
            </div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Custom marker..."
              className="flex-1 bg-surface border border-white/10 rounded-lg px-2 py-1 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button
              onClick={() => handleAdd()}
              disabled={!label.trim()}
              className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-30 transition-colors"
            >
              Add
            </button>
          </div>

          {/* Annotation list */}
          {sortedAnnotations.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {sortedAnnotations.map((ann) => (
                <div
                  key={ann.id}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg bg-surface-elevated/50 group"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      ann.color === "red" ? "bg-accent" :
                      ann.color === "amber" ? "bg-amber" :
                      ann.color === "teal" ? "bg-teal" :
                      "bg-foreground"
                    }`}
                  />
                  <span className="font-mono text-[10px] text-subtle w-10 shrink-0">
                    {formatTime(ann.time)}
                  </span>
                  <span className="text-xs text-foreground truncate flex-1">{ann.label}</span>
                  <button
                    onClick={() => removeAnnotation(run.id, ann.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-subtle hover:text-accent transition-all"
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
