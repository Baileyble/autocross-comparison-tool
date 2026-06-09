"use client";

import { useStore } from "@/lib/store";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Space", action: "Play / pause both runs" },
  { keys: "R", action: "Restart both runs" },
  { keys: "J / L", action: "Seek back / forward 5s" },
  { keys: "[ / ]", action: "Nudge Run A launch ±0.1s (Shift = ±1s)" },
  { keys: "; / '", action: "Nudge Run B launch ±0.1s (Shift = ±1s)" },
  { keys: "?", action: "Show this panel" },
];

export function ShortcutsModal() {
  const show = useStore((s) => s.showShortcuts);
  const setShow = useStore((s) => s.setShowShortcuts);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => setShow(false)} />
      <div className="relative panel p-5 w-full max-w-sm animate-rise">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold tracking-tight">Keyboard shortcuts</h3>
          <button
            onClick={() => setShow(false)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-2.5">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4">
              <kbd className="px-2 py-1 rounded-md bg-elevated font-mono text-[11px] text-foreground shrink-0">
                {s.keys}
              </kbd>
              <span className="text-xs text-muted text-right">{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
