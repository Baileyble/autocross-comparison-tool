"use client";

import { useStore } from "@/lib/store";

export function Header() {
  const session = useStore((s) => s.session);
  const showGarage = useStore((s) => s.showGarage);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const setShowShare = useStore((s) => s.setShowShare);
  const hasComparison = !!session.activeComparison;

  return (
    <>
      {/* Floating pill — top-left */}
      <div className="fixed top-3 left-3 z-50 flex items-center gap-2">
        <button
          onClick={() => setShowGarage(!showGarage)}
          className="cockpit-pill flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all hover:border-accent/30"
        >
          <div className="flex items-center gap-0.5">
            <div className="w-1.5 h-4 bg-accent rounded-sm" />
            <div className="w-1.5 h-4 bg-amber rounded-sm" />
          </div>
          <span className="font-display text-xs font-bold tracking-widest text-foreground/90">
            GRIDLINE
          </span>
          {session.runs.length > 0 && (
            <span className="bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none">
              {session.runs.length}
            </span>
          )}
        </button>
      </div>

      {/* Floating share button — top-right */}
      {hasComparison && (
        <div className="fixed top-3 right-3 z-50">
          <button
            onClick={() => setShowShare(true)}
            className="cockpit-pill p-2 rounded-full text-muted hover:text-foreground transition-colors"
            aria-label="Share"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
