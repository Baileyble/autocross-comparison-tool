"use client";

import { useStore } from "@/lib/store";

export function Header() {
  const session = useStore((s) => s.session);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setShowShare = useStore((s) => s.setShowShare);
  const setShowRunPanel = useStore((s) => s.setShowRunPanel);
  const newSession = useStore((s) => s.newSession);

  const inCompare = view === "compare";
  const canResume = view === "garage" && !!session.activeComparison;

  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left: back + wordmark */}
        <div className="flex items-center gap-3 min-w-0">
          {inCompare && (
            <button
              onClick={() => setView("garage")}
              className="flex items-center gap-1.5 -ml-1 px-1 text-muted hover:text-foreground transition-colors"
              aria-label="Back to garage"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <div className="flex items-baseline gap-0.5 select-none">
            <span className="font-extrabold tracking-tight text-foreground">RACE</span>
            <span className="font-extrabold tracking-tight text-lime">{"//"}</span>
            <span className="font-extrabold tracking-tight text-foreground">COMPARE</span>
          </div>
          {inCompare && (
            <span className="hidden md:block text-sm text-subtle truncate">
              {session.name}
            </span>
          )}
        </div>

        {/* Right: contextual actions */}
        <div className="flex items-center gap-1">
          {inCompare ? (
            <>
              <button
                onClick={() => setShowShare(true)}
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-hover transition-colors"
                aria-label="Share comparison"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                </svg>
              </button>
              <button
                onClick={() => setShowRunPanel(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-muted hover:text-foreground hover:bg-hover transition-colors"
              >
                Runs
                <span className="font-mono text-[10px] bg-elevated px-1.5 py-0.5 rounded-full text-muted">
                  {session.runs.length}
                </span>
              </button>
            </>
          ) : (
            <>
              {canResume && (
                <button
                  onClick={() => setView("compare")}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-lime hover:bg-lime/10 transition-colors"
                >
                  Resume
                </button>
              )}
              <button
                onClick={newSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-muted hover:text-foreground hover:bg-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="hidden sm:inline">New session</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
