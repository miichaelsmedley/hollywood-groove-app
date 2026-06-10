import { collection, limit, orderBy, query } from "firebase/firestore";
import { useMemo } from "react";
import { firestoreTicketing } from "../client";
import { useFirestoreCollection } from "./firestore";
import type {
  IssuedTicket,
  TicketOrder,
  TicketPromoCode,
  TicketRefund,
  TicketedShow,
} from "../../../types/ticketingContract";

export interface UsePromoCodesResult {
  promoCodes: Array<TicketPromoCode & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function usePromoCodes(showId: string | undefined): UsePromoCodesResult {
  const promoCodesQuery = useMemo(
    () =>
      showId
        ? query(
            collection(firestoreTicketing, "shows", showId, "promoCodes"),
            orderBy("code", "asc"),
          )
        : null,
    [showId],
  );
  const { items, loading, error } =
    useFirestoreCollection<TicketPromoCode>(promoCodesQuery);
  return { promoCodes: items, loading, error };
}

export interface UseTicketingAdminOverviewOptions {
  includePlatformDiagnostics?: boolean;
}

export interface UseTicketingAdminOverviewResult {
  shows: Array<TicketedShow & { id: string }>;
  orders: Array<TicketOrder & { id: string }>;
  tickets: Array<IssuedTicket & { id: string }>;
  refunds: Array<TicketRefund & { id: string }>;
  stripeEvents: Array<{
    id: string;
    type?: string;
    status?: string;
    relatedOrderId?: string | null;
    processedAt?: unknown;
  }>;
  loading: boolean;
  error: Error | null;
}

/**
 * Ticketing-admin operational snapshot for the ticketing admin portal.
 *
 * Firestore rules allow ticketing ledger reads for `platform_admin` and
 * `event_admin`. Platform diagnostics such as Stripe event idempotency stay
 * platform-admin-only and are opt-in.
 */
export function useTicketingAdminOverview(
  options: UseTicketingAdminOverviewOptions = {},
): UseTicketingAdminOverviewResult {
  const includePlatformDiagnostics = options.includePlatformDiagnostics === true;
  const showsQuery = useMemo(
    () =>
      query(
        collection(firestoreTicketing, "shows"),
        orderBy("startDate", "desc"),
        limit(50),
      ),
    [],
  );
  const ordersQuery = useMemo(
    () =>
      query(
        collection(firestoreTicketing, "orders"),
        orderBy("createdAt", "desc"),
        limit(50),
      ),
    [],
  );
  const ticketsQuery = useMemo(
    () =>
      query(
        collection(firestoreTicketing, "tickets"),
        orderBy("issuedAt", "desc"),
        limit(200),
      ),
    [],
  );
  const refundsQuery = useMemo(
    () =>
      query(
        collection(firestoreTicketing, "refunds"),
        orderBy("createdAt", "desc"),
        limit(50),
      ),
    [],
  );
  const stripeEventsQuery = useMemo(
    () =>
      includePlatformDiagnostics
        ? query(
            collection(firestoreTicketing, "stripeEvents"),
            orderBy("processedAt", "desc"),
            limit(20),
          )
        : null,
    [includePlatformDiagnostics],
  );

  const shows = useFirestoreCollection<TicketedShow>(showsQuery);
  const orders = useFirestoreCollection<TicketOrder>(ordersQuery);
  const tickets = useFirestoreCollection<IssuedTicket>(ticketsQuery);
  const refunds = useFirestoreCollection<TicketRefund>(refundsQuery);
  const stripeEvents =
    useFirestoreCollection<{
      type?: string;
      status?: string;
      relatedOrderId?: string | null;
      processedAt?: unknown;
    }>(stripeEventsQuery);

  return {
    shows: shows.items,
    orders: orders.items,
    tickets: tickets.items,
    refunds: refunds.items,
    stripeEvents: includePlatformDiagnostics ? stripeEvents.items : [],
    loading:
      shows.loading ||
      orders.loading ||
      tickets.loading ||
      refunds.loading ||
      (includePlatformDiagnostics && stripeEvents.loading),
    error:
      shows.error ||
      orders.error ||
      tickets.error ||
      refunds.error ||
      (includePlatformDiagnostics ? stripeEvents.error : null),
  };
}
