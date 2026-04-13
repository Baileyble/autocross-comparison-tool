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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setShowShare(false)}
      />

      {/* Modal */}
      <div className="relative glass rounded-2xl border border-white/10 p-6 w-full max-w-md animate-slide-up space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold tracking-wide">Share Comparison</h3>
          <button
            onClick={() => setShowShare(false)}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        {shareUrl && (
          <div className="flex justify-center p-4 bg-white rounded-xl">
            <QRCodeSVG
              value={shareUrl}
              size={200}
              level="M"
              bgColor="#ffffff"
              fgColor="#0c0c0f"
            />
          </div>
        )}

        <p className="text-xs text-muted text-center">
          Scan this QR code or copy the link below to share this comparison
        </p>

        {/* URL + Copy */}
        <div className="flex gap-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-xs font-mono text-muted truncate"
          />
          <button
            onClick={handleCopy}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              copied
                ? "bg-teal/20 text-teal border border-teal/30"
                : "bg-accent text-white hover:bg-accent-glow"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
