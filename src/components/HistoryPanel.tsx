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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors font-medium"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="font-semibold">Recent Sessions</span>
        <span className="text-xs text-subtle font-mono">({otherSessions.length})</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 animate-slide-up">
          {otherSessions.slice(0, 10).map((session) => (
            <button
              key={session.id}
              onClick={() => {
                loadFromHistory(session.id);
                setHistory(getHistory());
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl card hover:bg-surface-elevated transition-all text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{session.name}</div>
                <div className="text-xs text-subtle mt-0.5">
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
            className="text-xs text-subtle hover:text-accent transition-colors font-medium mt-1"
          >
            Clear history
          </button>
        </div>
      )}
    </div>
  );
}
