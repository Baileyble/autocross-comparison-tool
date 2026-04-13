"use client";

import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Garage } from "@/components/Garage";
import { ComparisonView } from "@/components/ComparisonView";
import { SyncSetup } from "@/components/SyncSetup";
import { ShareModal } from "@/components/ShareModal";
import { HistoryPanel } from "@/components/HistoryPanel";
import { useStore } from "@/lib/store";
import { extractVideoId } from "@/lib/youtube";

export default function Home() {
  const session = useStore((s) => s.session);
  const showGarage = useStore((s) => s.showGarage);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const addRun = useStore((s) => s.addRun);
  const setActiveComparison = useStore((s) => s.setActiveComparison);
  const syncSetupMode = useStore((s) => s.syncSetupMode);

  // Load from URL params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const v1 = params.get("v1");
    const v2 = params.get("v2");

    if (v1 && v2) {
      const id1 = extractVideoId(v1);
      const id2 = extractVideoId(v2);
      if (!id1 || !id2) return;

      const t1 = parseFloat(params.get("t1") || "0") || 0;
      const t2 = parseFloat(params.get("t2") || "0") || 0;
      const n1 = params.get("n1") || "Run A";
      const n2 = params.get("n2") || "Run B";

      // Only auto-load if we have no runs yet
      if (session.runs.length === 0) {
        addRun({ name: n1, youtubeUrl: v1, videoId: id1, startOffset: t1, notes: "", metadata: {} });
        addRun({ name: n2, youtubeUrl: v2, videoId: id2, startOffset: t2, notes: "", metadata: {} });

        setTimeout(() => {
          const runs = useStore.getState().session.runs;
          if (runs.length >= 2) {
            setActiveComparison(runs[0].id, runs[1].id);
            setShowGarage(false);
          }
        }, 50);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasComparison = !!session.activeComparison;
  const inSyncSetup = syncSetupMode !== "off";

  return (
    <>
      {/* Floating header pill */}
      <Header />

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* Sync Setup takes over the whole screen */}
        {inSyncSetup && <SyncSetup />}

        {/* Comparison view — immersive, fills screen */}
        {hasComparison && !showGarage && !inSyncSetup && <ComparisonView />}

        {/* Empty state when no comparison active and garage closed */}
        {!showGarage && !hasComparison && !inSyncSetup && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-4 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-elevated">
                <svg className="w-8 h-8 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground mb-1">No comparison loaded</h2>
                <p className="text-sm text-muted">Tap the Gridline pill to open the Garage.</p>
              </div>
              <button
                onClick={() => setShowGarage(true)}
                className="px-6 py-2.5 rounded-xl bg-accent text-white font-semibold hover:bg-accent-glow transition-all glow-accent"
              >
                Open Garage
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Garage overlay — rendered above everything except sync setup */}
      {showGarage && !inSyncSetup && (
        <>
          <Garage />
          <div className="fixed bottom-4 left-0 right-0 z-30 px-4">
            <div className="max-w-md mx-auto">
              <HistoryPanel />
            </div>
          </div>
        </>
      )}

      <ShareModal />
    </>
  );
}
