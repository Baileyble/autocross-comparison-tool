"use client";

import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "@/lib/store";

export function ShareModal() {
  const showShare = useStore((s) => s.showShare);
  const setShowShare = useStore((s) => s.setShowShare);
  const session = useStore((s) => s.session);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !session.activeComparison) return "";
    const runA = session.runs.find((r) => r.id === session.activeComparison![0]);
    const runB = session.runs.find((r) => r.id === session.activeComparison![1]);
    if (!runA || !runB) return "";

    const params = new URLSearchParams({
      v1: runA.videoId,
      v2: runB.videoId,
      t1: runA.startOffset.toString(),
      t2: runB.startOffset.toString(),
      n1: runA.name,
      n2: runB.name,
    });

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [session]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!showShare) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => setShowShare(false)}
      />

      {/* Modal — neon border glow + HUD corners */}
      <div className="relative glass rounded-2xl neon-border p-6 w-full max-w-md animate-slide-up space-y-5 hud-corners">
        <div className="hud-corners-inner">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold tracking-[0.1em] text-cyan text-glow-cyan">SHARE COMPARISON</h3>
            <button
              onClick={() => setShowShare(false)}
              className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* QR Code */}
          {shareUrl && (
            <div className="flex justify-center p-4 bg-white rounded-xl mt-4">
              <QRCodeSVG
                value={shareUrl}
                size={200}
                level="M"
                bgColor="#ffffff"
                fgColor="#030308"
              />
            </div>
          )}

          <p className="text-xs text-muted text-center font-mono mt-4">
            Scan QR code or copy the link below to share this comparison
          </p>

          {/* URL + Copy */}
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 bg-surface border border-cyan/15 rounded-lg px-3 py-2.5 text-xs font-mono text-cyan/70 truncate focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium font-mono tracking-wider transition-all ${
                copied
                  ? "bg-lime/20 text-lime border border-lime/30 glow-lime"
                  : "bg-cyan text-background hover:bg-cyan-glow"
              }`}
              style={!copied ? { boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)' } : {}}
            >
              {copied ? "COPIED!" : "COPY"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
