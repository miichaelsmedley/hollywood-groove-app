// Unified "upcoming shows" feed.
//
// A gig can live in two stores: the RTDB engagement catalog (shows you join for
// live trivia/scoring) and the Firestore `ticketing` ledger (ticketed events).
// A ticketed-but-not-yet-live gig only exists in the ledger, so a page that
// reads RTDB alone (the events list) would miss it entirely. This hook merges
// both into one deduplicated, sorted feed so every upcoming gig surfaces in the
// same place — used by /tickets (TicketsHub) and /upcoming + /shows (ShowsPage).

import { useMemo } from "react";
import { useUser } from "../contexts/UserContext";
import type { ShowMeta } from "../types/firebaseContract";
import { useOnSaleTicketedShows } from "./firebaseTicketing";
import type { TicketedShow } from "../types/ticketingContract";
import { toTicketingDate } from "./ticketingTime";
import { indexedShowToMeta, useActiveShows, useIndexedShows } from "./showIndex";

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

// toTicketingDate now lives in ./ticketingTime (shared by ~8 call sites);
// re-exported here so existing importers (MyTicketsSection, TicketsHub) keep
// their import path unchanged.
export { toTicketingDate };

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
  const { rows: indexedShows, loading: indexLoading } = useIndexedShows(false);
  const { shows: activeShows, loading: activeShowsLoading } = useActiveShows({
    includeProd: true,
    includeTest: false,
  });
  const { shows: ledgerShows } = useOnSaleTicketedShows();

  const rtdbShows = useMemo<ShowListEntry[]>(() => {
    const activeShowIds = new Set(activeShows.map((show) => show.showId));
    return indexedShows
      .map((row) => ({
        showId: row.showId,
        meta: indexedShowToMeta(row),
        isLive: activeShowIds.has(row.showId),
      }))
      // Hide test-flagged prod records from regular users; dedicated test
      // records live under test/shows_index and are not part of this public feed.
      .filter((row) => canUseTestMode || !row.meta.isTestShow);
  }, [activeShows, canUseTestMode, indexedShows]);

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

  return { rows, loading: indexLoading || activeShowsLoading };
}
