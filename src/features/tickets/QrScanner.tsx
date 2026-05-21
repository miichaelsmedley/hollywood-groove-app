// Thin React wrapper around html5-qrcode for the door scanner.
//
// Renders a live camera viewfinder and calls onDecode exactly once per scan.
// The parent re-mounts this component (via `key`) to start the next scan.
//
// Camera lifecycle is defensive: stop() runs at most once (no double-stop
// race), and on unmount any lingering MediaStream tracks are stopped too —
// mobile browsers fail to re-acquire a camera that wasn't fully released,
// which otherwise leaves the next scan staring at a black viewfinder.

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, Camera, RotateCw } from "lucide-react";

interface QrScannerProps {
  onDecode: (text: string) => void;
}

export default function QrScanner({ onDecode }: QrScannerProps) {
  const containerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`);
  const decodedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  // Bumping `attempt` re-runs the start effect — drives the Retry button.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let videoEl: HTMLVideoElement | null = null;
    let stopped = false;
    decodedRef.current = false;
    setError(null);
    setStarting(true);

    const elementId = containerId.current;
    const scanner = new Html5Qrcode(elementId, { verbose: false });

    // Idempotent — safe to call from both the decode callback and the unmount
    // cleanup without a double-stop race.
    const stopScanner = (): Promise<void> => {
      if (stopped) return Promise.resolve();
      stopped = true;
      try {
        return scanner.stop().then(
          () => undefined,
          () => undefined
        );
      } catch {
        return Promise.resolve();
      }
    };

    // html5-qrcode's stop() should release the camera, but some mobile
    // browsers don't fully — so explicitly stop the captured video's tracks.
    const releaseTracks = () => {
      const stream = videoEl?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };

    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          aspectRatio: 1,
          // Square scan box sized to the live viewfinder, so the target
          // matches the (square) QR code on any camera dimensions.
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          // html5-qrcode keeps firing while the code is in frame — guard so
          // the parent only ever sees one decode per scan session.
          if (decodedRef.current) return;
          decodedRef.current = true;
          // Stop the camera fully before handing control back to the parent.
          stopScanner().finally(() => {
            if (!cancelled) onDecode(decodedText);
          });
        },
        () => {
          // Per-frame "no code found" — normal, ignore.
        }
      )
      .then(() => {
        if (cancelled) return;
        setStarting(false);
        videoEl =
          document.getElementById(elementId)?.querySelector("video") ?? null;
      })
      .catch((err) => {
        if (cancelled) return;
        setStarting(false);
        const message =
          err instanceof Error ? err.message : "Could not start the camera.";
        setError(
          /permission|notallowed|denied/i.test(message)
            ? "Camera access was blocked. Allow camera access in your browser settings, then tap Retry."
            : `Camera couldn't start: ${message}`
        );
      });

    return () => {
      cancelled = true;
      stopScanner().finally(() => {
        releaseTracks();
        try {
          scanner.clear();
        } catch {
          // ignore — the DOM node may already be gone
        }
      });
    };
  }, [attempt, onDecode]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-sm text-red-200">{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex items-center gap-2 btn-primary cursor-pointer"
        >
          <RotateCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-cinema-200 bg-black aspect-square">
      <div id={containerId.current} className="w-full h-full [&_video]:object-cover" />
      {starting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-cinema-500">
          <Camera className="w-8 h-8 animate-pulse" />
          <span className="text-sm">Starting camera…</span>
        </div>
      )}
    </div>
  );
}
