// "My tickets" list — embedded inside the Tickets hub (/tickets).
//
// Lists tickets where holderMemberUid == auth.uid. Each row is a compact
// list-item (no QR rendered inline). Clicking a row opens the full-screen
// ticket view at /tickets/view/:ticketId, which is what the buyer presents
// at the door for scanning.

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader2, Ticket, AlertCircle, ChevronRight, Share2 } from "lucide-react";
import { firestoreTicketing } from "../../lib/firebaseTicketing";
import { toTicketingDate } from "../../lib/useUpcomingShows";
import ShareTicketModal from "./ShareTicketModal";
import type {
  IssuedTicket,
  TicketedShow,
  TicketStatus,
} from "../../types/ticketingContract";

interface MyTicketsSectionProps {
  uid: string | undefined;
  tickets: Array<IssuedTicket & { id: string }>;
  loading: boolean;
  error: Error | null;
  /** "active" filters to tickets the buyer can still use; "past" shows used/expired. */
  filter?: "active" | "past" | "all";
  /** Shown when the buyer has no tickets in the requested bucket. */
  emptyState?: ReactNode;
  /** Heading text; pass null to render headless. */
  heading?: string | null;
}

const ACTIVE_STATUSES: TicketStatus[] = ["valid", "disputed"]; // disputed still appears, the door will reject

export default function MyTicketsSection({
  uid,
  tickets,
  loading,
  error,
  filter = "active",
  emptyState,
  heading = "My tickets",
}: MyTicketsSectionProps) {
  const [sharingTicket, setSharingTicket] = useState<(IssuedTicket & { id: string }) | null>(null);

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
            <TicketRow
              key={t.id}
              ticket={t}
              shareEnabled={filter === "active"}
              onShare={setSharingTicket}
            />
          ))}
        </ul>
      )}

      {sharingTicket && (
        <ShareTicketModal
          ticket={sharingTicket}
          open={Boolean(sharingTicket)}
          onClose={() => setSharingTicket(null)}
        />
      )}
    </section>
  );
}

// Single row: holder name, show title, date, status, chevron. The title is
// fetched live; if the show doc is gone we fall back to a title snapshotted onto
// the ticket (if present) or a clear "no longer available" — never an indefinite
// "Loading…". Clicking goes to /tickets/view/:ticketId for the scan view.
function TicketRow({
  ticket,
  shareEnabled,
  onShare,
}: {
  ticket: IssuedTicket & { id: string };
  shareEnabled: boolean;
  onShare: (ticket: IssuedTicket & { id: string }) => void;
}) {
  const navigate = useNavigate();
  const [show, setShow] = useState<(TicketedShow & { id: string }) | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    setResolved(false);
    setShow(null);
    const unsub = onSnapshot(
      doc(firestoreTicketing, "shows", ticket.showId),
      (snap) => {
        setShow(snap.exists() ? { id: snap.id, ...(snap.data() as TicketedShow) } : null);
        setResolved(true);
      },
      () => setResolved(true)
    );
    return () => unsub();
  }, [ticket.showId]);

  const displayTitle =
    show?.title ??
    ticket.showTitle ??
    (resolved ? "Show no longer available" : "Loading show…");

  const startDate = useMemo(
    () => toTicketingDate(show?.startDate ?? ticket.showStartDate ?? null),
    [show, ticket.showStartDate]
  );
  const path = `/tickets/view/${ticket.id}`;
  const shareStatus = ticket.shareState?.status;
  const canShare = shareEnabled && ticket.status === "valid" && !shareStatus;
  const sharedToEmail = ticket.shareState?.sharedToEmail ?? ticket.holderEmail;

  const handleNavigate = () => navigate(path);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleNavigate();
    }
  };

  const handleShare = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onShare(ticket);
  };

  return (
    <li>
      <div
        role="link"
        tabIndex={0}
        onClick={handleNavigate}
        onKeyDown={handleKeyDown}
        className="card-cinema p-3 flex items-center gap-3 hover:border-primary/60 transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-cinema-900 truncate">
            {displayTitle}
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
          {shareStatus && (
            <ShareStateBadge status={shareStatus} email={sharedToEmail} />
          )}
          {canShare && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1 rounded border border-primary/40 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 transition cursor-pointer"
            >
              <Share2 className="w-3 h-3" />
              Share
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-cinema-400" />
        </div>
      </div>
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

function ShareStateBadge({
  status,
  email,
}: {
  status: "pending" | "claimed";
  email?: string | null;
}) {
  const tone =
    status === "pending"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-emerald-100 text-emerald-800 border-emerald-200";
  return (
    <span
      className={`inline-flex max-w-36 items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${tone}`}
      title={email ?? undefined}
    >
      <span>{status === "pending" ? "Shared" : "Claimed"}</span>
      {email && (
        <span className="min-w-0 truncate normal-case font-normal opacity-80">
          {email}
        </span>
      )}
    </span>
  );
}
