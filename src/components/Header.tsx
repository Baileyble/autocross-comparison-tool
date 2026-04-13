"use client";

import { useStore } from "@/lib/store";

export function Header() {
  const session = useStore((s) => s.session);
  const showGarage = useStore((s) => s.showGarage);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const setShowShare = useStore((s) => s.setShowShare);
  const setShowRunPanel = useStore((s) => s.setShowRunPanel);
  const createSession = useStore((s) => s.createSession);
  const saveToHistory = useStore((s) => s.saveToHistory);
  const hasComparison = !!session.activeComparison;

  const handleNewSession = () => {
    saveToHistory();
    createSession();
    setShowGarage(true);
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-foreground/5">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-6 bg-gulf-blue rounded-sm" />
            <div className="w-2 h-6 bg-gulf-orange rounded-sm" />
          </div>
          <div>
            <h1 className="font-display text-2xl leading-none text-foreground tracking-wider">
              GRIDLINE
            </h1>
            <span className="text-[9px] tracking-[0.2em] text-muted uppercase">
              Autocross Analysis
            </span>
          </div>
        </div>

        {/* Center — Session name */}
        {hasComparison && !showGarage && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted">
            <span className="truncate max-w-[200px]">{session.name}</span>
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {hasComparison && !showGarage && (
            <>
              <button
                onClick={() => setShowShare(true)}
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                aria-label="Share"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                </svg>
              </button>
              <button
                onClick={() => setShowRunPanel(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                <span className="hidden sm:inline">Runs</span>
                <span className="bg-gulf-orange/20 text-gulf-orange text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                  {session.runs.length}
                </span>
              </button>
              <button
                onClick={handleNewSession}
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                aria-label="New session"
                title="New Session"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </>
          )}
          {showGarage && (
            <div className="text-[10px] text-muted font-mono">
              {session.runs.length} run{session.runs.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
