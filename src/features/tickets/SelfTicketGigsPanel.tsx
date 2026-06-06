// Admin panel: turn a PRIS "We sell" gig into a live Hollywood Groove /
// Adele ticketed show. Lists self-ticketing gigs from the PRIS bridge; each
// one can be created into a Firestore ticketing show with a single click
// (the ticket tier is read from the gig, captured in the PRIS booking form).
//
// Renders inside AdminTicketing (already platform-admin gated). All writes go
// through the createTicketedShowFromGig callable, which re-checks the claim.

import { useCallback, useEffect, useState } from "react";
import {
  Ticket,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  listSelfTicketGigs,
  createTicketedShowFromGig,
  type SelfTicketGig,
} from "../../lib/firebaseTicketing";

function gigDateLabel(value: string | null): string {
  if (!value) return "Date TBA";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function frontLabel(id: string | null): string {
  if (id === "adele_show") return "The Adele Show";
  if (id === "hollywood_groove") return "Hollywood Groove";
  return "Unknown band";
}

export default function SelfTicketGigsPanel() {
  const [gigs, setGigs] = useState<SelfTicketGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyGigId, setBusyGigId] = useState<number | null>(null);
  const [createdUrl, setCreatedUrl] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSelfTicketGigs();
      setGigs(result.gigs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load gigs from PRIS.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (gig: SelfTicketGig) => {
    setBusyGigId(gig.id);
    setError(null);
    try {
      const result = await createTicketedShowFromGig({ prisGigId: gig.id });
      setCreatedUrl((prev) => ({ ...prev, [gig.id]: result.ticketUrl }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the ticketed show.");
    } finally {
      setBusyGigId(null);
    }
  };

  return (
    <section className="rounded-xl border border-cinema-200 bg-cinema-50 p-4 space-y-3" aria-label="Self-ticketing gigs">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-cinema-900">Self-ticketing gigs (from PRIS)</h2>
            <p className="text-xs text-cinema-600">Create the ticketed show + public link from a "We sell" gig.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cinema-700 hover:text-cinema-900 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-cinema-600 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading gigs from PRIS…
        </div>
      ) : gigs.length === 0 ? (
        <p className="text-sm text-cinema-600 py-2">
          No gigs are set to "We sell" in PRIS yet. Mark a gig's Ticketing as "We sell" and add a price + quantity, then refresh.
        </p>
      ) : (
        <ul className="space-y-2">
          {gigs.map((gig) => {
            const live = Boolean(gig.ticketingShowId);
            const url = createdUrl[gig.id] || (gig.ticketingShowId ? null : null);
            const busy = busyGigId === gig.id;
            return (
              <li
                key={gig.id}
                className="rounded-lg border border-cinema-200 bg-cinema-100 p-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-cinema-900 truncate">
                    {gig.title || `${frontLabel(gig.sellingFrontId)} show`}
                  </p>
                  <p className="text-xs text-cinema-600">
                    {gigDateLabel(gig.gigDate)}
                    {gig.venueName ? ` · ${gig.venueName}` : ""} · {frontLabel(gig.sellingFrontId)}
                  </p>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary font-semibold inline-flex items-center gap-1 mt-1 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> {url}
                    </a>
                  )}
                </div>

                {live ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Live
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCreate(gig)}
                    disabled={busy}
                    className="btn-primary inline-flex items-center gap-1.5 text-sm py-2 cursor-pointer disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
                    {busy ? "Creating…" : "Create ticketed show"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
