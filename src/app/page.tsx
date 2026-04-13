"use client";

import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Garage } from "@/components/Garage";
import { ComparisonView } from "@/components/ComparisonView";
import { ShareModal } from "@/components/ShareModal";
import { SyncSetup } from "@/components/SyncSetup";
import { Sidebar } from "@/components/Sidebar";
import { DataPanel } from "@/components/DataPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { useStore } from "@/lib/store";
import { extractVideoId } from "@/lib/youtube";

export default function Home() {
  const session = useStore((s) => s.session);
  const addRun = useStore((s) => s.addRun);
  const setActiveComparison = useStore((s) => s.setActiveComparison);
  const setShowGarage = useStore((s) => s.setShowGarage);
  const showLeftSidebar = useStore((s) => s.showLeftSidebar);
  const setShowLeftSidebar = useStore((s) => s.setShowLeftSidebar);
  const showRightSidebar = useStore((s) => s.showRightSidebar);
  const setShowRightSidebar = useStore((s) => s.setShowRightSidebar);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const hasComparison = !!session.activeComparison;

  const runA = hasComparison ? session.runs.find((r) => r.id === session.activeComparison![0]) : null;
  const runB = hasComparison ? session.runs.find((r) => r.id === session.activeComparison![1]) : null;

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
            setActiveTab("compare");
          }
        }, 50);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header />

      <div className="pitwall-layout">
        {/* Left Sidebar — Garage / Runs (desktop) */}
        <Sidebar side="left" show={showLeftSidebar} onToggle={() => setShowLeftSidebar(!showLeftSidebar)}>
          <div className="p-3 pw-border-b">
            <div className="section-label">Garage</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Garage />
            <HistoryPanel />
          </div>
        </Sidebar>

        {/* Center Area */}
        <div className="pitwall-center">
          {/* Desktop: always show compare if active, else empty state */}
          <div className="hidden md:flex flex-col flex-1">
            {hasComparison && runA && runB ? (
              <ComparisonView />
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-surface-elevated">
                    <svg className="w-8 h-8 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground mb-1">No comparison loaded</h2>
                    <p className="text-xs text-muted">Select 2 runs from the sidebar to compare.</p>
                  </div>
                  {!showLeftSidebar && (
                    <button
                      onClick={() => setShowLeftSidebar(true)}
                      className="pw-btn pw-btn-accent"
                    >
                      Open Garage
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile: tab-based content */}
          <div className="md:hidden flex-1 overflow-y-auto">
            {activeTab === "runs" && (
              <div className="mobile-panel">
                <div className="p-3 pw-border-b">
                  <div className="section-label">Garage</div>
                </div>
                <Garage />
                <HistoryPanel />
              </div>
            )}
            {activeTab === "compare" && (
              <div className="mobile-panel">
                {hasComparison && runA && runB ? (
                  <ComparisonView />
                ) : (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                      <p className="text-sm text-muted">Select 2 runs from the Runs tab to compare.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === "data" && (
              <div className="mobile-panel">
                {hasComparison && runA && runB ? (
                  <DataPanel runA={runA} runB={runB} />
                ) : (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <p className="text-sm text-muted">Start a comparison to see data.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar — Data Panel (desktop) */}
        {hasComparison && runA && runB && (
          <Sidebar side="right" show={showRightSidebar} onToggle={() => setShowRightSidebar(!showRightSidebar)}>
            <DataPanel runA={runA} runB={runB} />
          </Sidebar>
        )}
      </div>

      {/* Mobile tab bar */}
      <div className="mobile-tab-bar">
        <button
          onClick={() => setActiveTab("runs")}
          className={activeTab === "runs" ? "active" : ""}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 0 0-.879-2.121L16.5 8.25l-2.25-3H6.75L4.5 8.25l-2.004 3.753A3 3 0 0 0 1.5 14.25v3.375" />
          </svg>
          Runs
        </button>
        <button
          onClick={() => setActiveTab("compare")}
          className={activeTab === "compare" ? "active" : ""}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
          </svg>
          Compare
        </button>
        <button
          onClick={() => setActiveTab("data")}
          className={activeTab === "data" ? "active" : ""}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          Data
        </button>
      </div>

      <ShareModal />
      <SyncSetup />
    </>
  );
}
