// "My tickets" list — embedded inside the Tickets hub (/tickets).
//
// Lists tickets where holderMemberUid == auth.uid. Each row is a compact
// list-item (no QR rendered inline). Clicking a row opens the full-screen
// ticket view at /tickets/view/:ticketId, which is what the buyer presents
// at the door for scanning.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader2, Ticket, AlertCircle, ChevronRight } from "lucide-react";
import { firestoreTicketing, useMyTickets } from "../../lib/firebaseTicketing";
import type {
  IssuedTicket,
  TicketedShow,
  TicketStatus,
} from "../../types/ticketingContract";

interface MyTicketsSectionProps {
  uid: string | undefined;
  /** "active" filters to tickets the buyer can still use; "past" shows used/expired. */
  filter?: "active" | "past" | "all";
  /** Shown when the buyer has no tickets in the requested bucket. */
  emptyState?: React.ReactNode;
  /** Heading text; pass null to render headless. */
  heading?: string | null;
}

const ACTIVE_STATUSES: TicketStatus[] = ["valid", "disputed"]; // disputed still appears, the door will reject

export default function MyTicketsSection({
  uid,
  filter = "active",
  emptyState,
  heading = "My tickets",
}: MyTicketsSectionProps) {
  const { tickets, loading, error } = useMyTickets(uid);

  const visible = useMemo(() => {
    if (filter === "all") return tickets;
    if (filter === "active") return tickets.filter((t) => ACTIVE_STATUSES.includes(t.status));
    return tickets.filter((t) => !ACTIVE_STATUSES.includes(t.status));
  }, [tickets, filter]);

  if (!uid) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label={heading ?? "Tickets"}>
      {heading && (
        <header className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-cinema-900">{heading}</h2>
        </header>
      )}

      {loading && (
        <div className="card-cinema p-4 flex items-center gap-2 text-cinema-700 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Loading your tickets…
        </div>
      )}

      {error && (
        <div className="card-cinema p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-2 text-red-800 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>Couldn't load tickets right now. {error.message}</div>
          </div>
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="card-cinema p-4 text-sm text-cinema-700">
          {emptyState ?? (
            <>
              No tickets in this list yet.{" "}
              <Link to="/shows" className="text-primary font-semibold hover:underline">
                Browse upcoming shows
              </Link>
              .
            </>
          )}
        </div>
      )}

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((t) => (
            <TicketRow key={t.id} ticket={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Single row: holder name, show title (live-fetched), date, status, chevron.
// Clicking goes to /tickets/view/:ticketId for the full-screen scan view.
function TicketRow({ ticket }: { ticket: IssuedTicket & { id: string } }) {
  const [show, setShow] = useState<(TicketedShow & { id: string }) | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestoreTicketing, "shows", ticket.showId),
      (snap) => {
        if (snap.exists()) {
          setShow({ id: snap.id, ...(snap.data() as TicketedShow) });
        } else {
          setShow(null);
        }
      },
      () => setShow(null)
    );
    return () => unsub();
  }, [ticket.showId]);

  const startDate = useMemo(() => {
    if (!show) return null;
    const ts: unknown = show.startDate;
    if (ts && typeof (ts as { toMillis?: () => number }).toMillis === "function") {
      return new Date((ts as { toMillis: () => number }).toMillis());
    }
    if (ts instanceof Date) return ts;
    if (typeof ts === "number") return new Date(ts);
    return null;
  }, [show]);

  return (
    <li>
      <Link
        to={`/tickets/view/${ticket.id}`}
        className="card-cinema p-3 flex items-center gap-3 hover:border-primary/60 transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-cinema-900 truncate">
            {show?.title ?? "Loading show…"}
          </p>
          {startDate && (
            <p className="text-xs text-cinema-600">
              {startDate.toLocaleString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="text-[11px] text-cinema-500 truncate">
            Holder: {ticket.holderName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <TicketStatusBadge status={ticket.status} />
          <ChevronRight className="w-4 h-4 text-cinema-400" />
        </div>
      </Link>
    </li>
  );
}

function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const tone =
    status === "valid"
      ? "bg-emerald-100 text-emerald-800"
      : status === "used"
        ? "bg-cinema-200 text-cinema-700"
        : status === "refunded" || status === "cancelled"
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-800";
  return (
    <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${tone}`}>
      {status}
    </span>
  );
}
