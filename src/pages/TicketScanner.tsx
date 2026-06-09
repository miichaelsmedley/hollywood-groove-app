// Door scanner at /scan (Phase 4b).
//
// A door staffer signs in, picks the show they're working, then scans ticket
// QR codes. Each scan calls validateTicketScan and shows a big, glanceable
// result. The page self-gates: it checks the caller's role claims and shows a
// "no access" message rather than 404-ing, so a mis-shared link is friendly.
//
// validateTicketScan enforces the real permission server-side (claim + venue
// eligibility); this page's check is only a UX gate.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ScanLine,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  ShieldOff,
} from "lucide-react";
import {
  useScannableShows,
  validateTicketScan,
  type ScanResult,
  type ValidateTicketScanResult,
} from "../lib/firebaseTicketing";
import QrScanner from "../features/tickets/QrScanner";
import { useStaffRoles } from "../hooks/useStaffRoles";
import { toTicketingDate, toTicketingMillis } from "../lib/ticketingTime";

type ScreenState = "pick_show" | "scanning" | "result";

interface ResultStyle {
  tone: "ok" | "warn" | "bad";
  label: string;
}

const RESULT_STYLE: Record<ScanResult, ResultStyle> = {
  valid: { tone: "ok", label: "Valid — let them in" },
  already_used: { tone: "warn", label: "Already used" },
  wrong_event: { tone: "warn", label: "Wrong event" },
  refunded: { tone: "warn", label: "Refunded" },
  cancelled: { tone: "warn", label: "Cancelled" },
  disputed: { tone: "bad", label: "Disputed — do not admit" },
  not_found: { tone: "bad", label: "Ticket not found" },
};

