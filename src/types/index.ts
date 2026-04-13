export interface Run {
  id: string;
  name: string;
  youtubeUrl: string;
  videoId: string;
  startOffset: number; // seconds — the "launch" point
  notes: string;
  metadata: RunMetadata;
  annotations: Annotation[];
  createdAt: number;
}

export interface RunMetadata {
  tirePressure?: string;
  temperature?: string;
  carSetup?: string;
  tireCompound?: string;
  custom?: Record<string, string>;
}

export interface Annotation {
  id: string;
  time: number; // seconds from start of video
  label: string;
  color: AnnotationColor;
}

export type AnnotationColor = "red" | "amber" | "teal" | "white";

export interface Session {
  id: string;
  name: string;
  runs: Run[];
  activeComparison: [string, string] | null; // two run IDs
  createdAt: number;
  updatedAt: number;
}

export interface ComparisonState {
  runA: Run | null;
  runB: Run | null;
  isPlaying: boolean;
  playbackSpeed: number;
  isSynced: boolean;
}

export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "error";

export interface PlayerState {
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  elapsed: number; // time since startOffset
}
