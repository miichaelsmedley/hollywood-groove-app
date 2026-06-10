// Full-screen single-ticket scan view at /tickets/view/:ticketId.
//
// The buyer opens this page at the door, hands the phone (or laptop) to the
// scanner. The QR code is intentionally large so it's reliable even in low
// light. The page lives inside the main Layout but uses generous padding to
// give the QR all the room it can take.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Loader2, AlertCircle, Calendar, MapPin, Send } from "lucide-react";
import { firestoreTicketing } from "../lib/firebaseTicketing";
import { formatTicketingDateTime, toTicketingDate } from "../lib/ticketingTime";
import { getTicketWalletPath, resolveSellingFrontId } from "../lib/sellingFronts";
import ShareTicketModal from "../features/tickets/ShareTicketModal";
import type {
  IssuedTicket,
  TicketStatus,
  TicketedShow,
  TicketVenue,
} from "../types/ticketingContract";

export default function TicketView() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [ticket, setTicket] = useState<(IssuedTicket & { id: string }) | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setHydrated(true);
      return;
    }
    const unsub = onSnapshot(
      doc(firestoreTicketing, "tickets", ticketId),
      (snap) => {
        if (!snap.exists()) {
          setTicket(null);
        } else {
          setTicket({ id: snap.id, ...(snap.data() as IssuedTicket) });
        }
        setHydrated(true);
      },
      (err) => {
        setError(err);
        setHydrated(true);
      }
    );
    return () => unsub();
  }, [ticketId]);

  if (!hydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <TicketShell>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="text-lg font-bold mb-1">Couldn't load this ticket</h1>
              <p className="text-sm">{error.message}</p>
            </div>
          </div>
        </div>
      </TicketShell>
    );
  }

  if (!ticket) {
    return (
      <TicketShell>
        <div className="card-cinema p-6 text-cinema-800">
          <h1 className="text-lg font-bold mb-1">Ticket not found</h1>
          <p className="text-sm text-cinema-600">
            We couldn't find a ticket with that id. If you completed payment, check your
            email for the confirmation receipt.
          </p>
        </div>
      </TicketShell>
    );
  }

  return (
    <TicketShell>
      <ShowHeader showId={ticket.showId} />

      <div className="bg-white rounded-2xl border border-cinema-200 shadow-glow p-6 sm:p-8 flex flex-col items-center text-center">
        <p className="text-xs uppercase tracking-wide text-cinema-500 font-semibold mb-1">
          Hold for scan
        </p>
        <p className="text-lg font-bold text-cinema-900 mb-5">{ticket.holderName}</p>

        {ticket.qrToken ? (
          <div className="bg-white p-4 rounded-xl border-2 border-cinema-100">
            <QRCodeSVG value={ticket.qrToken} size={288} level="M" includeMargin={false} />
          </div>
        ) : (
          <div className="w-72 h-72 flex items-center justify-center text-sm text-cinema-500 border-2 border-dashed border-cinema-300 rounded-xl px-6 text-center">
            QR not yet available — your ticket is still being prepared. Refresh in a few
            seconds.
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <TicketStatusBadge status={ticket.status} />
          <p className="text-[11px] text-cinema-500 font-mono">{ticket.id}</p>
        </div>

        <p className="text-xs text-cinema-600 mt-4 max-w-sm">
          The scanner verifies this code server-side. If the screen times out or dims,
          tap it to wake up before handing the phone over.
        </p>
      </div>

      {ticket.status === "valid" && <TicketSharePanel ticket={ticket} />}
    </TicketShell>
  );
}

function TicketSharePanel({ ticket }: { ticket: IssuedTicket & { id: string } }) {
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const shareStatus = ticket.shareState?.status;
  const sharedToEmail = ticket.shareState?.sharedToEmail ?? ticket.holderEmail;

  if (shareStatus === "pending") {
    return (
      <div className="card-cinema border-primary/30 bg-primary/10 p-4 text-sm text-cinema-800">
        Shared with {sharedToEmail || "your friend"} — waiting for them to sign in and claim.
      </div>
    );
  }

  if (shareStatus === "claimed") {
    return (
      <div className="card-cinema border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
        Claimed by your friend.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className="btn-primary inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold cursor-pointer"
      >
        <Send className="w-4 h-4" />
        Send to a friend
      </button>
      <ShareTicketModal
        ticket={ticket}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={(email) => {
          navigate(getTicketWalletPath(resolveSellingFrontId()), {
            replace: true,
            state: { ticketShareMessage: `Ticket sent to ${email}` },
          });
        }}
      />
    </>
  );
}

function TicketShell({ children }: { children: React.ReactNode }) {
  const frontId = resolveSellingFrontId();
  return (
    <div className="max-w-xl mx-auto py-2 space-y-4">
      <Link
        to={getTicketWalletPath(frontId)}
        className="inline-flex items-center gap-1.5 text-cinema-500 hover:text-cinema-900 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to tickets
      </Link>
      {children}
    </div>
  );
}

// Compact header that resolves the show via Firestore. Doesn't gate on the
// venue read (which may be blocked by rules), only the show itself.
function ShowHeader({ showId }: { showId: string }) {
  const [show, setShow] = useState<(TicketedShow & { id: string }) | null>(null);
  const [venue, setVenue] = useState<(TicketVenue & { id: string }) | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(firestoreTicketing, "shows", showId), (snap) => {
      if (snap.exists()) {
        setShow({ id: snap.id, ...(snap.data() as TicketedShow) });
      } else {
        setShow(null);
      }
    });
    return () => unsub();
  }, [showId]);

  useEffect(() => {
    if (!show?.venueId) return;
    const unsub = onSnapshot(
      doc(firestoreTicketing, "venues", show.venueId),
      (snap) => {
        if (snap.exists()) {
          setVenue({ id: snap.id, ...(snap.data() as TicketVenue) });
        }
      },
      () => {
        // Rules may forbid venue read for non-staff; silently skip.
      }
    );
    return () => unsub();
  }, [show?.venueId]);

  const startDate = useMemo(
    () => (show ? toTicketingDate(show.startDate) : null),
    [show],
  );

  return (
    <div className="card-cinema p-4 space-y-2">
      <h1 className="text-xl font-bold text-cinema-900">{show?.title ?? "Loading…"}</h1>
      {startDate && (
        <div className="flex items-center gap-2 text-sm text-cinema-700">
          <Calendar className="w-4 h-4 text-primary" />
          {formatTicketingDateTime(startDate, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
      {venue?.name && (
        <div className="flex items-center gap-2 text-sm text-cinema-700">
          <MapPin className="w-4 h-4 text-primary" />
          {venue.name}
          {venue.address && <span className="text-cinema-500"> · {venue.address}</span>}
        </div>
      )}
    </div>
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
    <span className={`text-xs uppercase tracking-wide font-semibold px-2.5 py-1 rounded ${tone}`}>
      {status}
    </span>
  );
}
