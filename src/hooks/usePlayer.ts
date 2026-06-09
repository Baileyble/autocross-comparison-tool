"use client";

import { useEffect, useRef } from "react";
import { loadYouTubeAPI } from "@/lib/youtube";
import { sync } from "@/lib/sync";
import { useStore } from "@/lib/store";

interface UsePlayerOptions {
  runId: string;
  videoId: string;
  offset: number;
  containerId: string;
}

/**
 * Mounts a chrome-less YouTube player into `containerId` and registers it
 * with the sync controller. Offset changes update live without recreating
 * the player.
 */
export function usePlayer({ runId, videoId, offset, containerId }: UsePlayerOptions) {
  const setPlayerState = useStore((s) => s.setPlayerState);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const playerRef = useRef<YT.Player | null>(null);
  const offsetRef = useRef(offset);

  // Keep offset live for the poll loop and sync controller
  useEffect(() => {
    offsetRef.current = offset;
    sync.setOffset(runId, offset);
  }, [offset, runId]);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        setPlayerState(runId, { status: "loading" });
        await loadYouTubeAPI();
        if (cancelled) return;

        // Give React a beat to mount the container element
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled || !document.getElementById(containerId)) return;

        const player = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            rel: 0,
            playsinline: 1,
            start: Math.floor(offsetRef.current),
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              playerRef.current = player;
              sync.register(runId, player, offsetRef.current);
              try {
                player.seekTo(offsetRef.current, true);
                player.pauseVideo();
                const duration = player.getDuration();
                setPlayerState(runId, { status: "ready", duration: duration > 0 ? duration : 0 });
              } catch {
                setPlayerState(runId, { status: "ready" });
              }

              poll = setInterval(() => {
                try {
                  const t = player.getCurrentTime();
                  setPlayerState(runId, {
                    currentTime: t,
                    elapsed: Math.max(0, t - offsetRef.current),
                  });
                } catch {}
              }, 200);
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (cancelled) return;
              const s = event.data as number;
              setPlayerState(runId, {
                status: s === 1 ? "playing" : s === 3 ? "loading" : s === 2 ? "paused" : "ready",
              });
              // When either run's video ends, stop the pair cleanly
              if (s === 0) {
                sync.pause();
                setIsPlaying(false);
              }
            },
            onError: () => {
              if (!cancelled) setPlayerState(runId, { status: "error" });
            },
          },
        });
      } catch {
        if (!cancelled) setPlayerState(runId, { status: "error" });
      }
    }

    init();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      sync.unregister(runId);
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
    };
  }, [runId, videoId, containerId, setPlayerState, setIsPlaying]);
}
