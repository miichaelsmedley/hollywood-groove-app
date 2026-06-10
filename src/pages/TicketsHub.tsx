// Tickets hub at /tickets — the buyer's home for everything ticket-related.
//
// Three sections, in priority order:
//   1. My tickets (active)   — what they need at the door tonight/soon
//   2. Upcoming shows        — shows on sale, click through to ticketing to buy
//   3. Past tickets          — used/refunded/cancelled history
//
// "Upcoming shows" intentionally lives on this page (not just /shows) because
// some buyers think of "the place I buy tickets" and "the place I view tickets"
// as the same surface. Surfacing both keeps the mental model tight. The merged
// RTDB + ticketing feed is shared with the /upcoming + /shows pages via
// useUpcomingShows so the same gig appears consistently everywhere.

import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Ticket,
  Calendar,
  MapPin,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  X,
} from "lucide-react";
import MyTicketsSection from "../features/tickets/MyTicketsSection";
import WalletSignInPrompt from "../features/tickets/WalletSignInPrompt";
import { useAuthUser } from "../features/auth/useAuthUser";
import {
  claimMyPendingTickets,
  useManagedTickets,
  useMyTickets,
  useTicketedShow,
} from "../lib/firebaseTicketing";
import { formatTicketingDateTime } from "../lib/ticketingTime";
import { toTicketingDate, useUpcomingShows } from "../lib/useUpcomingShows";
import type { UpcomingShowListEntry } from "../lib/useUpcomingShows";
import type { IssuedTicket } from "../types/ticketingContract";

type WalletTicket = IssuedTicket & { id: string };

function sortWalletTickets(a: WalletTicket, b: WalletTicket) {
  const aTime =
    toTicketingDate(a.showStartDate ?? a.issuedAt)?.getTime() ??
    Number.POSITIVE_INFINITY;
  const bTime =
    toTicketingDate(b.showStartDate ?? b.issuedAt)?.getTime() ??
    Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}

export default function TicketsHub() {
  const authUser = useAuthUser();
  const uid = authUser?.uid;
  const isAnonymous = !authUser || authUser.isAnonymous;
  const location = useLocation();
  const navigate = useNavigate();
  const heldTickets = useMyTickets(uid);
  const managedTickets = useManagedTickets(uid);
  const { rows } = useUpcomingShows();
  const shareMessageState = location.state as { ticketShareMessage?: unknown } | null;
  const ticketShareMessage =
    typeof shareMessageState?.ticketShareMessage === "string"
      ? shareMessageState.ticketShareMessage
      : null;

  const walletTickets = useMemo<WalletTicket[]>(() => {
    const ticketsById = new Map<string, WalletTicket>();
    [...managedTickets.tickets, ...heldTickets.tickets].forEach((ticket) => {
      ticketsById.set(ticket.id, {
        ...ticketsById.get(ticket.id),
        ...ticket,
      });
    });
    return Array.from(ticketsById.values()).sort(sortWalletTickets);
  }, [heldTickets.tickets, managedTickets.tickets]);

  const walletLoading =
    Boolean(uid) && (heldTickets.loading || managedTickets.loading);
  const walletError = heldTickets.error ?? managedTickets.error;

  // When a real account signs in (e.g. via the prompt below, after opening a
  // ticket email in a fresh browser), sweep any tickets pending for their
  // now-verified email into the wallet — once per signed-in account.
  const sweptForUid = useRef<string | null>(null);
  useEffect(() => {
    if (!authUser || authUser.isAnonymous || !authUser.emailVerified) return;
    if (sweptForUid.current === authUser.uid) return;
    sweptForUid.current = authUser.uid;
    claimMyPendingTickets().catch(() => {
      // Best-effort; tickets already linked to this account still show.
    });
  }, [authUser]);

  // Surface live shows, anything still upcoming, and any ticketed (on-sale) gig.
  const upcomingShows = useMemo<UpcomingShowListEntry[]>(() => {
    const now = Date.now();
    return rows.filter(
      (row) =>
        row.isLive ||
        (row.startDate ? row.startDate.getTime() >= now : false) ||
        Boolean(row.ticketedShow),
    );
  }, [rows]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Ticket className="w-7 h-7 text-primary" />
          Tickets
        </h1>
        <p className="text-cinema-500 mt-1 text-sm">
          Your tickets and shows you can book.
        </p>
      </header>

      {ticketShareMessage && (
        <div className="card-cinema border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold flex-1">{ticketShareMessage}</span>
          <button
            type="button"
            onClick={() =>
              navigate(`${location.pathname}${location.search}`, {
                replace: true,
                state: null,
              })
            }
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isAnonymous ? (
        <WalletSignInPrompt />
      ) : (
        <MyTicketsSection
          uid={uid}
          tickets={walletTickets}
          loading={walletLoading}
          error={walletError}
          filter="active"
          heading="Your tickets"
          emptyState={
            <>
              You don't have any active tickets.{" "}
              <span className="text-primary font-semibold">
                Browse upcoming shows below to book one.
              </span>
            </>
          }
        />
      )}

      <section className="space-y-3" aria-label="Upcoming shows">
        <header className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-cinema-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Upcoming shows
          </h2>
          <Link to="/shows" className="text-sm text-primary font-semibold inline-flex items-center gap-1 hover:underline">
            See all <ArrowRight className="w-3 h-3" />
          </Link>
        </header>

        {upcomingShows.length === 0 ? (
          <div className="card-cinema p-4 text-sm text-cinema-700">
            No upcoming shows right now. Check back soon.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcomingShows.slice(0, 6).map((row) => (
              <UpcomingShowRow key={row.showId} row={row} />
            ))}
          </ul>
        )}
      </section>

      {!isAnonymous && (
        <MyTicketsSection
          uid={uid}
          tickets={walletTickets}
          loading={walletLoading}
          error={walletError}
          filter="past"
          heading="Past tickets"
          emptyState="No past tickets yet."
        />
      )}
    </div>
  );
}

