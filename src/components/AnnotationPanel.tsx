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
  { value: "red", label: "Issue", dot: "bg-red" },
  { value: "amber", label: "Note", dot: "bg-amber" },
  { value: "teal", label: "Good", dot: "bg-accent" },
  { value: "white", label: "Other", dot: "bg-foreground" },
];

const QUICK_LABELS = ["Cone hit", "Late apex", "Good turn", "Spun", "Early brake", "Wide exit"];

export function AnnotationPanel({ run, currentTime }: AnnotationPanelProps) {
  const addAnnotation = useStore((s) => s.addAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<AnnotationColor>("amber");

  const handleAdd = (customLabel?: string) => {
    const text = customLabel || label;
    if (!text.trim()) return;
    addAnnotation(run.id, currentTime, text.trim(), color);
    setLabel("");
  };

  const sortedAnnotations = [...run.annotations].sort((a, b) => a.time - b.time);

  return (
    <div className="space-y-2">
      {/* Quick add buttons */}
      <div className="flex flex-wrap gap-1">
        {QUICK_LABELS.map((ql) => (
          <button
            key={ql}
            onClick={() => handleAdd(ql)}
            className="px-1.5 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover text-[10px] text-muted hover:text-foreground pw-transition"
          >
            {ql}
          </button>
        ))}
      </div>

      {/* Custom add */}
      <div className="flex gap-1">
        <div className="flex gap-0.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`w-5 h-5 rounded flex items-center justify-center pw-transition ${
                color === c.value ? "bg-surface-hover ring-1 ring-white/20" : "hover:bg-surface-hover"
              }`}
              title={c.label}
            >
              <div className={`w-2 h-2 rounded-full ${c.dot}`} />
            </button>
          ))}
        </div>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Custom..."
          className="flex-1 bg-surface-elevated border border-white/6 rounded px-1.5 py-0.5 text-[10px] text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={() => handleAdd()}
          disabled={!label.trim()}
          className="pw-btn pw-btn-accent text-[10px] disabled:opacity-30"
        >
          +
        </button>
      </div>

      {/* Annotation list */}
      {sortedAnnotations.length > 0 && (
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {sortedAnnotations.map((ann) => (
            <div
              key={ann.id}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-surface-elevated/50 group"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  ann.color === "red" ? "bg-red" :
                  ann.color === "amber" ? "bg-amber" :
                  ann.color === "teal" ? "bg-accent" :
                  "bg-foreground"
                }`}
              />
              <span className="font-mono text-[9px] text-subtle w-8 shrink-0">
                {formatTime(ann.time)}
              </span>
              <span className="text-[10px] text-foreground truncate flex-1">{ann.label}</span>
              <button
                onClick={() => removeAnnotation(run.id, ann.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-subtle hover:text-red pw-transition"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {sortedAnnotations.length === 0 && (
        <div className="text-[9px] text-subtle py-1">No annotations yet</div>
      )}
    </div>
  );
}
