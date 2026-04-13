"use client";

import { create } from "zustand";
import type { Run, Session, Annotation, AnnotationColor, PlayerState, PlayerStatus } from "@/types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

interface AppState {
  // Session
  session: Session;
  createSession: (name?: string) => void;
  renameSession: (name: string) => void;

  // Runs
  addRun: (run: Omit<Run, "id" | "createdAt" | "annotations">) => void;
  updateRun: (id: string, updates: Partial<Run>) => void;
  removeRun: (id: string) => void;

  // Comparison
  setActiveComparison: (runAId: string, runBId: string) => void;
  swapRuns: () => void;

  // Playback
  isPlaying: boolean;
  playbackSpeed: number;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;

  // Player states (per-run tracking)
  playerStates: Record<string, PlayerState>;
  setPlayerState: (runId: string, state: Partial<PlayerState>) => void;

  // Annotations
  addAnnotation: (runId: string, time: number, label: string, color: AnnotationColor) => void;
  removeAnnotation: (runId: string, annotationId: string) => void;

  // Tap-to-sync
  tapSyncMode: "off" | "runA" | "runB";
  setTapSyncMode: (mode: "off" | "runA" | "runB") => void;

  // Sync setup
  syncSetupMode: "off" | "runA" | "runB";
  setSyncSetupMode: (mode: "off" | "runA" | "runB") => void;

  // UI state
  showGarage: boolean;
  setShowGarage: (show: boolean) => void;
  showShare: boolean;
  setShowShare: (show: boolean) => void;
  overlayMode: boolean;
  setOverlayMode: (overlay: boolean) => void;
  showLeftSidebar: boolean;
  setShowLeftSidebar: (show: boolean) => void;
  showRightSidebar: boolean;
  setShowRightSidebar: (show: boolean) => void;
  activeTab: "runs" | "compare" | "data";
  setActiveTab: (tab: "runs" | "compare" | "data") => void;

  // History
  saveToHistory: () => void;
  loadFromHistory: (sessionId: string) => void;
  getHistory: () => Session[];
  clearHistory: () => void;
}

const DEFAULT_PLAYER_STATE: PlayerState = {
  status: "idle",
  currentTime: 0,
  duration: 0,
  elapsed: 0,
};

function createEmptySession(name?: string): Session {
  return {
    id: generateId(),
    name: name || "New Session",
    runs: [],
    activeComparison: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const useStore = create<AppState>((set, get) => ({
  session: createEmptySession(),

  createSession: (name) => {
    set({ session: createEmptySession(name), playerStates: {}, isPlaying: false });
  },

  renameSession: (name) => {
    set((s) => ({ session: { ...s.session, name, updatedAt: Date.now() } }));
  },

  addRun: (run) => {
    const newRun: Run = {
      ...run,
      id: generateId(),
      annotations: [],
      createdAt: Date.now(),
    };
    set((s) => ({
      session: {
        ...s.session,
        runs: [...s.session.runs, newRun],
        updatedAt: Date.now(),
      },
    }));
    return newRun;
  },

  updateRun: (id, updates) => {
    set((s) => ({
      session: {
        ...s.session,
        runs: s.session.runs.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        updatedAt: Date.now(),
      },
    }));
  },

  removeRun: (id) => {
    set((s) => {
      const runs = s.session.runs.filter((r) => r.id !== id);
      let activeComparison = s.session.activeComparison;
      if (activeComparison && (activeComparison[0] === id || activeComparison[1] === id)) {
        activeComparison = null;
      }
      return {
        session: { ...s.session, runs, activeComparison, updatedAt: Date.now() },
      };
    });
  },

  setActiveComparison: (runAId, runBId) => {
    set((s) => ({
      session: { ...s.session, activeComparison: [runAId, runBId], updatedAt: Date.now() },
      isPlaying: false,
    }));
  },

  swapRuns: () => {
    set((s) => {
      if (!s.session.activeComparison) return s;
      return {
        session: {
          ...s.session,
          activeComparison: [s.session.activeComparison[1], s.session.activeComparison[0]],
          updatedAt: Date.now(),
        },
      };
    });
  },

  isPlaying: false,
  playbackSpeed: 1,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  playerStates: {},
  setPlayerState: (runId, state) => {
    set((s) => ({
      playerStates: {
        ...s.playerStates,
        [runId]: { ...(s.playerStates[runId] || DEFAULT_PLAYER_STATE), ...state },
      },
    }));
  },

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

  removeAnnotation: (runId, annotationId) => {
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
    }));
  },

  tapSyncMode: "off",
  setTapSyncMode: (mode) => set({ tapSyncMode: mode }),

  syncSetupMode: "off",
  setSyncSetupMode: (mode) => set({ syncSetupMode: mode }),

  showGarage: true,
  setShowGarage: (show) => set({ showGarage: show }),
  showShare: false,
  setShowShare: (show) => set({ showShare: show }),
  overlayMode: false,
  setOverlayMode: (overlay) => set({ overlayMode: overlay }),
  showLeftSidebar: true,
  setShowLeftSidebar: (show) => set({ showLeftSidebar: show }),
  showRightSidebar: true,
  setShowRightSidebar: (show) => set({ showRightSidebar: show }),
  activeTab: "runs",
  setActiveTab: (tab) => set({ activeTab: tab }),

  saveToHistory: () => {
    if (typeof window === "undefined") return;
    const session = get().session;
    const history: Session[] = JSON.parse(localStorage.getItem("rc-history") || "[]");
    const existing = history.findIndex((s) => s.id === session.id);
    if (existing >= 0) {
      history[existing] = session;
    } else {
      history.unshift(session);
    }
    // Keep last 20 sessions
    localStorage.setItem("rc-history", JSON.stringify(history.slice(0, 20)));
  },

  loadFromHistory: (sessionId) => {
    if (typeof window === "undefined") return;
    const history: Session[] = JSON.parse(localStorage.getItem("rc-history") || "[]");
    const session = history.find((s) => s.id === sessionId);
    if (session) {
      set({ session, playerStates: {}, isPlaying: false });
    }
  },

  getHistory: () => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("rc-history") || "[]");
  },

  clearHistory: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("rc-history");
  },
}));
