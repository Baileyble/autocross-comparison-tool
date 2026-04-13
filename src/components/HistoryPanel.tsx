"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import type { Session } from "@/types";

export function HistoryPanel() {
  const loadFromHistory = useStore((s) => s.loadFromHistory);
  const clearHistory = useStore((s) => s.clearHistory);
  const getHistory = useStore((s) => s.getHistory);
  const currentSessionId = useStore((s) => s.session.id);

  const [history, setHistory] = useState<Session[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
  }, [getHistory]);

  const otherSessions = history.filter((s) => s.id !== currentSessionId);

  if (otherSessions.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="uppercase tracking-wider font-medium">Recent Sessions ({otherSessions.length})</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 animate-slide-up">
          {otherSessions.slice(0, 10).map((session) => (
            <button
              key={session.id}
              onClick={() => {
                loadFromHistory(session.id);
                setHistory(getHistory());
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface border border-white/5 hover:border-white/10 hover:bg-surface-elevated transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{session.name}</div>
                <div className="text-xs text-subtle">
                  {session.runs.length} run{session.runs.length !== 1 ? "s" : ""} &middot;{" "}
                  {new Date(session.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <svg className="w-4 h-4 text-subtle shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}

          <button
            onClick={() => {
              clearHistory();
              setHistory([]);
            }}
            className="text-xs text-subtle hover:text-accent transition-colors mt-2"
          >
            Clear history
          </button>
        </div>
      )}
    </div>
  );
}
