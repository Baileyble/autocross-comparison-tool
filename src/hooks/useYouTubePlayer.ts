"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { loadYouTubeAPI } from "@/lib/youtube";
import type { PlayerStatus } from "@/types";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  interface Window {
    __gridlinePlayers: YT.Player[];
  }
}

// Re-reference YT namespace to avoid UMD global error in module context
const YTPlayerState = {
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  ENDED: 0,
  CUED: 5,
  UNSTARTED: -1,
} as const;

interface UseYouTubePlayerOptions {
  videoId: string;
  startOffset?: number;
  containerId: string;
  onStateChange?: (status: PlayerStatus) => void;
  onReady?: () => void;
  onTimeUpdate?: (time: number) => void;
}

export function useYouTubePlayer({
  videoId,
  startOffset = 0,
  containerId,
  onStateChange,
  onReady,
  onTimeUpdate,
}: UseYouTubePlayerOptions) {
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>("idle");

  // Store callbacks in refs to avoid re-creating player on every render
  const onStateChangeRef = useRef(onStateChange);
  const onReadyRef = useRef(onReady);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onStateChangeRef.current = onStateChange;
  onReadyRef.current = onReady;
  onTimeUpdateRef.current = onTimeUpdate;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setStatus("loading");
        onStateChangeRef.current?.("loading");

        await loadYouTubeAPI();

        if (cancelled) return;

        // Destroy existing player
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        const player = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            start: Math.floor(startOffset),
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setStatus("ready");
              onStateChangeRef.current?.("ready");
              onReadyRef.current?.();
              // Register in global player registry
              if (!window.__gridlinePlayers) window.__gridlinePlayers = [];
              if (!window.__gridlinePlayers.includes(player)) {
                window.__gridlinePlayers.push(player);
              }
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (cancelled) return;
              let newStatus: PlayerStatus;
              switch (event.data) {
                case YTPlayerState.PLAYING:
                  newStatus = "playing";
                  break;
                case YTPlayerState.PAUSED:
                  newStatus = "paused";
                  break;
                case YTPlayerState.BUFFERING:
                  newStatus = "loading";
                  break;
                case YTPlayerState.ENDED:
                  newStatus = "paused";
                  break;
                default:
                  newStatus = "ready";
              }
              setStatus(newStatus);
              onStateChangeRef.current?.(newStatus);
            },
            onError: () => {
              if (cancelled) return;
              setStatus("error");
              onStateChangeRef.current?.("error");
            },
          },
        });

        playerRef.current = player;
      } catch {
        if (!cancelled) {
          setStatus("error");
          onStateChangeRef.current?.("error");
        }
      }
    }

    if (videoId) {
      init();
    }

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current) {
        // Unregister from global registry
        if (window.__gridlinePlayers) {
          window.__gridlinePlayers = window.__gridlinePlayers.filter((p) => p !== playerRef.current);
        }
        try {
          playerRef.current.destroy();
        } catch {
          // Player may already be destroyed
        }
        playerRef.current = null;
      }
    };
  }, [videoId, containerId, startOffset]);

  // Time update polling
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (status === "playing" && playerRef.current) {
      intervalRef.current = setInterval(() => {
        if (playerRef.current) {
          try {
            const time = playerRef.current.getCurrentTime();
            onTimeUpdateRef.current?.(time);
          } catch {
            // Player might not be ready
          }
        }
      }, 100);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status]);

  const play = useCallback(() => {
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const seekTo = useCallback((time: number) => {
    playerRef.current?.seekTo(time, true);
  }, []);

  const getCurrentTime = useCallback((): number => {
    try {
      return playerRef.current?.getCurrentTime() ?? 0;
    } catch {
      return 0;
    }
  }, []);

  const getDuration = useCallback((): number => {
    try {
      return playerRef.current?.getDuration() ?? 0;
    } catch {
      return 0;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    try {
      playerRef.current?.setPlaybackRate(rate);
    } catch {
      // Rate might not be supported
    }
  }, []);

  return {
    player: playerRef,
    ready,
    status,
    play,
    pause,
    seekTo,
    getCurrentTime,
    getDuration,
    setPlaybackRate,
  };
}
