// Unified "upcoming shows" feed.
//
// A gig can live in two stores: the RTDB engagement catalog (shows you join for
// live trivia/scoring) and the Firestore `ticketing` ledger (ticketed events).
// A ticketed-but-not-yet-live gig only exists in the ledger, so a page that
// reads RTDB alone (the events list) would miss it entirely. This hook merges
// both into one deduplicated, sorted feed so every upcoming gig surfaces in the
// same place — used by /tickets (TicketsHub) and /upcoming + /shows (ShowsPage).

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "./firebase";
import { useUser } from "../contexts/UserContext";
import type { ShowMeta } from "../types/firebaseContract";
import { getShowBasePath } from "./mode";
import { isShowLive, ShowRecordSnapshot } from "./showStatus";
import { useOnSaleTicketedShows } from "./firebaseTicketing";
import type { TicketedShow, TicketingTimestamp } from "../types/ticketingContract";

export interface ShowListEntry {
  showId: string;
  meta: ShowMeta;
  isLive: boolean;
}

export type TicketedShowWithId = TicketedShow & { id: string };

export interface UpcomingShowListEntry extends ShowListEntry {
  startDate: Date | null;
  ticketedShow?: TicketedShowWithId;
}

/** Best-effort coercion of the various date shapes (Firestore Timestamp, Date,
 * epoch ms, ISO string, or {seconds}) into a Date — or null if unparseable. */
export function toTicketingDate(
  value: TicketingTimestamp | string | null | undefined,
): Date | null {
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

export function sortableTime(date: Date | null): number {
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
}

export interface UseUpcomingShowsResult {
  rows: UpcomingShowListEntry[];
  loading: boolean;
}

/**
 * Merged RTDB + Firestore-ticketing show feed, sorted live-first then by
 * soonest date. Test shows are hidden unless the viewer has test access.
 * Callers apply their own date/mode filter (e.g. upcoming-only) on top.
 */
export function useUpcomingShows(): UseUpcomingShowsResult {
  const { canUseTestMode } = useUser();
  const [rtdbShows, setRtdbShows] = useState<ShowListEntry[]>([]);
  const [rtdbLoaded, setRtdbLoaded] = useState(false);
  const { shows: ledgerShows } = useOnSaleTicketedShows();

  useEffect(() => {
    const unsub = onValue(
      ref(db, getShowBasePath()),
      (snap) => {
        setRtdbLoaded(true);
        const data = snap.val() as Record<string, ShowRecordSnapshot> | null;
        if (!data) {
          setRtdbShows([]);
          return;
        }
        const rows: ShowListEntry[] = Object.entries(data)
          .map(([showId, record]) => ({
            showId,
            meta: record.meta as ShowMeta,
            isLive: isShowLive(record),
          }))
          .filter((row) => row.meta && row.meta.title)
          // Hide test shows from regular users; testers still see them.
          .filter((row) => canUseTestMode || !row.meta.isTestShow);
        setRtdbShows(rows);
      },
      () => {
        setRtdbLoaded(true);
        setRtdbShows([]);
      },
    );
    return () => unsub();
  }, [canUseTestMode]);

  const rows = useMemo<UpcomingShowListEntry[]>(() => {
    const rowsByShowId = new Map<string, UpcomingShowListEntry>();

    rtdbShows.forEach((row) => {
      rowsByShowId.set(row.showId, {
        ...row,
        startDate: toTicketingDate(row.meta.startDate),
      });
    });

    // Merge the ticketing ledger: attach to a matching RTDB show, or add a
    // standalone row for a ticketed-only gig (no RTDB engagement show yet).
    ledgerShows.forEach((show) => {
      const effectiveShowId = show.rtdbShowId || show.id;
      const startDate = toTicketingDate(show.startDate);
      const existing = rowsByShowId.get(effectiveShowId);

      if (existing) {
        rowsByShowId.set(effectiveShowId, { ...existing, ticketedShow: show });
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
  }, [rtdbShows, ledgerShows]);

  return { rows, loading: !rtdbLoaded };
}
