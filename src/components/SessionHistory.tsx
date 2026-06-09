"use client";

import { useStore } from "@/lib/store";

export function SessionHistory() {
  const history = useStore((s) => s.history);
  const loadSession = useStore((s) => s.loadSession);
  const deleteSession = useStore((s) => s.deleteSession);
  const clearHistory = useStore((s) => s.clearHistory);

  if (history.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pb-32">
      <div className="flex items-center justify-between mb-2">
        <span className="label-micro">Previous sessions · {history.length}</span>
        <button
          onClick={clearHistory}
          className="text-[11px] text-subtle hover:text-bad transition-colors"
        >
          Clear all
        </button>
      </div>
      <div className="space-y-2">
        {history.slice(0, 10).map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 p-3 rounded-xl panel hover:bg-elevated transition-colors group"
          >
            <button
              onClick={() => loadSession(s.id)}
              className="flex-1 min-w-0 flex items-center gap-3 text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-elevated flex items-center justify-center shrink-0 font-mono text-xs text-subtle">
                {s.runs.length}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{s.name}</div>
                <div className="text-[11px] text-subtle">
                  {s.runs.length} run{s.runs.length !== 1 ? "s" : ""} ·{" "}
                  {new Date(s.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </button>
            <button
              onClick={() => deleteSession(s.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-subtle hover:text-bad hover:bg-bad/10 transition-all shrink-0"
              aria-label={`Delete session ${s.name}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
