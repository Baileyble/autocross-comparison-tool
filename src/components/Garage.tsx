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
      <div className={`${isPanel ? "" : "max-w-2xl mx-auto"} px-4 py-4 space-y-4`}>
        {/* Session header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {editingSession ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="flex-1 min-w-0 bg-surface border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gulf-orange/50"
                  onKeyDown={(e) => e.key === "Enter" && handleSessionRename()}
                  autoFocus
                />
                <button
                  onClick={handleSessionRename}
                  className="px-3 py-2 rounded-lg bg-gulf-orange/10 text-gulf-orange text-xs font-medium hover:bg-gulf-orange/20 transition-colors shrink-0"
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
                className="flex items-center gap-2 text-foreground hover:text-gulf-orange transition-colors group min-w-0"
              >
                <h2 className={`font-display tracking-wider truncate ${isPanel ? "text-xl" : "text-3xl"}`}>
                  {session.name.toUpperCase()}
                </h2>
                <svg className="w-3.5 h-3.5 text-muted group-hover:text-gulf-orange transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleNewSession}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            title="New Session"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">New</span>
          </button>
        </div>

        {/* Add run form — stacked in panel mode */}
        <div className="glass rounded-xl border border-foreground/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gulf-orange" />
            <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Add Run</span>
          </div>

          {isPanel ? (
            // Stacked layout for panel
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Run name (optional)"
                className="w-full bg-surface border border-foreground/8 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-gulf-orange/50 transition-colors"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(""); }}
                  placeholder="YouTube URL or video ID"
                  className="flex-1 min-w-0 bg-surface border border-foreground/8 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-gulf-orange/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleAddRun()}
                />
                <button
                  onClick={handleAddRun}
                  disabled={!url}
                  className="px-3 py-2 rounded-lg bg-gulf-orange text-white text-sm font-semibold hover:bg-gulf-orange-glow disabled:opacity-30 disabled:cursor-not-allowed transition-all btn-tactile shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            // Side-by-side layout for full page
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Run name"
                className="w-28 sm:w-36 bg-surface border border-foreground/8 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-gulf-orange/50 transition-colors"
              />
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                placeholder="YouTube URL or video ID"
                className="flex-1 bg-surface border border-foreground/8 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-gulf-orange/50 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleAddRun()}
              />
              <button
                onClick={handleAddRun}
                disabled={!url}
                className="px-4 py-2.5 rounded-lg bg-gulf-orange text-white text-sm font-semibold hover:bg-gulf-orange-glow disabled:opacity-30 disabled:cursor-not-allowed transition-all btn-tactile"
              >
                Add
              </button>
            </div>
          )}

          {previewId && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-elevated/50">
              <img src={getThumbnailUrl(previewId, "default")} alt="Preview" className="w-16 h-10 rounded object-cover" />
              <span className="text-xs font-mono text-muted">{previewId}</span>
            </div>
          )}

          {error && <p className="text-gulf-orange text-xs font-medium">{error}</p>}
        </div>

        {/* Runs list */}
        {session.runs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
                Runs ({session.runs.length})
              </span>
              <span className="text-[10px] text-subtle">
                {selectedRuns.length === 0
                  ? "Select 2 to compare"
                  : selectedRuns.length === 1
                  ? "Select 1 more"
                  : "Ready"}
              </span>
            </div>

            <div className="grid gap-1.5">
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

            {/* Compare buttons */}
            <div className="space-y-1.5">
              <button
                onClick={() => handleCompare(true)}
                disabled={selectedRuns.length !== 2}
                className={`w-full rounded-xl bg-gulf-orange text-white font-display tracking-wider uppercase hover:bg-gulf-orange-glow disabled:opacity-20 disabled:cursor-not-allowed transition-all btn-tactile glow-accent disabled:shadow-none ${
                  isPanel ? "py-2.5 text-base" : "py-3 text-xl"
                }`}
              >
                {selectedRuns.length === 2 ? "Set Launch & Compare" : "Select 2 Runs"}
              </button>
              {selectedRuns.length === 2 && (
                <button
                  onClick={() => handleCompare(false)}
                  className="w-full py-1.5 rounded-lg text-xs text-muted hover:text-foreground transition-colors"
                >
                  Skip sync — compare directly
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state — only on full page */}
        {session.runs.length === 0 && !isPanel && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-elevated mb-4">
              <svg className="w-8 h-8 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h3 className="font-display text-2xl text-foreground mb-1 tracking-wider">NO RUNS YET</h3>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Add YouTube videos of your autocross runs above to start comparing.
            </p>
          </div>
        )}
      </div>
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

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2.5 rounded-xl cursor-pointer transition-all ${
        compact ? "p-2" : "p-3 gap-3"
      } ${
        selected
          ? label === "A"
            ? "bg-gulf-blue/10 border border-gulf-blue/30"
            : "bg-gulf-orange/10 border border-gulf-orange/30"
          : "bg-surface border border-foreground/5 hover:border-foreground/10 hover:bg-surface-elevated"
      }`}
    >
      <div
        className={`shrink-0 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
          compact ? "w-6 h-6 text-[10px]" : "w-8 h-8"
        } ${
          label === "A"
            ? "bg-gulf-blue/20 text-gulf-blue"
            : label === "B"
            ? "bg-gulf-orange/20 text-gulf-orange"
            : "bg-surface-elevated text-subtle"
        }`}
      >
        {label || index + 1}
      </div>

      <img
        src={getThumbnailUrl(run.videoId, "default")}
        alt={run.name}
        className={`rounded object-cover shrink-0 ${compact ? "w-12 h-8" : "w-16 h-10"}`}
      />

      <div className="flex-1 min-w-0">
        <div className={`font-medium text-foreground truncate ${compact ? "text-xs" : "text-sm"}`}>{run.name}</div>
        {run.startOffset > 0 && (
          <div className="text-[10px] font-mono text-subtle">sync: {run.startOffset.toFixed(1)}s</div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="p-1 rounded text-subtle hover:text-gulf-orange hover:bg-gulf-orange/10 transition-colors shrink-0"
        aria-label="Remove"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
