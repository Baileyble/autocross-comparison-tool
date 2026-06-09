"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Garage } from "@/components/Garage";
import { ComparisonView } from "@/components/ComparisonView";
import { SyncWizard } from "@/components/SyncWizard";
import { SharePanel } from "@/components/SharePanel";
import { SessionHistory } from "@/components/SessionHistory";
import { useStore } from "@/lib/store";
import { extractVideoId } from "@/lib/youtube";

export default function Home() {
  const [hydrated, setHydrated] = useState(false);

  const view = useStore((s) => s.view);
  const syncTarget = useStore((s) => s.syncTarget);
  const showRunPanel = useStore((s) => s.showRunPanel);
  const setShowRunPanel = useStore((s) => s.setShowRunPanel);

  // Rehydrate persisted state, then handle share-link params
  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).then(() => {
      const params = new URLSearchParams(window.location.search);
      const v1 = params.get("v1");
      const v2 = params.get("v2");

      if (v1 && v2) {
        const id1 = extractVideoId(v1);
        const id2 = extractVideoId(v2);
        if (id1 && id2) {
          const t1 = parseFloat(params.get("t1") || "0") || 0;
          const t2 = parseFloat(params.get("t2") || "0") || 0;
          const store = useStore.getState();

          store.newSession();
          useStore.getState().renameSession("Shared comparison");
          useStore.getState().addRun({
            name: params.get("n1") || "Run A",
            youtubeUrl: v1,
            videoId: id1,
          });
          useStore.getState().addRun({
            name: params.get("n2") || "Run B",
            youtubeUrl: v2,
            videoId: id2,
          });

          const runs = useStore.getState().session.runs;
          if (runs.length >= 2) {
            useStore.getState().setLaunchPoint(runs[0].id, t1);
            useStore.getState().setLaunchPoint(runs[1].id, t2);
            useStore.getState().startComparison(runs[0].id, runs[1].id, false);
          }

          // Clean the URL so refreshes don't re-import
          window.history.replaceState({}, "", window.location.pathname);
        }
      }

      setHydrated(true);
    });
  }, []);

  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-baseline gap-0.5 animate-pulse select-none">
          <span className="font-extrabold tracking-tight text-foreground">RACE</span>
          <span className="font-extrabold tracking-tight text-lime">{"//"}</span>
          <span className="font-extrabold tracking-tight text-foreground">COMPARE</span>
        </div>
      </div>
    );
  }

  const inWizard = syncTarget !== null;

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col">
        {view === "garage" && (
          <>
            <Garage />
            <SessionHistory />
          </>
        )}
        {view === "compare" && !inWizard && <ComparisonView />}
      </main>

      <SyncWizard />
      <SharePanel />

      {/* Slide-out run panel for swapping mid-comparison */}
      <div
        className={`slide-backdrop ${showRunPanel ? "open" : ""}`}
        onClick={() => setShowRunPanel(false)}
      />
      <aside className={`slide-panel ${showRunPanel ? "open" : ""}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] sticky top-0 bg-background z-10">
          <h3 className="font-extrabold tracking-tight">Runs</h3>
          <button
            onClick={() => setShowRunPanel(false)}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-hover transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {showRunPanel && <Garage isPanel />}
      </aside>
    </>
  );
}
