"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Run, Session, Annotation, AnnotationColor, PlayerState } from "@/types";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function emptySession(name = "New Session"): Session {
  return {
    id: generateId(),
    name,
    runs: [],
    activeComparison: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export type View = "garage" | "compare";
export type SyncTarget = "A" | "B" | null;

interface AppState {
  // Persisted
  session: Session;
  history: Session[];
  /** Launch points remembered per YouTube video ID — sync once, keep forever. */
  syncPoints: Record<string, number>;

  // UI (ephemeral)
  view: View;
  syncTarget: SyncTarget;
  showRunPanel: boolean;
  showShare: boolean;
  showShortcuts: boolean;

  // Playback (ephemeral)
  isPlaying: boolean;
  playbackSpeed: number;
  playerStates: Record<string, PlayerState>;

  // Session actions
  renameSession: (name: string) => void;
  newSession: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearHistory: () => void;

  // Run actions
  addRun: (input: { name: string; youtubeUrl: string; videoId: string }) => void;
  updateRun: (id: string, updates: Partial<Run>) => void;
  removeRun: (id: string) => void;
  setLaunchPoint: (runId: string, time: number) => void;
  adjustOffset: (runId: string, delta: number) => void;

  // Comparison actions
  startComparison: (runAId: string, runBId: string, withSync: boolean) => void;
  swapRuns: () => void;

  // UI actions
  setView: (view: View) => void;
  setSyncTarget: (target: SyncTarget) => void;
  setShowRunPanel: (show: boolean) => void;
  setShowShare: (show: boolean) => void;
  setShowShortcuts: (show: boolean) => void;

  // Playback actions
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlayerState: (runId: string, state: Partial<PlayerState>) => void;

  // Annotations
  addAnnotation: (runId: string, time: number, label: string, color: AnnotationColor) => void;
  removeAnnotation: (runId: string, annotationId: string) => void;
}

const DEFAULT_PLAYER_STATE: PlayerState = {
  status: "idle",
  currentTime: 0,
  duration: 0,
  elapsed: 0,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      session: emptySession(),
      history: [],
      syncPoints: {},

      view: "garage",
      syncTarget: null,
      showRunPanel: false,
      showShare: false,
      showShortcuts: false,

      isPlaying: false,
      playbackSpeed: 1,
      playerStates: {},

      renameSession: (name) =>
        set((s) => ({ session: { ...s.session, name, updatedAt: Date.now() } })),

      newSession: () =>
        set((s) => ({
          session: emptySession(),
          history:
            s.session.runs.length > 0
              ? [s.session, ...s.history.filter((h) => h.id !== s.session.id)].slice(0, 30)
              : s.history,
          view: "garage",
          syncTarget: null,
          isPlaying: false,
          playerStates: {},
        })),

      loadSession: (sessionId) =>
        set((s) => {
          const target = s.history.find((h) => h.id === sessionId);
          if (!target) return s;
          const history = s.history.filter((h) => h.id !== sessionId);
          if (s.session.runs.length > 0) history.unshift(s.session);
          return {
            session: { ...target, activeComparison: null },
            history: history.slice(0, 30),
            view: "garage",
            syncTarget: null,
            isPlaying: false,
            playerStates: {},
          };
        }),

      deleteSession: (sessionId) =>
        set((s) => ({ history: s.history.filter((h) => h.id !== sessionId) })),

      clearHistory: () => set({ history: [] }),

      addRun: ({ name, youtubeUrl, videoId }) =>
        set((s) => {
          const run: Run = {
            id: generateId(),
            name,
            youtubeUrl,
            videoId,
            // Apply remembered launch point for this video if we have one
            startOffset: s.syncPoints[videoId] ?? 0,
            notes: "",
            metadata: {},
            annotations: [],
            createdAt: Date.now(),
          };
          return {
            session: {
              ...s.session,
              runs: [...s.session.runs, run],
              updatedAt: Date.now(),
            },
          };
        }),

      updateRun: (id, updates) =>
        set((s) => ({
          session: {
            ...s.session,
            runs: s.session.runs.map((r) => (r.id === id ? { ...r, ...updates } : r)),
            updatedAt: Date.now(),
          },
        })),

      removeRun: (id) =>
        set((s) => {
          const runs = s.session.runs.filter((r) => r.id !== id);
          let activeComparison = s.session.activeComparison;
          if (activeComparison && activeComparison.includes(id)) activeComparison = null;
          return {
            session: { ...s.session, runs, activeComparison, updatedAt: Date.now() },
          };
        }),

      setLaunchPoint: (runId, time) =>
        set((s) => {
          const run = s.session.runs.find((r) => r.id === runId);
          if (!run) return s;
          return {
            session: {
              ...s.session,
              runs: s.session.runs.map((r) =>
                r.id === runId ? { ...r, startOffset: time } : r
              ),
              updatedAt: Date.now(),
            },
            syncPoints: { ...s.syncPoints, [run.videoId]: time },
          };
        }),

      adjustOffset: (runId, delta) => {
        const run = get().session.runs.find((r) => r.id === runId);
        if (!run) return;
        get().setLaunchPoint(runId, Math.max(0, run.startOffset + delta));
      },

      startComparison: (runAId, runBId, withSync) =>
        set((s) => ({
          session: {
            ...s.session,
            activeComparison: [runAId, runBId],
            updatedAt: Date.now(),
          },
          view: "compare",
          syncTarget: withSync ? "A" : null,
          showRunPanel: false,
          isPlaying: false,
        })),

      swapRuns: () =>
        set((s) => {
          const ac = s.session.activeComparison;
          if (!ac) return s;
          return {
            session: {
              ...s.session,
              activeComparison: [ac[1], ac[0]],
              updatedAt: Date.now(),
            },
          };
        }),

      setView: (view) => set({ view }),
      setSyncTarget: (syncTarget) => set({ syncTarget }),
      setShowRunPanel: (showRunPanel) => set({ showRunPanel }),
      setShowShare: (showShare) => set({ showShare }),
      setShowShortcuts: (showShortcuts) => set({ showShortcuts }),

      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      setPlayerState: (runId, state) =>
        set((s) => ({
          playerStates: {
            ...s.playerStates,
            [runId]: { ...(s.playerStates[runId] || DEFAULT_PLAYER_STATE), ...state },
          },
        })),

      addAnnotation: (runId, time, label, color) => {
        const annotation: Annotation = { id: generateId(), time, label, color };
        set((s) => ({
          session: {
            ...s.session,
            runs: s.session.runs.map((r) =>
              r.id === runId ? { ...r, annotations: [...r.annotations, annotation] } : r
            ),
            updatedAt: Date.now(),
          },
        }));
      },

      removeAnnotation: (runId, annotationId) =>
        set((s) => ({
          session: {
            ...s.session,
            runs: s.session.runs.map((r) =>
              r.id === runId
                ? { ...r, annotations: r.annotations.filter((a) => a.id !== annotationId) }
                : r
            ),
            updatedAt: Date.now(),
          },
        })),
    }),
    {
      name: "racecompare-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        session: s.session,
        history: s.history,
        syncPoints: s.syncPoints,
      }),
    }
  )
);
