// Ticketing-side Firebase wiring for the PWA.
//
// Phases 0.5–2 deployed the backend; this module is the buyer-side entry point.
// It targets:
//   - the named "ticketing" Firestore database in production (Sydney)
//   - the deployed createCheckoutSession callable in asia-southeast1
//
// Server requires Firebase Auth (anonymous OK) + App Check on the callable.
// useAuthBootstrap mounts an anonymous session for every visitor; firebase.ts
// initialises App Check with ReCaptchaV3 when VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY
// is present, so callable invocations work in production.

import {
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import app from "./firebase";
import type {
  IssuedTicket,
  TicketBuyerSnapshot,
  TicketHolderSnapshot,
  TicketOrder,
  TicketRefund,
  TicketType,
  TicketVenue,
  TicketedShow,
} from "../types/ticketingContract";

const TICKETING_DATABASE_ID = "ticketing";
const FUNCTIONS_REGION = "asia-southeast1";

export const firestoreTicketing = getFirestore(app, TICKETING_DATABASE_ID);
const functions = getFunctions(app, FUNCTIONS_REGION);

// ---------------------------------------------------------------------------
// createCheckoutSession callable wrapper
// ---------------------------------------------------------------------------

export interface CheckoutHolderInput {
  holderName: string;
  holderEmail: string;
  holderPhone?: string | null;
  holderEmailOptIn: boolean;
  holderSmsOptIn: boolean;
}

export interface CreateCheckoutSessionInput {
  showId: string;
  ticketTypeId: string;
  quantity: number;
  sellingFrontId?: string;
  buyerSnapshot?: TicketBuyerSnapshot;
  holders?: CheckoutHolderInput[];
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutSessionResult {
  orderId: string;
  checkoutSessionId: string;
  url: string;
  expiresAt: number;
}

const createCheckoutSessionCallable = httpsCallable<
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult
>(functions, "createCheckoutSession");

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  const response = await createCheckoutSessionCallable(input);
  return response.data;
}

// ---------------------------------------------------------------------------
// refundOrder callable wrapper (platform-admin only)
// ---------------------------------------------------------------------------

export interface RefundOrderInput {
  orderId: string;
  reason: string;
  stripeReason?: "duplicate" | "fraudulent" | "requested_by_customer";
  forceAfterScan?: boolean;
}

export interface RefundOrderResult {
  ok: true;
  refundId: string;
  stripeRefundId: string;
  orderId: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amountCents: number;
  ticketIds: string[];
  note: string;
}

const refundOrderCallable = httpsCallable<RefundOrderInput, RefundOrderResult>(
  functions,
  "refundOrder"
);

export async function refundOrder(input: RefundOrderInput): Promise<RefundOrderResult> {
  const response = await refundOrderCallable(input);
  return response.data;
}

// ---------------------------------------------------------------------------
// Venue staff management callables (Phase 4a)
// ---------------------------------------------------------------------------

export type VenueStaffRole = "door_staff" | "venue_manager";

export interface GrantVenueStaffInput {
  venueId: string;
  email?: string;
  targetUid?: string;
  role: VenueStaffRole;
  expiresAt?: number | null;
}

export type GrantVenueStaffResult =
  | { ok: true; outcome: "granted"; targetUid: string; note?: string }
  | { ok: true; outcome: "invited"; inviteId: string; note?: string };

export interface RevokeVenueStaffInput {
  venueId: string;
  targetUid?: string;
  email?: string;
}

export type RevokeVenueStaffResult =
  | { ok: true; outcome: "revoked" }
  | { ok: true; outcome: "invite_cancelled"; count: number };

const grantVenueStaffCallable = httpsCallable<GrantVenueStaffInput, GrantVenueStaffResult>(
  functions,
  "grantVenueStaff"
);
const revokeVenueStaffCallable = httpsCallable<RevokeVenueStaffInput, RevokeVenueStaffResult>(
  functions,
  "revokeVenueStaff"
);
const claimMyPendingVenueStaffInvitesCallable = httpsCallable<
  Record<string, never>,
  { ok: true; redeemed: Array<{ venueId: string; inviteId: string; role: VenueStaffRole }>; note?: string }
>(functions, "claimMyPendingVenueStaffInvites");

export async function grantVenueStaff(input: GrantVenueStaffInput): Promise<GrantVenueStaffResult> {
  const response = await grantVenueStaffCallable(input);
  return response.data;
}

export async function revokeVenueStaff(input: RevokeVenueStaffInput): Promise<RevokeVenueStaffResult> {
  const response = await revokeVenueStaffCallable(input);
  return response.data;
}

export async function claimMyPendingVenueStaffInvites() {
  const response = await claimMyPendingVenueStaffInvitesCallable({});
  return response.data;
}

// ---------------------------------------------------------------------------
// validateTicketScan callable (Phase 4b — door scanner)
// ---------------------------------------------------------------------------

export type ScanResult =
  | "valid"
  | "already_used"
  | "wrong_event"
  | "refunded"
  | "cancelled"
  | "disputed"
  | "not_found";

export interface ValidateTicketScanInput {
  qrToken: string;
  showId: string;
  deviceInfo?: string | null;
}

export interface ValidateTicketScanResult {
  result: ScanResult;
  ticketId: string | null;
  holderName: string | null;
  ticketTypeId: string | null;
  scannedAt: number;
  note: string;
}

const validateTicketScanCallable = httpsCallable<
  ValidateTicketScanInput,
  ValidateTicketScanResult
>(functions, "validateTicketScan");

export async function validateTicketScan(
  input: ValidateTicketScanInput
): Promise<ValidateTicketScanResult> {
  const response = await validateTicketScanCallable(input);
  return response.data;
}

// Public-status ticketed shows the door scanner can be pointed at. Restricted
// to published/on_sale/sold_out so every returned doc satisfies the public
// read rule (a draft show would be rejected by Firestore rules on a list).
export interface UseScannableShowsResult {
  shows: Array<TicketedShow & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function useScannableShows(): UseScannableShowsResult {
  const [state, setState] = useState<UseScannableShowsResult>({
    shows: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const q = query(
      collection(firestoreTicketing, "shows"),
      where("ticketingEnabled", "==", true),
      where("status", "in", ["published", "on_sale", "sold_out"]),
      orderBy("startDate", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const shows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as TicketedShow),
        }));
        setState({ shows, loading: false, error: null });
      },
      (err) => setState({ shows: [], loading: false, error: err })
    );
    return () => unsub();
  }, []);

  return state;
}

