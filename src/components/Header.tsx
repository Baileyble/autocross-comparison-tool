"use client";

import { useStore } from "@/lib/store";

export function Header() {
  const session = useStore((s) => s.session);
  const showGarage = useStore((s) => s.showGarage);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const setShowShare = useStore((s) => s.setShowShare);
  const hasComparison = !!session.activeComparison;

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-surface-elevated">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-sm font-medium tracking-widest text-foreground">
            GRIDLINE
          </h1>
        </div>

        {/* Center — Session name */}
        {hasComparison && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
            </svg>
            <span className="truncate max-w-[200px]">{session.name}</span>
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {hasComparison && (
            <button
              onClick={() => setShowShare(true)}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              aria-label="Share"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowGarage(!showGarage)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors duration-200 ${
              showGarage
                ? "bg-surface-elevated text-foreground border border-subtle/30"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <span className="hidden sm:inline">Garage</span>
            {session.runs.length > 0 && (
              <span className="text-subtle text-xs font-mono">
                {session.runs.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
