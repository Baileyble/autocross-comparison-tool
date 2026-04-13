"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { extractVideoId, getThumbnailUrl } from "@/lib/youtube";
import type { Run } from "@/types";

export function Garage({ isPanel = false }: { isPanel?: boolean }) {
  const session = useStore((s) => s.session);
  const addRun = useStore((s) => s.addRun);
  const removeRun = useStore((s) => s.removeRun);
  const setActiveComparison = useStore((s) => s.setActiveComparison);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const setSyncSetupMode = useStore((s) => s.setSyncSetupMode);
  const renameSession = useStore((s) => s.renameSession);
  const saveToHistory = useStore((s) => s.saveToHistory);
  const setShowRunPanel = useStore((s) => s.setShowRunPanel);
  const createSession = useStore((s) => s.createSession);

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [editingSession, setEditingSession] = useState(false);
  const [sessionName, setSessionName] = useState(session.name);

  const previewId = useMemo(() => {
    if (!url) return null;
    return extractVideoId(url);
  }, [url]);

  const handleAddRun = () => {
    setError("");
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError("Invalid YouTube URL or video ID");
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

  const handleCompare = (withSync: boolean) => {
    if (selectedRuns.length === 2) {
      setActiveComparison(selectedRuns[0], selectedRuns[1]);
      saveToHistory();
      if (withSync) {
        setSyncSetupMode("runA");
        setShowGarage(false);
      } else {
        setShowGarage(false);
      }
      if (isPanel) setShowRunPanel(false);
    }
  };

  const handleNewSession = () => {
    saveToHistory();
    createSession();
    setSelectedRuns([]);
    setSessionName("New Session");
  };

  const handleSessionRename = () => {
    renameSession(sessionName);
    setEditingSession(false);
  };

  return (
    <div className="animate-slide-up">
      <div className={`${isPanel ? "" : "max-w-2xl mx-auto"} px-4 sm:px-6 py-6 space-y-6`}>
        {/* Session header */}
        {!isPanel && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {editingSession ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="flex-1 min-w-0 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-run-a/50"
                    onKeyDown={(e) => e.key === "Enter" && handleSessionRename()}
                    autoFocus
                  />
                  <button
                    onClick={handleSessionRename}
                    className="px-3 py-2 rounded-lg bg-run-a/10 text-run-a text-xs font-semibold hover:bg-run-a/20 transition-colors shrink-0"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSessionName(session.name);
                    setEditingSession(true);
                  }}
                  className="flex items-center gap-2 text-foreground hover:text-run-a transition-colors group min-w-0"
                >
                  <h2 className="text-2xl font-extrabold tracking-tight truncate">
                    {session.name}
                  </h2>
                  <svg className="w-4 h-4 text-subtle group-hover:text-run-a transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add run card */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-sm font-semibold text-foreground">Add a run</span>
          </div>

          {isPanel ? (
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Run name (optional)"
                className="w-full bg-surface-elevated border border-white/6 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-run-a/40 transition-colors"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(""); }}
                  placeholder="YouTube URL or video ID"
                  className="flex-1 min-w-0 bg-surface-elevated border border-white/6 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-run-a/40 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleAddRun()}
                />
                <button
                  onClick={handleAddRun}
                  disabled={!url}
                  className="btn btn-primary px-4 py-2.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Run name"
                className="w-28 sm:w-36 bg-surface-elevated border border-white/6 rounded-lg px-3 py-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-run-a/40 transition-colors"
              />
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                placeholder="Paste a YouTube URL or video ID"
                className="flex-1 bg-surface-elevated border border-white/6 rounded-lg px-3 py-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-run-a/40 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleAddRun()}
              />
              <button
                onClick={handleAddRun}
                disabled={!url}
                className="btn btn-primary px-5 py-3 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add Run
              </button>
            </div>
          )}

          {previewId && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-elevated border border-white/5">
              <img src={getThumbnailUrl(previewId, "default")} alt="Preview" className="w-16 h-10 rounded object-cover" />
              <span className="text-xs font-mono text-muted">{previewId}</span>
            </div>
          )}

          {error && <p className="text-accent text-xs font-medium">{error}</p>}
        </div>

        {/* Runs list */}
        {session.runs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Runs ({session.runs.length})
              </span>
              <span className="text-xs text-subtle font-medium">
                {selectedRuns.length === 0
                  ? "Select 2 to compare"
                  : selectedRuns.length === 1
                  ? "Select 1 more"
                  : "Ready to compare"}
              </span>
            </div>

            <div className="space-y-2">
              {session.runs.map((run, index) => (
                <RunCard
                  key={run.id}
                  run={run}
                  index={index}
                  compact={isPanel}
                  selected={selectedRuns.includes(run.id)}
                  selectionOrder={selectedRuns.indexOf(run.id)}
                  onSelect={() => toggleRunSelection(run.id)}
                  onRemove={() => removeRun(run.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {session.runs.length === 0 && !isPanel && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-white/5 mb-4">
              <svg className="w-8 h-8 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-foreground tracking-tight mb-1">No runs yet</h3>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Add YouTube videos of your autocross runs above to start comparing.
            </p>
          </div>
        )}

        {/* Spacer for bottom action bar */}
        {selectedRuns.length === 2 && !isPanel && <div className="h-24" />}
      </div>

      {/* Bottom action bar */}
      {selectedRuns.length === 2 && (
        <div className={isPanel ? "px-4 pb-4 space-y-2" : "bottom-action-bar"}>
          <div className={isPanel ? "space-y-2" : "max-w-2xl mx-auto space-y-2"}>
            <button
              onClick={() => handleCompare(true)}
              className="w-full btn btn-primary py-3.5 text-base font-bold tracking-tight"
            >
              Sync &amp; Compare
            </button>
            <button
              onClick={() => handleCompare(false)}
              className="w-full py-2 rounded-lg text-sm text-muted hover:text-foreground transition-colors font-medium"
            >
              Skip sync — compare directly
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RunCard({
  run,
  index,
  compact,
  selected,
  selectionOrder,
  onSelect,
  onRemove,
}: {
  run: Run;
  index: number;
  compact?: boolean;
  selected: boolean;
  selectionOrder: number;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const label = selectionOrder === 0 ? "A" : selectionOrder === 1 ? "B" : null;
  const isA = label === "A";
  const isB = label === "B";

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl cursor-pointer transition-all ${
        compact ? "p-2.5" : "p-3"
      } ${
        selected
          ? isA
            ? "bg-run-a/8 border-2 border-run-a/40"
            : "bg-accent/8 border-2 border-accent/40"
          : "card hover:bg-surface-elevated"
      }`}
    >
      {/* Selection indicator */}
      <div
        className={`shrink-0 rounded-lg flex items-center justify-center font-bold font-mono ${
          compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm"
        } ${
          isA
            ? "bg-run-a/20 text-run-a"
            : isB
            ? "bg-accent/20 text-accent"
            : "bg-surface-elevated text-subtle"
        }`}
      >
        {label || index + 1}
      </div>

      {/* Thumbnail */}
      <img
        src={getThumbnailUrl(run.videoId, "default")}
        alt={run.name}
        className={`rounded-lg object-cover shrink-0 ${compact ? "w-14 h-9" : "w-20 h-12"}`}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-foreground truncate ${compact ? "text-sm" : "text-base"}`}>
          {run.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-subtle">{run.videoId}</span>
          {run.startOffset > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
              Synced at {run.startOffset.toFixed(1)}s
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-surface-elevated text-subtle border border-white/5">
              Not synced
            </span>
          )}
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="p-1.5 rounded-lg text-subtle hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
        aria-label="Remove"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    </div>
  );
}
