import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { toTicketingMillis } from "../../ticketingTime";
import { firestoreTicketing } from "../client";
import { useFirestoreCollection, useFirestoreDoc } from "./firestore";
import type {
  IssuedTicket,
  TicketOrder,
  TicketType,
  TicketedShow,
} from "../../../types/ticketingContract";

export interface UseScannableShowsResult {
  shows: Array<TicketedShow & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function useScannableShows(): UseScannableShowsResult {
  const showsQuery = useMemo(
    () =>
      query(
        collection(firestoreTicketing, "shows"),
        where("ticketingEnabled", "==", true),
        where("status", "in", ["published", "on_sale", "sold_out"]),
        orderBy("startDate", "desc"),
      ),
    [],
  );
  const { items, loading, error } =
    useFirestoreCollection<TicketedShow>(showsQuery);
  return { shows: items, loading, error };
}

export type UseOnSaleTicketedShowsResult = UseScannableShowsResult;

export function useOnSaleTicketedShows(): UseOnSaleTicketedShowsResult {
  const state = useScannableShows();
  return {
    ...state,
    shows: state.shows.filter(
      (show) => show.status === "on_sale" || show.status === "sold_out",
    ),
  };
}

export interface UseTicketedShowResult {
  show: (TicketedShow & { id: string }) | null;
  loading: boolean;
  error: Error | null;
}

export interface UseEventShowIdResult {
  showId: string | null;
  loading: boolean;
  error: Error | null;
}

export function useEventShowId(
  identifier: string | undefined,
): UseEventShowIdResult {
  const [state, setState] = useState<UseEventShowIdResult>({
    showId: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!identifier) {
      setState({ showId: null, loading: false, error: null });
      return;
    }
    const currentIdentifier = identifier;
    let cancelled = false;
    setState({ showId: null, loading: true, error: null });

    async function resolve() {
      const normalizedSlug = currentIdentifier.trim().toLowerCase();
      try {
        const directSnap = await getDoc(
          doc(firestoreTicketing, "shows", currentIdentifier),
        );
        if (!cancelled && directSnap.exists()) {
          setState({ showId: directSnap.id, loading: false, error: null });
          return;
        }
      } catch {
        // The direct doc can be denied for non-public shows. Try the public slug alias.
      }

      try {
        const slugSnap = await getDoc(
          doc(firestoreTicketing, "eventSlugs", normalizedSlug),
        );
        if (!cancelled && slugSnap.exists()) {
          const data = slugSnap.data() as {
            showId?: unknown;
            active?: unknown;
          };
          const resolvedShowId =
            typeof data.showId === "string" && data.active !== false
              ? data.showId
              : null;
          setState({ showId: resolvedShowId, loading: false, error: null });
          return;
        }
        if (!cancelled) {
          setState({ showId: null, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ showId: null, loading: false, error: err as Error });
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  return state;
}

export function useTicketedShow(
  showId: string | undefined,
): UseTicketedShowResult {
  const showRef = useMemo(
    () => (showId ? doc(firestoreTicketing, "shows", showId) : null),
    [showId],
  );
  const { item, loading, error } = useFirestoreDoc<TicketedShow>(showRef);
  return { show: item, loading, error };
}

export interface UseTicketTypesResult {
  ticketTypes: Array<TicketType & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function useTicketTypes(
  showId: string | undefined,
): UseTicketTypesResult {
  const ticketTypesQuery = useMemo(
    () =>
      showId
        ? query(
            collection(firestoreTicketing, "shows", showId, "ticketTypes"),
            orderBy("displayOrder", "asc"),
          )
        : null,
    [showId],
  );
  const { items, loading, error } =
    useFirestoreCollection<TicketType>(ticketTypesQuery);
  return {
    ticketTypes: items.filter((ticketType) => ticketType.active),
    loading,
    error,
  };
}

export interface UseMyOrdersResult {
  orders: Array<TicketOrder & { id: string }>;
  loading: boolean;
  error: Error | null;
}

// Buyer-side list of their own orders. Rules enforce buyerUid == request.auth.uid.
export function useMyOrders(buyerUid: string | undefined): UseMyOrdersResult {
  const ordersQuery = useMemo(
    () =>
      buyerUid
        ? query(
            collection(firestoreTicketing, "orders"),
            where("buyerUid", "==", buyerUid),
          )
        : null,
    [buyerUid],
  );
  const { items, loading, error } =
    useFirestoreCollection<TicketOrder>(ordersQuery);
  return { orders: items, loading, error };
}

// Buyer-side list of issued tickets attributed to this Firebase Auth uid.
// The webhook sets holderMemberUid = buyerUid whenever the holder's email
// matches the buyer's email at purchase time, so the buyer-of-themselves case
// works immediately. Other holders' tickets attach later via Phase 5's
// linkAttendeeToMember backfill when those holders sign in with the matching
// email. Firestore rules permit reads where holderMemberUid == auth.uid.
export interface UseMyTicketsResult {
  tickets: Array<IssuedTicket & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function useMyTickets(
  memberUid: string | undefined,
): UseMyTicketsResult {
  const ticketsQuery = useMemo(
    () =>
      memberUid
        ? query(
            collection(firestoreTicketing, "tickets"),
            where("holderMemberUid", "==", memberUid),
          )
        : null,
    [memberUid],
  );
  const { items, loading, error } =
    useFirestoreCollection<IssuedTicket>(ticketsQuery);
  return { tickets: items, loading, error };
}

const MANAGED_TICKETS_IN_QUERY_LIMIT = 30;

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function timestampToMillis(value: unknown): number {
  return toTicketingMillis(value) ?? 0;
}

function sortTicketRows(
  a: IssuedTicket & { id: string },
  b: IssuedTicket & { id: string },
) {
  const issuedDelta = timestampToMillis(b.issuedAt) - timestampToMillis(a.issuedAt);
  if (issuedDelta !== 0) return issuedDelta;
  return a.id.localeCompare(b.id);
}

// Buyer-managed list: all tickets attached to orders bought by this uid,
// including tickets whose holder has since been changed by sharing.
export function useManagedTickets(
  uid: string | undefined,
): UseMyTicketsResult {
  const [state, setState] = useState<UseMyTicketsResult>({
    tickets: [],
    loading: Boolean(uid),
    error: null,
  });

  useEffect(() => {
    if (!uid) {
      setState({ tickets: [], loading: false, error: null });
      return;
    }

    let disposed = false;
    let version = 0;
    let ticketUnsubs: Array<() => void> = [];

    const clearTicketUnsubs = () => {
      ticketUnsubs.forEach((unsub) => unsub());
      ticketUnsubs = [];
    };

    setState({ tickets: [], loading: true, error: null });

    const ordersQuery = query(
      collection(firestoreTicketing, "orders"),
      where("buyerUid", "==", uid),
    );

    const ordersUnsub = onSnapshot(
      ordersQuery,
      (ordersSnap) => {
        if (disposed) return;
        version += 1;
        const activeVersion = version;
        clearTicketUnsubs();

        const orderIds = Array.from(new Set(ordersSnap.docs.map((d) => d.id))).sort();
        if (orderIds.length === 0) {
          if (!disposed) {
            setState({ tickets: [], loading: false, error: null });
          }
          return;
        }

        setState({ tickets: [], loading: true, error: null });

        const orderIdChunks = chunkValues(orderIds, MANAGED_TICKETS_IN_QUERY_LIMIT);
        const chunkTickets = orderIdChunks.map(
          () => new Map<string, IssuedTicket & { id: string }>(),
        );
        const resolvedChunks = new Set<number>();
        const chunkErrors = new Map<number, Error>();

        const publish = () => {
          if (disposed || activeVersion !== version) return;

          const merged = new Map<string, IssuedTicket & { id: string }>();
          chunkTickets.forEach((ticketMap) => {
            ticketMap.forEach((ticket, ticketId) => {
              merged.set(ticketId, ticket);
            });
          });

          setState({
            tickets: Array.from(merged.values()).sort(sortTicketRows),
            loading: resolvedChunks.size < orderIdChunks.length,
            error: chunkErrors.values().next().value ?? null,
          });
        };

        orderIdChunks.forEach((orderIdChunk, chunkIndex) => {
          const ticketsQuery = query(
            collection(firestoreTicketing, "tickets"),
            where("orderId", "in", orderIdChunk),
          );
          const unsub = onSnapshot(
            ticketsQuery,
            (ticketsSnap) => {
              const nextTickets = new Map<string, IssuedTicket & { id: string }>();
              ticketsSnap.docs.forEach((d) => {
                nextTickets.set(d.id, {
                  id: d.id,
                  ...(d.data() as IssuedTicket),
                });
              });
              chunkTickets[chunkIndex] = nextTickets;
              chunkErrors.delete(chunkIndex);
              resolvedChunks.add(chunkIndex);
              publish();
            },
            (err) => {
              chunkTickets[chunkIndex] = new Map();
              chunkErrors.set(chunkIndex, err);
              resolvedChunks.add(chunkIndex);
              publish();
            },
          );
          ticketUnsubs.push(unsub);
        });
      },
      (err) => {
        version += 1;
        clearTicketUnsubs();
        if (!disposed) {
          setState({ tickets: [], loading: false, error: err });
        }
      },
    );

    return () => {
      disposed = true;
      version += 1;
      clearTicketUnsubs();
      ordersUnsub();
    };
  }, [uid]);

  if (!uid) {
    return { tickets: [], loading: false, error: null };
  }

  return state;
}
