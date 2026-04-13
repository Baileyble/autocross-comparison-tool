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

  const handleSessionRename = () => {
    renameSession(sessionName);
    setEditingSession(false);
  };

  const maxWidth = isPanel ? "" : "max-w-2xl mx-auto";

  return (
    <div className="animate-slide-up">
      <div className={`${maxWidth} px-4 py-6 space-y-6`}>
        {/* Session header */}
        <div className="flex items-center gap-3">
          {editingSession ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="flex-1 bg-surface border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gulf-orange/50"
                onKeyDown={(e) => e.key === "Enter" && handleSessionRename()}
                autoFocus
              />
              <button
                onClick={handleSessionRename}
                className="px-3 py-2 rounded-lg bg-gulf-orange/10 text-gulf-orange text-sm font-medium hover:bg-gulf-orange/20 transition-colors"
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
              className="flex items-center gap-2 text-foreground hover:text-gulf-orange transition-colors group"
            >
              <h2 className="font-display text-3xl tracking-wider">{session.name.toUpperCase()}</h2>
              <svg className="w-4 h-4 text-muted group-hover:text-gulf-orange transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
            </button>
          )}
        </div>

        {/* Add run form */}
        <div className="glass rounded-xl border border-foreground/5 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gulf-orange" />
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Add Run</span>
          </div>

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
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
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

          {previewId && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-elevated/50">
              <img
                src={getThumbnailUrl(previewId, "default")}
                alt="Video thumbnail"
                className="w-20 h-12 rounded object-cover"
              />
              <span className="text-xs font-mono text-muted">{previewId}</span>
            </div>
          )}

          {error && <p className="text-gulf-orange text-xs font-medium">{error}</p>}
        </div>

        {/* Runs list */}
        {session.runs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">
                Runs ({session.runs.length})
              </span>
              <span className="text-xs text-subtle">
                {selectedRuns.length === 0
                  ? "Select 2 to compare"
                  : selectedRuns.length === 1
                  ? "Select 1 more"
                  : "Ready to compare"}
              </span>
            </div>

            <div className="grid gap-2">
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
            </div>

            {/* Compare buttons */}
            <div className="space-y-2">
              <button
                onClick={() => handleCompare(true)}
                disabled={selectedRuns.length !== 2}
                className="w-full py-3 rounded-xl bg-gulf-orange text-white font-display text-xl tracking-wider uppercase hover:bg-gulf-orange-glow disabled:opacity-20 disabled:cursor-not-allowed transition-all btn-tactile glow-accent disabled:shadow-none"
              >
                {selectedRuns.length === 2 ? "Set Launch Points & Compare" : "Select 2 Runs"}
              </button>
              {selectedRuns.length === 2 && (
                <button
                  onClick={() => handleCompare(false)}
                  className="w-full py-2 rounded-lg text-sm text-muted hover:text-foreground transition-colors"
                >
                  Skip sync — compare directly
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {session.runs.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-elevated mb-4">
              <svg className="w-8 h-8 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h3 className="font-display text-2xl text-foreground mb-1 tracking-wider">NO RUNS YET</h3>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Add YouTube videos of your autocross runs above to start comparing them side by side.
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
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
        selected
          ? label === "A"
            ? "bg-gulf-blue/10 border border-gulf-blue/30 glow-blue"
            : "bg-gulf-orange/10 border border-gulf-orange/30 glow-accent"
          : "bg-surface border border-foreground/5 hover:border-foreground/10 hover:bg-surface-elevated"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
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
        className="w-16 h-10 rounded object-cover shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{run.name}</div>
        <div className="text-xs font-mono text-subtle">{run.videoId}</div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1.5 rounded-lg text-subtle hover:text-gulf-orange hover:bg-gulf-orange/10 transition-colors shrink-0"
        aria-label="Remove run"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    </div>
  );
}
