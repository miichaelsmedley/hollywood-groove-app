// Tickets hub at /tickets — the buyer's home for everything ticket-related.
//
// Three sections, in priority order:
//   1. My tickets (active)   — what they need at the door tonight/soon
//   2. Upcoming shows        — shows on sale, click through to ticketing to buy
//   3. Past tickets          — used/refunded/cancelled history
//
// "Upcoming shows" intentionally lives on this page (not just /shows) because
// some buyers think of "the place I buy tickets" and "the place I view tickets"
// as the same surface. Surfacing both keeps the mental model tight.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { Ticket, Calendar, MapPin, ArrowRight, ExternalLink } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { useUser } from "../contexts/UserContext";
import type { ShowMeta } from "../types/firebaseContract";
import { getShowBasePath } from "../lib/mode";
import { isShowLive, ShowRecordSnapshot } from "../lib/showStatus";
import MyTicketsSection from "../features/tickets/MyTicketsSection";
import { useOnSaleTicketedShows, useTicketedShow } from "../lib/firebaseTicketing";
import type { TicketedShow, TicketingTimestamp } from "../types/ticketingContract";

interface ShowListEntry {
  showId: string;
  meta: ShowMeta;
  isLive: boolean;
}

type TicketedShowWithId = TicketedShow & { id: string };

interface UpcomingShowListEntry extends ShowListEntry {
  startDate: Date | null;
  ticketedShow?: TicketedShowWithId;
}

function toTicketingDate(value: TicketingTimestamp | string | null | undefined): Date | null {
  let date: Date | null = null;

  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    date = new Date((value as { toMillis: () => number }).toMillis());
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "string") {
    date = new Date(value);
  } else if (
    value &&
    typeof value === "object" &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  }

  if (!date || !Number.isFinite(date.getTime())) return null;
  return date;
}

function sortableTime(date: Date | null): number {
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
}

export default function TicketsHub() {
  const { canUseTestMode } = useUser();
  const uid = auth.currentUser?.uid;
  const [shows, setShows] = useState<ShowListEntry[]>([]);
  const { shows: ledgerShows } = useOnSaleTicketedShows();

  // Subscribe to RTDB shows so the existing upcoming list stays live. The
  // Firestore ticketing ledger is merged below without changing this feed.
  useEffect(() => {
    const unsub = onValue(
      ref(db, getShowBasePath()),
      (snap) => {
        const data = snap.val() as Record<string, ShowRecordSnapshot> | null;
        if (!data) {
          setShows([]);
          return;
        }
        const rows: ShowListEntry[] = Object.entries(data)
          .map(([showId, record]) => ({
            showId,
            meta: record.meta as ShowMeta,
            isLive: isShowLive(record),
          }))
          .filter((row) => row.meta && row.meta.title)
          .filter((row) => canUseTestMode || !row.meta.isTestShow);

        const now = Date.now();
        const upcoming = rows.filter((row) => {
          const start = new Date(row.meta.startDate).getTime();
          if (!Number.isFinite(start)) return false;
          return row.isLive || start >= now;
        });
        upcoming.sort((a, b) => {
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;
          return new Date(a.meta.startDate).getTime() - new Date(b.meta.startDate).getTime();
        });
        setShows(upcoming);
      },
      () => setShows([])
    );
    return () => unsub();
  }, [canUseTestMode]);

  const upcomingShows = useMemo<UpcomingShowListEntry[]>(() => {
    const rowsByShowId = new Map<string, UpcomingShowListEntry>();

    shows.forEach((row) => {
      rowsByShowId.set(row.showId, {
        ...row,
        startDate: toTicketingDate(row.meta.startDate),
      });
    });

    ledgerShows.forEach((show) => {
      const effectiveShowId = show.rtdbShowId || show.id;
      const startDate = toTicketingDate(show.startDate);
      const existing = rowsByShowId.get(effectiveShowId);

      if (existing) {
        rowsByShowId.set(effectiveShowId, {
          ...existing,
          ticketedShow: show,
        });
        return;
      }

      rowsByShowId.set(effectiveShowId, {
        showId: effectiveShowId,
        meta: {
          orgId: show.orgId,
          title: show.title,
          startDate: startDate?.toISOString() ?? "",
          venueName: show.venueName ?? "",
          schemaVersion: 1,
          publishedAt: 0,
        },
        isLive: false,
        startDate,
        ticketedShow: show,
      });
    });

    return Array.from(rowsByShowId.values()).sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return sortableTime(a.startDate) - sortableTime(b.startDate);
    });
  }, [shows, ledgerShows]);

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

      <MyTicketsSection
        uid={uid}
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

      <MyTicketsSection
        uid={uid}
        filter="past"
        heading="Past tickets"
        emptyState="No past tickets yet."
      />
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
    : row.startDate.toLocaleString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

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