function showStartLabel(value: unknown): string {
  const date = toTicketingDate(value);
  if (!date) return "Date TBA";
  return date.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketScanner() {
  const [screen, setScreen] = useState<ScreenState>("pick_show");
  const [activeShowId, setActiveShowId] = useState<string | null>(null);
  const [activeShowTitle, setActiveShowTitle] = useState<string>("");
  const [scanSession, setScanSession] = useState(0);
  const [validating, setValidating] = useState(false);
  const [scanResult, setScanResult] = useState<ValidateTicketScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const { shows, loading: showsLoading, error: showsError } = useScannableShows();

  // Self-gate on the caller's staff claims. validateTicketScan still enforces
  // the real permission server-side; this is only a UX gate.
  const { loading: rolesLoading, canScanTickets } = useStaffRoles();

  // Auto-advance to the next scan a few seconds after a clean entry; hold on
  // anything that needs the staffer to act.
  useEffect(() => {
    if (screen !== "result" || scanResult?.result !== "valid") return;
    const timer = setTimeout(() => {
      setScreen("scanning");
      setScanResult(null);
      setScanSession((n) => n + 1);
    }, 3500);
    return () => clearTimeout(timer);
  }, [screen, scanResult]);

  const handleDecode = useCallback(
    async (qrToken: string) => {
      if (!activeShowId) return;
      setValidating(true);
      setScanError(null);
      setScreen("result");
      try {
        const result = await validateTicketScan({
          qrToken,
          showId: activeShowId,
          deviceInfo:
            typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : null,
        });
        setScanResult(result);
      } catch (err) {
        console.error("validateTicketScan failed", err);
        setScanError(
          err instanceof Error && err.message
            ? err.message
            : "Scan failed. Check your connection and try again."
        );
      } finally {
        setValidating(false);
      }
    },
    [activeShowId]
  );

  const startNextScan = () => {
    setScanResult(null);
    setScanError(null);
    setScreen("scanning");
    setScanSession((n) => n + 1);
  };

  const sortedShows = useMemo(
    () =>
      [...shows].sort(
        (a, b) =>
          (toTicketingMillis(b.startDate) ?? 0) -
          (toTicketingMillis(a.startDate) ?? 0),
      ),
    [shows]
  );

  // ----- gates ---------------------------------------------------------------
  if (rolesLoading) {
    return (
      <ScannerShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </ScannerShell>
    );
  }

  if (!canScanTickets) {
    return (
      <ScannerShell>
        <div className="max-w-md mx-auto py-16 text-center space-y-3">
          <ShieldOff className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">No scanner access</h1>
          <p className="text-sm text-cinema-400">
            Your account isn't set up as door staff. Ask the event organiser to invite
            you as a scanner for the venue, then sign in again.
          </p>
          <Link to="/" className="btn-primary inline-block mt-2">
            Back to app
          </Link>
        </div>
      </ScannerShell>
    );
  }

  // ----- pick show -----------------------------------------------------------
  if (screen === "pick_show") {
    return (
      <ScannerShell>
        <div className="max-w-lg mx-auto py-6 space-y-4">
          <header>
            <h1 className="text-2xl font-bold text-white">Door scanner</h1>
            <p className="text-sm text-cinema-400 mt-1">
              Pick the show you're scanning tickets for.
            </p>
          </header>

          {showsLoading ? (
            <div className="flex items-center gap-2 text-cinema-400 text-sm py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading shows…
            </div>
          ) : showsError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm space-y-1">
              <p className="font-semibold text-red-200">Couldn't load shows</p>
              <p className="text-red-300/80 break-words">{showsError.message}</p>
            </div>
          ) : sortedShows.length === 0 ? (
            <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4 text-sm text-cinema-500">
              No ticketed shows are available to scan right now.
            </div>
          ) : (
            <ul className="space-y-2">
              {sortedShows.map((show) => (
                <li key={show.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveShowId(show.id);
                      setActiveShowTitle(show.title);
                      startNextScan();
                    }}
                    className="w-full text-left rounded-xl border border-cinema-200 bg-cinema-50 hover:border-primary/60 transition-colors p-3 cursor-pointer"
                  >
                    <p className="font-semibold text-white">{show.title}</p>
                    <p className="text-xs text-cinema-500 inline-flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3 h-3" /> {showStartLabel(show.startDate)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScannerShell>
    );
  }

  // ----- scanning + result ---------------------------------------------------
  return (
    <ScannerShell>
      <div className="max-w-lg mx-auto py-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{activeShowTitle}</p>
            <p className="text-[11px] text-cinema-500">Scanning tickets</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setScreen("pick_show");
              setScanResult(null);
              setScanError(null);
            }}
            className="text-xs text-cinema-400 hover:text-white inline-flex items-center gap-1 cursor-pointer flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Change show
          </button>
        </div>

        {screen === "scanning" && (
          <>
            <QrScanner key={scanSession} onDecode={handleDecode} />
            <p className="text-center text-xs text-cinema-500 inline-flex items-center justify-center gap-1.5 w-full">
              <ScanLine className="w-3.5 h-3.5" /> Point the camera at the ticket QR code
            </p>
          </>
        )}

        {screen === "result" && (
          <ScanResultCard
            validating={validating}
            error={scanError}
            result={scanResult}
            onNext={startNextScan}
          />
        )}
      </div>
    </ScannerShell>
  );
}

function ScannerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cinema text-white">
      <header className="border-b border-cinema-200">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-primary shrink-0" />
          <span className="font-display text-lg text-primary truncate min-w-0">
            Door Scanner
          </span>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1 text-xs text-cinema-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to app
          </Link>
        </div>
      </header>
      <main className="px-4">{children}</main>
    </div>
  );
}

function ScanResultCard({
  validating,
  error,
  result,
  onNext,
}: {
  validating: boolean;
  error: string | null;
  result: ValidateTicketScanResult | null;
  onNext: () => void;
}) {
  if (validating) {
    return (
      <div className="rounded-2xl border border-cinema-200 bg-cinema-50 p-10 flex flex-col items-center gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-primary" />
        <p className="text-sm text-cinema-500">Checking ticket…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center space-y-3">
        <XCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="text-sm text-red-200">{error}</p>
        <button type="button" onClick={onNext} className="btn-primary w-full py-3 cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  if (!result) return null;

  const style = RESULT_STYLE[result.result];
  const palette =
    style.tone === "ok"
      ? { box: "border-emerald-500/50 bg-emerald-500/15", text: "text-emerald-300", Icon: CheckCircle2 }
      : style.tone === "warn"
        ? { box: "border-amber-500/50 bg-amber-500/15", text: "text-amber-300", Icon: AlertTriangle }
        : { box: "border-red-500/50 bg-red-500/15", text: "text-red-300", Icon: XCircle };
  const Icon = palette.Icon;

  return (
    <div className={`rounded-2xl border-2 p-6 text-center space-y-3 ${palette.box}`}>
      <Icon className={`w-16 h-16 mx-auto ${palette.text}`} />
      <p className={`text-2xl font-bold ${palette.text}`}>{style.label}</p>
      {result.holderName && (
        <p className="text-lg text-white font-semibold">{result.holderName}</p>
      )}
      <p className="text-sm text-white/80">{result.note}</p>
      <button
        type="button"
        onClick={onNext}
        className="btn-primary w-full py-3 text-base font-bold cursor-pointer mt-2"
      >
        Scan next ticket
      </button>
    </div>
  );
}
