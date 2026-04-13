"use client";

import { useStore } from "@/lib/store";

export function Header() {
  const session = useStore((s) => s.session);
  const showGarage = useStore((s) => s.showGarage);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const setShowShare = useStore((s) => s.setShowShare);
  const hasComparison = !!session.activeComparison;

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-6 bg-accent rounded-sm" />
            <div className="w-2 h-6 bg-amber rounded-sm" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-wide leading-none text-foreground">
              GRIDLINE
            </h1>
            <span className="text-[10px] tracking-[0.2em] text-muted uppercase">
              Autocross Analysis
            </span>
          </div>
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showGarage
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 0 0-.879-2.121L16.5 8.25l-2.25-3H6.75L4.5 8.25l-2.004 3.753A3 3 0 0 0 1.5 14.25v3.375" />
            </svg>
            <span className="hidden sm:inline">Garage</span>
            {session.runs.length > 0 && (
              <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">
                {session.runs.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