export interface VenueEligibleStaff {
  uid: string;
  role: VenueStaffRole;
  grantedBy?: string;
  grantedAt?: unknown;
  expiresAt?: unknown;
  invitedEmail?: string | null;
}

export interface VenueStaffInvite {
  email: string;
  emailHash: string;
  role: VenueStaffRole;
  expiresAt?: unknown;
  invitedByUid?: string;
  invitedAt?: unknown;
}

export interface UseVenueStaffResult {
  staff: Array<VenueEligibleStaff & { id: string }>;
  invites: Array<VenueStaffInvite & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function useVenueStaff(venueId: string | undefined): UseVenueStaffResult {
  const [state, setState] = useState<UseVenueStaffResult>({
    staff: [],
    invites: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!venueId) {
      setState({ staff: [], invites: [], loading: false, error: null });
      return;
    }
    const venueRef = doc(firestoreTicketing, "venues", venueId);
    const staffUnsub = onSnapshot(
      collection(venueRef, "eligibleStaff"),
      (snap) => {
        const staff = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as VenueEligibleStaff),
        }));
        setState((prev) => ({ ...prev, staff, loading: false, error: null }));
      },
      (err) => setState((prev) => ({ ...prev, error: err, loading: false }))
    );
    const invitesUnsub = onSnapshot(
      collection(venueRef, "eligibleStaffInvites"),
      (snap) => {
        const invites = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as VenueStaffInvite),
        }));
        setState((prev) => ({ ...prev, invites }));
      },
      // Non-admins can't read invites; swallow rather than surfacing as an
      // error so the staff list still renders.
      () => {}
    );
    return () => {
      staffUnsub();
      invitesUnsub();
    };
  }, [venueId]);

  return state;
}

// ---------------------------------------------------------------------------
// Venue admin helpers
// ---------------------------------------------------------------------------

export interface UseAdminVenuesResult {
  venues: Array<TicketVenue & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export interface SaveVenueInput {
  name: string;
  address?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  capacity?: number;
  public: boolean;
  stripeConnectAccountId?: string | null;
}

export function useAdminVenues(): UseAdminVenuesResult {
  const [state, setState] = useState<UseAdminVenuesResult>({
    venues: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(firestoreTicketing, "venues"), orderBy("name", "asc"), limit(100)),
      (snap) => {
        setState({
          venues: snap.docs.map((d) => ({ id: d.id, ...(d.data() as TicketVenue) })),
          loading: false,
          error: null,
        });
      },
      (err) => setState({ venues: [], loading: false, error: err })
    );
    return () => unsub();
  }, []);

  return state;
}

