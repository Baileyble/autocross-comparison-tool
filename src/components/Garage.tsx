"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { extractVideoId, getThumbnailUrl } from "@/lib/youtube";
import type { Run } from "@/types";

export function Garage() {
  const session = useStore((s) => s.session);
  const addRun = useStore((s) => s.addRun);
  const removeRun = useStore((s) => s.removeRun);
  const setActiveComparison = useStore((s) => s.setActiveComparison);
  const setSyncSetupMode = useStore((s) => s.setSyncSetupMode);
  const saveToHistory = useStore((s) => s.saveToHistory);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);

  const previewId = useMemo(() => {
    if (!url) return null;
    return extractVideoId(url);
  }, [url]);

  const handleAddRun = () => {
    setError("");
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError("Invalid YouTube URL");
      return;
    }

    addRun({
      name: name || `Run ${session.runs.length + 1}`,
      youtubeUrl: url,
      videoId,
      startOffset: 0,
      notes: "",
      metadata: {},
    });

    setUrl("");
    setName("");
  };

  const toggleRunSelection = (id: string) => {
    setSelectedRuns((prev) => {
      if (prev.includes(id)) return prev.filter((r) => r !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selectedRuns.length === 2) {
      setActiveComparison(selectedRuns[0], selectedRuns[1]);
      saveToHistory();
      setActiveTab("compare");
    }
  };

  const handleSyncAndCompare = () => {
    if (selectedRuns.length === 2) {
      setActiveComparison(selectedRuns[0], selectedRuns[1]);
      saveToHistory();
      setSyncSetupMode("runA");
    }
  };

  return (
    <div className="flex flex-col">
      {/* Add run form */}
      <div className="p-3 pw-border-b space-y-2">
        <div className="section-label mb-1">Add Run</div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="w-full bg-surface-elevated border border-white/6 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50 pw-transition"
        />
        <div className="flex gap-1.5">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            placeholder="YouTube URL or ID"
            className="flex-1 bg-surface-elevated border border-white/6 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50 pw-transition"
            onKeyDown={(e) => e.key === "Enter" && handleAddRun()}
          />
          <button
            onClick={handleAddRun}
            disabled={!url}
            className="pw-btn pw-btn-accent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        {/* Preview */}
        {previewId && (
          <div className="flex items-center gap-2 p-1.5 rounded bg-surface-elevated/50">
            <img
              src={getThumbnailUrl(previewId, "default")}
              alt="Preview"
              className="w-14 h-8 rounded object-cover"
            />
            <span className="text-[10px] font-mono text-muted truncate">{previewId}</span>
          </div>
        )}

        {error && <p className="text-red text-[10px] font-medium">{error}</p>}
      </div>

      {/* Runs list */}
      <div className="flex-1 overflow-y-auto">
        {session.runs.length > 0 && (
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="section-label">Runs ({session.runs.length})</span>
              <span className="text-[9px] text-subtle">
                {selectedRuns.length === 0
                  ? "Select 2"
                  : selectedRuns.length === 1
                  ? "Select 1 more"
                  : "Ready"}
              </span>
            </div>

            {session.runs.map((run, index) => (
              <RunCard
                key={run.id}
                run={run}
                index={index}
                selected={selectedRuns.includes(run.id)}
                selectionOrder={selectedRuns.indexOf(run.id)}
                onSelect={() => toggleRunSelection(run.id)}
                onRemove={() => removeRun(run.id)}
              />
            ))}

            {/* Action buttons */}
            {selectedRuns.length === 2 && (
              <div className="space-y-1 pt-1">
                <button
                  onClick={handleCompare}
                  className="w-full py-2 rounded bg-accent text-background text-xs font-bold uppercase tracking-wider hover:bg-accent-glow pw-transition"
                >
                  Compare Runs
                </button>
                <button
                  onClick={handleSyncAndCompare}
                  className="w-full py-2 rounded bg-surface-elevated text-foreground text-xs font-medium uppercase tracking-wider hover:bg-surface-hover pw-transition pw-border"
                >
                  Sync &amp; Compare
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {session.runs.length === 0 && (
          <div className="text-center py-8 px-3">
            <div className="text-[10px] text-muted uppercase tracking-wider mb-1">No runs yet</div>
            <p className="text-[10px] text-subtle">Add YouTube videos above to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RunCard({
  run,
  index,
  selected,
  selectionOrder,
  onSelect,
  onRemove,
}: {
  run: Run;
  index: number;
  selected: boolean;
  selectionOrder: number;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const label = selectionOrder === 0 ? "A" : selectionOrder === 1 ? "B" : null;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 p-2 rounded cursor-pointer pw-transition ${
        selected
          ? label === "A"
            ? "bg-run-a/10 border border-run-a/30"
            : "bg-run-b/10 border border-run-b/30"
          : "bg-surface-elevated/50 border border-transparent hover:border-white/6 hover:bg-surface-elevated"
      }`}
    >
      {/* Selection indicator */}
      <div
        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${
          label === "A"
            ? "bg-run-a/20 text-run-a"
            : label === "B"
            ? "bg-run-b/20 text-run-b"
            : "bg-surface-elevated text-subtle"
        }`}
      >
        {label || index + 1}
      </div>

      {/* Thumbnail */}
      <img
        src={getThumbnailUrl(run.videoId, "default")}
        alt={run.name}
        className="w-12 h-7 rounded object-cover shrink-0"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-foreground truncate">{run.name}</div>
        <div className="text-[9px] font-mono text-subtle truncate">{run.videoId}</div>
      </div>

      {/* Remove */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 rounded text-subtle hover:text-red hover:bg-red/10 pw-transition shrink-0"
        aria-label="Remove run"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
