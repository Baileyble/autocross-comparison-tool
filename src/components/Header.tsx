"use client";

import { useStore } from "@/lib/store";

export function Header() {
  const session = useStore((s) => s.session);
  const showLeftSidebar = useStore((s) => s.showLeftSidebar);
  const setShowLeftSidebar = useStore((s) => s.setShowLeftSidebar);
  const showRightSidebar = useStore((s) => s.showRightSidebar);
  const setShowRightSidebar = useStore((s) => s.setShowRightSidebar);
  const setShowShare = useStore((s) => s.setShowShare);
  const hasComparison = !!session.activeComparison;

  return (
    <header className="pw-header">
      {/* Left: sidebar toggle + logo */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          className="hidden md:flex pw-btn text-muted hover:text-foreground"
          aria-label="Toggle garage sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {showLeftSidebar ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            )}
          </svg>
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-4 bg-accent rounded-sm" />
          <div className="w-1.5 h-4 bg-run-b rounded-sm" />
        </div>
        <h1 className="text-sm font-bold tracking-wider text-foreground uppercase">
          Gridline
        </h1>
        <span className="text-[9px] tracking-[0.15em] text-muted uppercase hidden sm:inline">
          Pitwall
        </span>
      </div>

      {/* Center: session name */}
      <div className="flex-1 flex justify-center">
        {hasComparison && (
          <span className="text-[11px] text-muted font-mono truncate max-w-[200px]">
            {session.name}
          </span>
        )}
      </div>

      {/* Right: actions + sidebar toggle */}
      <div className="flex items-center gap-1">
        {hasComparison && (
          <button
            onClick={() => setShowShare(true)}
            className="pw-btn text-muted hover:text-foreground"
            aria-label="Share"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          </button>
        )}
        {session.runs.length > 0 && (
          <span className="text-[10px] font-mono text-accent px-1">
            {session.runs.length} run{session.runs.length !== 1 ? "s" : ""}
          </span>
        )}
        {hasComparison && (
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="hidden md:flex pw-btn text-muted hover:text-foreground"
            aria-label="Toggle data panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {showRightSidebar ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M12 12h8.25M3.75 17.25h16.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