function cleanVenuePayload(input: SaveVenueInput): Record<string, unknown> {
  const contact = {
    name: input.contact?.name?.trim() || undefined,
    email: input.contact?.email?.trim() || undefined,
    phone: input.contact?.phone?.trim() || undefined,
  };
  const hasContact = Boolean(contact.name || contact.email || contact.phone);

  return {
    name: input.name.trim(),
    address: input.address?.trim() || "",
    public: input.public,
    capacity:
      typeof input.capacity === "number" && Number.isFinite(input.capacity)
        ? Math.max(0, Math.floor(input.capacity))
        : null,
    contact: hasContact ? contact : {},
    stripeConnectAccountId: input.stripeConnectAccountId?.trim() || null,
    updatedAt: serverTimestamp(),
  };
}

export async function saveVenue(input: SaveVenueInput, venueId?: string): Promise<string> {
  const payload = cleanVenuePayload(input);
  if (venueId) {
    await updateDoc(doc(firestoreTicketing, "venues", venueId), payload);
    return venueId;
  }

  const created = await addDoc(collection(firestoreTicketing, "venues"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// Hooks: live Firestore reads with Firestore real-time listeners
// ---------------------------------------------------------------------------

export interface UseTicketedShowResult {
  show: (TicketedShow & { id: string }) | null;
  loading: boolean;
  error: Error | null;
}

export function useTicketedShow(showId: string | undefined): UseTicketedShowResult {
  const [state, setState] = useState<UseTicketedShowResult>({
    show: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!showId) {
      setState({ show: null, loading: false, error: null });
      return;
    }
    const ref = doc(firestoreTicketing, "shows", showId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState({ show: null, loading: false, error: null });
          return;
        }
        setState({
          show: { id: snap.id, ...(snap.data() as TicketedShow) },
          loading: false,
          error: null,
        });
      },
      (err) => setState({ show: null, loading: false, error: err })
    );
    return () => unsub();
  }, [showId]);

  return state;
}

export interface UseTicketTypesResult {
  ticketTypes: Array<TicketType & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function useTicketTypes(showId: string | undefined): UseTicketTypesResult {
  const [state, setState] = useState<UseTicketTypesResult>({
    ticketTypes: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!showId) {
      setState({ ticketTypes: [], loading: false, error: null });
      return;
    }
    const colRef = collection(firestoreTicketing, "shows", showId, "ticketTypes");
    // Firestore rules grant public read on ticketTypes; client filters to active.
    const unsub = onSnapshot(
      query(colRef, orderBy("displayOrder", "asc")),
      (snap) => {
        const ticketTypes = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as TicketType) }))
          .filter((t) => t.active);
        setState({ ticketTypes, loading: false, error: null });
      },
      (err) => setState({ ticketTypes: [], loading: false, error: err })
    );
    return () => unsub();
  }, [showId]);

  return state;
}

export interface UseMyOrdersResult {
  orders: Array<TicketOrder & { id: string }>;
  loading: boolean;
  error: Error | null;
}

// Buyer-side list of their own orders. Rules enforce buyerUid == request.auth.uid.
export function useMyOrders(buyerUid: string | undefined): UseMyOrdersResult {
  const [state, setState] = useState<UseMyOrdersResult>({
    orders: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!buyerUid) {
      setState({ orders: [], loading: false, error: null });
      return;
    }
    const q = query(
      collection(firestoreTicketing, "orders"),
      where("buyerUid", "==", buyerUid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as TicketOrder),
        }));
        setState({ orders, loading: false, error: null });
      },
      (err) => setState({ orders: [], loading: false, error: err })
    );
    return () => unsub();
  }, [buyerUid]);

  return state;
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

export function useMyTickets(memberUid: string | undefined): UseMyTicketsResult {
  const [state, setState] = useState<UseMyTicketsResult>({
    tickets: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!memberUid) {
      setState({ tickets: [], loading: false, error: null });
      return;
    }
    const q = query(
      collection(firestoreTicketing, "tickets"),
      where("holderMemberUid", "==", memberUid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const tickets = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as IssuedTicket),
        }));
        setState({ tickets, loading: false, error: null });
      },
      (err) => setState({ tickets: [], loading: false, error: err })
    );
    return () => unsub();
  }, [memberUid]);

  return state;
}

