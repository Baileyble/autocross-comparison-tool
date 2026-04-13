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
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Logo / Back */}
        <div className="flex items-center gap-3">
          {hasComparison && !showGarage ? (
            <button
              onClick={() => setShowGarage(true)}
              className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              <span className="text-sm font-medium hidden sm:inline">Garage</span>
            </button>
          ) : null}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <div className="w-1.5 h-5 bg-run-a rounded-sm" />
              <div className="w-1.5 h-5 bg-accent rounded-sm" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              Gridline
            </span>
          </div>
        </div>

        {/* Center: Session name (comparison view only) */}
        {hasComparison && !showGarage && (
          <div className="hidden sm:block text-sm text-muted font-medium truncate max-w-[240px]">
            {session.name}
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                <span className="hidden sm:inline">Runs</span>
                <span className="text-[10px] font-mono bg-surface-elevated px-1.5 py-0.5 rounded-full text-muted">
                  {session.runs.length}
                </span>
              </button>
            </>
          )}
          {showGarage && (
            <button
              onClick={handleNewSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              title="New Session"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">New Session</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