// One row per upcoming show. Reads the Firestore ticketing doc to decide
// the CTA copy (internal vs external vs none).
function UpcomingShowRow({ row }: { row: UpcomingShowListEntry }) {
  const { show: fetchedTicketed } = useTicketedShow(row.ticketedShow ? undefined : row.showId);
  const ticketed = row.ticketedShow ?? fetchedTicketed;
  const internalOnSale =
    Boolean(ticketed?.ticketingEnabled) &&
    ticketed?.status === "on_sale";
  const internalSoldOut =
    Boolean(ticketed?.ticketingEnabled) &&
    ticketed?.status === "sold_out";
  const externalUrl = row.meta.ticketUrl;
  const ticketingShowId = ticketed?.id ?? row.showId;

  const startLabel = row.startDate === null
    ? "Date TBA"
    : formatTicketingDateTime(row.startDate, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) ?? "Date TBA";

  return (
    <li>
      <div className="card-cinema p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-cinema-900 truncate">{row.meta.title}</p>
          <div className="flex items-center gap-2 text-[11px] text-cinema-600">
            <Calendar className="w-3 h-3" /> {startLabel}
          </div>
          {row.meta.venueName && (
            <div className="flex items-center gap-2 text-[11px] text-cinema-600">
              <MapPin className="w-3 h-3" /> {row.meta.venueName}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {internalOnSale ? (
            <Link
              to={`/event/${ticketingShowId}`}
              className="btn-primary py-1.5 px-3 text-xs font-semibold inline-flex items-center gap-1"
            >
              <Ticket className="w-3.5 h-3.5" /> Buy
            </Link>
          ) : internalSoldOut ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-cinema-700 border border-cinema-300 px-3 py-1.5 rounded-lg opacity-70">
              Sold out
            </span>
          ) : externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary border border-primary/40 px-3 py-1.5 rounded-lg hover:bg-primary/10"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Buy
            </a>
          ) : (
            <Link
              to={`/shows/${row.showId}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cinema-700 border border-cinema-300 px-3 py-1.5 rounded-lg hover:bg-cinema-50"
            >
              View <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
