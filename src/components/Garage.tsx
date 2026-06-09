"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { extractVideoId, getThumbnailUrl } from "@/lib/youtube";
import type { Run } from "@/types";

export function Garage({ isPanel = false }: { isPanel?: boolean }) {
  const session = useStore((s) => s.session);
  const syncPoints = useStore((s) => s.syncPoints);
  const addRun = useStore((s) => s.addRun);
  const removeRun = useStore((s) => s.removeRun);
  const startComparison = useStore((s) => s.startComparison);
  const renameSession = useStore((s) => s.renameSession);

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(session.name);

  const previewId = useMemo(() => (url ? extractVideoId(url) : null), [url]);

  const selectedRuns = selected
    .map((id) => session.runs.find((r) => r.id === id))
    .filter(Boolean) as Run[];

  const bothSynced =
    selectedRuns.length === 2 &&
    selectedRuns.every((r) => syncPoints[r.videoId] !== undefined);

  const handleAdd = () => {
    setError("");
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError("That doesn't look like a YouTube URL or video ID.");
      return;
    }
    addRun({
      name: name.trim() || `Run ${session.runs.length + 1}`,
      youtubeUrl: url.trim(),
      videoId,
    });
    setUrl("");
    setName("");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const compare = (withSync: boolean) => {
    if (selected.length === 2) startComparison(selected[0], selected[1], withSync);
  };

  return (
    <div className={`animate-rise ${isPanel ? "" : "pb-28"}`}>
      <div className={`${isPanel ? "" : "max-w-2xl mx-auto"} px-4 sm:px-6 py-6 space-y-5`}>
        {/* Session name */}
        {!isPanel && (
          <div className="flex items-center gap-2 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renameSession(draftName.trim() || "New Session");
                      setEditingName(false);
                    }
                  }}
                  className="flex-1 min-w-0 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime/50"
                  autoFocus
                />
                <button
                  onClick={() => {
                    renameSession(draftName.trim() || "New Session");
                    setEditingName(false);
                  }}
                  className="px-3 py-2 rounded-lg bg-lime/10 text-lime text-xs font-bold shrink-0"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDraftName(session.name);
                  setEditingName(true);
                }}
                className="group flex items-center gap-2 min-w-0"
              >
                <h2 className="text-2xl font-extrabold tracking-tight truncate">{session.name}</h2>
                <svg className="w-4 h-4 text-subtle group-hover:text-lime transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Add run */}
        <div className="panel p-4 space-y-3">
          <div className="label-micro">Add run</div>
          <div className={isPanel ? "space-y-2" : "flex gap-2"}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Run name"
              className={`bg-elevated border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm placeholder:text-subtle focus:outline-none focus:border-lime/40 transition-colors ${
                isPanel ? "w-full" : "w-28 sm:w-36"
              }`}
            />
            <div className={`flex gap-2 ${isPanel ? "" : "flex-1"}`}>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Paste a YouTube link"
                className="flex-1 min-w-0 bg-elevated border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm placeholder:text-subtle focus:outline-none focus:border-lime/40 transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={!url}
                className="px-4 py-2.5 rounded-lg bg-lime text-background text-sm font-bold hover:bg-lime-bright disabled:opacity-25 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                Add
              </button>
            </div>
          </div>

          {previewId && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-elevated animate-fade">
              <img
                src={getThumbnailUrl(previewId, "default")}
                alt="Video preview"
                className="w-16 h-10 rounded object-cover"
              />
              <span className="text-xs font-mono text-muted">{previewId}</span>
              {syncPoints[previewId] !== undefined && (
                <span className="text-[10px] font-mono text-lime">
                  sync remembered · {syncPoints[previewId].toFixed(1)}s
                </span>
              )}
            </div>
          )}

          {error && <p className="text-bad text-xs font-medium">{error}</p>}
        </div>

        {/* Run list */}
        {session.runs.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-micro">Runs · {session.runs.length}</span>
              <span className="text-xs text-subtle">
                {selected.length === 0
                  ? "Pick two to compare"
                  : selected.length === 1
                  ? "Pick one more"
                  : "Ready"}
              </span>
            </div>
            <div className="space-y-2">
              {session.runs.map((run, i) => (
                <RunCard
                  key={run.id}
                  run={run}
                  index={i}
                  compact={isPanel}
                  synced={syncPoints[run.videoId] !== undefined}
                  slot={selected.indexOf(run.id)}
                  onSelect={() => toggleSelect(run.id)}
                  onRemove={() => removeRun(run.id)}
                />
              ))}
            </div>

            {/* Inline actions in panel mode */}
            {isPanel && selected.length === 2 && (
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => compare(!bothSynced)}
                  className="w-full py-3 rounded-xl bg-lime text-background font-bold text-sm hover:bg-lime-bright transition-colors"
                >
                  {bothSynced ? "Compare" : "Sync & compare"}
                </button>
                <button
                  onClick={() => compare(bothSynced)}
                  className="w-full py-2 rounded-lg text-xs text-muted hover:text-foreground transition-colors"
                >
                  {bothSynced ? "Re-sync first" : "Compare without syncing"}
                </button>
              </div>
            )}
          </div>
        ) : (
          !isPanel && (
            <div className="text-center py-14">
              <div className="text-5xl mb-4">🏁</div>
              <h3 className="text-lg font-extrabold tracking-tight mb-1">No runs yet</h3>
              <p className="text-sm text-muted max-w-xs mx-auto">
                Paste YouTube links of your runs above. Pick any two to line them up side by side.
              </p>
            </div>
          )
        )}
      </div>

      {/* Bottom action bar — full-page mode only */}
      {!isPanel && selected.length === 2 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-background/90 backdrop-blur-md border-t border-white/[0.07] animate-rise">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <div className="hidden sm:block text-xs text-muted min-w-0 flex-1">
              <span className="text-run-a font-semibold">{selectedRuns[0]?.name}</span>
              <span className="text-subtle"> vs </span>
              <span className="text-run-b font-semibold">{selectedRuns[1]?.name}</span>
            </div>
            <button
              onClick={() => compare(bothSynced)}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-muted hover:text-foreground hover:bg-hover transition-colors"
            >
              {bothSynced ? "Re-sync first" : "Skip sync"}
            </button>
            <button
              onClick={() => compare(!bothSynced)}
              className="flex-1 sm:flex-none sm:px-8 py-3 rounded-xl bg-lime text-background font-bold text-sm hover:bg-lime-bright transition-colors"
            >
              {bothSynced ? "Compare" : "Sync & compare"}
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
  synced,
  slot,
  onSelect,
  onRemove,
}: {
  run: Run;
  index: number;
  compact: boolean;
  synced: boolean;
  slot: number; // -1 unselected, 0 = A, 1 = B
  onSelect: () => void;
  onRemove: () => void;
}) {
  const label = slot === 0 ? "A" : slot === 1 ? "B" : null;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl cursor-pointer transition-all border ${
        compact ? "p-2.5" : "p-3"
      } ${
        label === "A"
          ? "bg-run-a/[0.07] border-run-a/40"
          : label === "B"
          ? "bg-run-b/[0.07] border-run-b/40"
          : "bg-surface border-white/[0.06] hover:border-white/[0.14]"
      }`}
    >
      <div
        className={`shrink-0 rounded-lg flex items-center justify-center font-mono font-bold ${
          compact ? "w-7 h-7 text-[11px]" : "w-9 h-9 text-xs"
        } ${
          label === "A"
            ? "bg-run-a/20 text-run-a"
            : label === "B"
            ? "bg-run-b/20 text-run-b"
            : "bg-elevated text-subtle"
        }`}
      >
        {label ?? index + 1}
      </div>

      <img
        src={getThumbnailUrl(run.videoId, "default")}
        alt=""
        className={`rounded-md object-cover shrink-0 ${compact ? "w-14 h-9" : "w-18 h-11"}`}
      />

      <div className="flex-1 min-w-0">
        <div className={`font-semibold truncate ${compact ? "text-xs" : "text-sm"}`}>
          {run.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {synced ? (
            <span className="text-[10px] font-mono text-lime">
              SYNCED {run.startOffset.toFixed(1)}s
            </span>
          ) : (
            <span className="text-[10px] font-mono text-subtle">NOT SYNCED</span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1.5 rounded-lg text-subtle hover:text-bad hover:bg-bad/10 transition-colors shrink-0"
        aria-label={`Remove ${run.name}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