// ---------------------------------------------------------------------------
// Pricing helpers (display-only; server validates authoritatively)
// ---------------------------------------------------------------------------

export function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function ticketTypePricingPreview(ticket: TicketType, quantity: number) {
  const subtotalCents = ticket.priceCents * quantity;
  const bookingFeeTotalCents = ticket.bookingFeeCents * quantity;
  const totalCents = subtotalCents + bookingFeeTotalCents;
  return { subtotalCents, bookingFeeTotalCents, totalCents };
}

export function ticketAvailableCount(ticket: TicketType): number {
  return Math.max(0, ticket.quantityTotal - ticket.quantitySold - ticket.quantityReserved);
}

export type { TicketType, TicketVenue, TicketedShow, TicketOrder, IssuedTicket, TicketHolderSnapshot };

// ---------------------------------------------------------------------------
// Platform admin overview hooks
// ---------------------------------------------------------------------------

export interface UseTicketingAdminOverviewResult {
  shows: Array<TicketedShow & { id: string }>;
  orders: Array<TicketOrder & { id: string }>;
  tickets: Array<IssuedTicket & { id: string }>;
  refunds: Array<TicketRefund & { id: string }>;
  stripeEvents: Array<{ id: string; type?: string; status?: string; relatedOrderId?: string | null; processedAt?: unknown }>;
  loading: boolean;
  error: Error | null;
}

/**
 * Platform-admin operational snapshot for the ticketing admin portal.
 *
 * Firestore rules allow these reads only for `platform_admin`; ordinary users
 * will receive permission-denied and the route itself is wrapped in AdminRoute.
 */
export function useTicketingAdminOverview(): UseTicketingAdminOverviewResult {
  const [state, setState] = useState<UseTicketingAdminOverviewResult>({
    shows: [],
    orders: [],
    tickets: [],
    refunds: [],
    stripeEvents: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let pendingLoads = 5;
    const markLoaded = () => {
      pendingLoads -= 1;
      if (pendingLoads <= 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    };
    const setError = (error: Error) => {
      setState((prev) => ({ ...prev, loading: false, error }));
    };

    const unsubShows = onSnapshot(
      query(collection(firestoreTicketing, "shows"), orderBy("startDate", "desc"), limit(50)),
      (snap) => {
        setState((prev) => ({
          ...prev,
          shows: snap.docs.map((d) => ({ id: d.id, ...(d.data() as TicketedShow) })),
          error: null,
        }));
        markLoaded();
      },
      setError
    );

    const unsubOrders = onSnapshot(
      query(collection(firestoreTicketing, "orders"), orderBy("createdAt", "desc"), limit(50)),
      (snap) => {
        setState((prev) => ({
          ...prev,
          orders: snap.docs.map((d) => ({ id: d.id, ...(d.data() as TicketOrder) })),
          error: null,
        }));
        markLoaded();
      },
      setError
    );

    const unsubTickets = onSnapshot(
      query(collection(firestoreTicketing, "tickets"), orderBy("issuedAt", "desc"), limit(200)),
      (snap) => {
        setState((prev) => ({
          ...prev,
          tickets: snap.docs.map((d) => ({ id: d.id, ...(d.data() as IssuedTicket) })),
          error: null,
        }));
        markLoaded();
      },
      setError
    );

    const unsubRefunds = onSnapshot(
      query(collection(firestoreTicketing, "refunds"), orderBy("createdAt", "desc"), limit(50)),
      (snap) => {
        setState((prev) => ({
          ...prev,
          refunds: snap.docs.map((d) => ({ id: d.id, ...(d.data() as TicketRefund) })),
          error: null,
        }));
        markLoaded();
      },
      setError
    );

    const unsubStripeEvents = onSnapshot(
      query(collection(firestoreTicketing, "stripeEvents"), orderBy("processedAt", "desc"), limit(20)),
      (snap) => {
        setState((prev) => ({
          ...prev,
          stripeEvents: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          error: null,
        }));
        markLoaded();
      },
      setError
    );

    return () => {
      unsubShows();
      unsubOrders();
      unsubTickets();
      unsubRefunds();
      unsubStripeEvents();
    };
  }, []);

  return state;
}
