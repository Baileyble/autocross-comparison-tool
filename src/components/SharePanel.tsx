"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "@/lib/store";

export function SharePanel() {
  const show = useStore((s) => s.showShare);
  const setShow = useStore((s) => s.setShowShare);
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const el = document.createElement("input");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!show || !shareUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => setShow(false)} />
      <div className="relative panel p-5 w-full max-w-md animate-rise space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold tracking-tight">Share comparison</h3>
          <button
            onClick={() => setShow(false)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex justify-center p-4 bg-white rounded-xl">
          <QRCodeSVG value={shareUrl} size={180} level="M" bgColor="#ffffff" fgColor="#0e0f11" />
        </div>

        <p className="text-xs text-muted text-center">
          Scan with a phone, or copy the link. Launch points travel with it.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 min-w-0 bg-elevated border border-white/[0.06] rounded-lg px-3 py-2.5 text-xs font-mono text-muted truncate"
          />
          <button
            onClick={copy}
            className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shrink-0 ${
              copied ? "bg-good/15 text-good" : "bg-lime text-background hover:bg-lime-bright"
            }`}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
