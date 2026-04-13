"use client";

import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Garage } from "@/components/Garage";
import { ComparisonView } from "@/components/ComparisonView";
import { ShareModal } from "@/components/ShareModal";
import { HistoryPanel } from "@/components/HistoryPanel";
import { SyncSetup } from "@/components/SyncSetup";
import { useStore } from "@/lib/store";
import { extractVideoId } from "@/lib/youtube";

export default function Home() {
  const session = useStore((s) => s.session);
  const showGarage = useStore((s) => s.showGarage);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const addRun = useStore((s) => s.addRun);
  const setActiveComparison = useStore((s) => s.setActiveComparison);
  const showRunPanel = useStore((s) => s.showRunPanel);
  const setShowRunPanel = useStore((s) => s.setShowRunPanel);
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
  const showingSyncSetup = syncSetupMode !== "off";

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Garage view */}
        {showGarage && (
          <div className="flex-1">
            <Garage />
            <HistoryPanel />
          </div>
        )}

        {/* Comparison view */}
        {hasComparison && !showGarage && !showingSyncSetup && <ComparisonView />}

        {/* Empty state — when comparison was cleared but not in garage */}
        {!showGarage && !hasComparison && !showingSyncSetup && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-6 animate-fade-in">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-surface border border-white/5">
                <svg className="w-10 h-10 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-foreground tracking-tight">No comparison loaded</h2>
                <p className="text-sm text-muted mt-1">Head to the garage to add runs and start comparing.</p>
              </div>
              <button
                onClick={() => setShowGarage(true)}
                className="btn btn-primary px-8 py-3 text-sm font-semibold"
              >
                Open Garage
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Sync Setup overlay */}
      <SyncSetup />

      {/* Slide-out run panel for swapping during comparison */}
      <div
        className={`slide-panel-backdrop ${showRunPanel ? "open" : ""}`}
        onClick={() => setShowRunPanel(false)}
      />
      <div className={`slide-panel bg-background border-l border-white/5 ${showRunPanel ? "open" : ""}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-lg font-bold tracking-tight">Swap Runs</h3>
          <button
            onClick={() => setShowRunPanel(false)}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <Garage isPanel />
      </div>

      <ShareModal />
    </>
  );
}
