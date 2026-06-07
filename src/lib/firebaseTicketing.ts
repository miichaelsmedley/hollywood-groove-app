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
  getDoc,
  deleteDoc,
  getFirestore,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  Timestamp,
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
  TicketPromoCode,
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
  promoCode?: string;
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
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  const response = await createCheckoutSessionCallable(input);
  return response.data;
}

// ---------------------------------------------------------------------------
// Promo-code helpers
// ---------------------------------------------------------------------------

export interface PromoCodePreview {
  id: string;
  code: string;
  discountCents: number;
  subtotalAfterDiscountCents: number;
  totalCents: number;
  discountType: TicketPromoCode["discountType"];
  percentOff?: number | null;
  amountOffCents?: number | null;
}

export interface SavePromoCodeInput {
  code: string;
  active: boolean;
  discountType: TicketPromoCode["discountType"];
  percentOff?: number | null;
  amountOffCents?: number | null;
  validUntil?: Date | null;
  maxRedemptions?: number | null;
}

function timestampToMillis(value: unknown): number {
  if (
    value &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function normalizePromoCodeInput(value: string): string | null {
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code) ? code : null;
}

function buildPromoPreview(params: {
  id: string;
  promo: TicketPromoCode;
  quantity: number;
  ticketTypeId: string;
  subtotalCents: number;
  bookingFeeCents: number;
}): PromoCodePreview {
  const now = Date.now();
  if (!params.promo.active) {
    throw new Error("That code is not active.");
  }
  if (timestampToMillis(params.promo.validFrom) > now) {
    throw new Error("That code is not valid yet.");
  }
  const validUntilMillis = timestampToMillis(params.promo.validUntil);
  if (validUntilMillis > 0 && validUntilMillis < now) {
    throw new Error("That code has expired.");
  }
  const ticketTypeIds = Array.isArray(params.promo.ticketTypeIds)
    ? params.promo.ticketTypeIds
    : [];
  if (
    ticketTypeIds.length > 0 &&
    !ticketTypeIds.includes(params.ticketTypeId)
  ) {
    throw new Error("That code is not valid for this ticket.");
  }
  const minQuantity = Number(params.promo.minQuantity ?? 0);
  if (
    Number.isFinite(minQuantity) &&
    minQuantity > 0 &&
    params.quantity < minQuantity
  ) {
    throw new Error(`That code needs at least ${minQuantity} tickets.`);
  }
  const maxRedemptions = Number(params.promo.maxRedemptions ?? 0);
  if (Number.isFinite(maxRedemptions) && maxRedemptions > 0) {
    const committed =
      Number(params.promo.redemptionCount ?? 0) +
      Number(params.promo.reservationCount ?? 0);
    if (committed >= maxRedemptions) {
      throw new Error("That code has reached its limit.");
    }
  }

  const rawDiscountCents =
    params.promo.discountType === "percent"
      ? Math.round(
          params.subtotalCents * (Number(params.promo.percentOff ?? 0) / 100),
        )
      : Math.round(Number(params.promo.amountOffCents ?? 0));
  const discountCents = Math.min(
    params.subtotalCents,
    Math.max(0, rawDiscountCents),
  );
  if (discountCents <= 0) {
    throw new Error("That code does not discount this order.");
  }
  return {
    id: params.id,
    code: params.promo.code || params.id,
    discountType: params.promo.discountType,
    percentOff: params.promo.percentOff ?? null,
    amountOffCents: params.promo.amountOffCents ?? null,
    discountCents,
    subtotalAfterDiscountCents: params.subtotalCents - discountCents,
    totalCents: params.subtotalCents - discountCents + params.bookingFeeCents,
  };
}

export async function getPromoCodePreview(input: {
  showId: string;
  ticketTypeId: string;
  quantity: number;
  subtotalCents: number;
  bookingFeeCents: number;
  promoCode: string;
}): Promise<PromoCodePreview> {
  const code = normalizePromoCodeInput(input.promoCode);
  if (!code) {
    throw new Error("Enter a valid promo code.");
  }
  let snap;
  try {
    snap = await getDoc(
      doc(firestoreTicketing, "shows", input.showId, "promoCodes", code),
    );
  } catch {
    throw new Error("That promo code was not found.");
  }
  if (!snap.exists()) {
    throw new Error("That promo code was not found.");
  }
  return buildPromoPreview({
    id: snap.id,
    promo: snap.data() as TicketPromoCode,
    quantity: input.quantity,
    ticketTypeId: input.ticketTypeId,
    subtotalCents: input.subtotalCents,
    bookingFeeCents: input.bookingFeeCents,
  });
}

export async function savePromoCode(
  showId: string,
  input: SavePromoCodeInput,
): Promise<string> {
  const code = normalizePromoCodeInput(input.code);
  if (!code) {
    throw new Error("Enter a valid promo code.");
  }
  const percentOff = Number(input.percentOff ?? 0);
  const amountOffCents = Number(input.amountOffCents ?? 0);
  if (
    input.discountType === "percent" &&
    (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100)
  ) {
    throw new Error("Percentage discount must be between 1 and 100.");
  }
  if (
    input.discountType === "amount" &&
    (!Number.isFinite(amountOffCents) || amountOffCents <= 0)
  ) {
    throw new Error("Amount discount must be greater than zero.");
  }

  await setDoc(
    doc(firestoreTicketing, "shows", showId, "promoCodes", code),
    {
      code,
      active: input.active,
      discountType: input.discountType,
      percentOff: input.discountType === "percent" ? percentOff : null,
      amountOffCents: input.discountType === "amount" ? amountOffCents : null,
      validUntil: input.validUntil
        ? Timestamp.fromDate(input.validUntil)
        : null,
      maxRedemptions:
        typeof input.maxRedemptions === "number" &&
        Number.isFinite(input.maxRedemptions) &&
        input.maxRedemptions > 0
          ? Math.floor(input.maxRedemptions)
          : null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  return code;
}

// Delete a promo code. The doc id is the normalized code. Gated server-side by
// firestore.rules (platform_admin or event_admin for the show).
export async function deletePromoCode(
  showId: string,
  code: string,
): Promise<void> {
  const normalized = normalizePromoCodeInput(code);
  if (!normalized) {
    throw new Error("Invalid promo code.");
  }
  await deleteDoc(
    doc(firestoreTicketing, "shows", showId, "promoCodes", normalized),
  );
}

// ---------------------------------------------------------------------------
// refundOrder callable wrapper (platform-admin or event-admin)
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
  "refundOrder",
);

export async function refundOrder(
  input: RefundOrderInput,
): Promise<RefundOrderResult> {
  const response = await refundOrderCallable(input);
  return response.data;
}

// ---------------------------------------------------------------------------
// issueCompTicket callable wrapper (platform-admin or event-admin)
// ---------------------------------------------------------------------------

export interface IssueCompTicketInput {
  showId: string;
  ticketTypeId: string;
  recipientName: string;
  recipientEmail: string;
  quantity?: number;
  note?: string | null;
  idempotencyKey: string;
}

export interface IssueCompTicketResult {
  ok: true;
  orderId: string;
  ticketIds: string[];
  recipientUid: string;
  recipientEmail: string;
  showId: string;
  ticketTypeId: string;
  quantity: number;
  idempotent: boolean;
  note: string;
}

const issueCompTicketCallable = httpsCallable<
  IssueCompTicketInput,
  IssueCompTicketResult
>(functions, "issueCompTicket");

export async function issueCompTicket(
  input: IssueCompTicketInput,
): Promise<IssueCompTicketResult> {
  const response = await issueCompTicketCallable(input);
  return response.data;
}

// ---------------------------------------------------------------------------
// shareTicket callable wrapper (ticket holder or buyer-of-order)
// ---------------------------------------------------------------------------

export interface ShareTicketInput {
  ticketId: string;
  recipientEmail: string;
  recipientName?: string;
}

export interface ShareTicketResult {
  ok: true;
  ticketId: string;
  sharedToEmail: string;
}

const shareTicketCallable = httpsCallable<
  ShareTicketInput,
  ShareTicketResult
>(functions, "shareTicket");

export async function shareTicket(
  input: ShareTicketInput,
): Promise<ShareTicketResult> {
  const response = await shareTicketCallable(input);
  return response.data;
}

// ---------------------------------------------------------------------------
// setAdminClaim callable wrapper (platform-admin only)
// ---------------------------------------------------------------------------

export type AdminClaimRole =
  | "platform_admin"
  | "event_admin"
  | "venue_manager"
  | "door_staff";

export interface SetAdminClaimInput {
  targetUid?: string;
  email?: string;
  role: AdminClaimRole;
  grant: boolean;
}

export interface SetAdminClaimResult {
  ok: true;
  note: string;
}

const setAdminClaimCallable = httpsCallable<
  SetAdminClaimInput,
  SetAdminClaimResult
>(functions, "setAdminClaim");

export async function setAdminClaim(
  input: SetAdminClaimInput,
): Promise<SetAdminClaimResult> {
  const response = await setAdminClaimCallable(input);
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

const grantVenueStaffCallable = httpsCallable<
  GrantVenueStaffInput,
  GrantVenueStaffResult
>(functions, "grantVenueStaff");
const revokeVenueStaffCallable = httpsCallable<
  RevokeVenueStaffInput,
  RevokeVenueStaffResult
>(functions, "revokeVenueStaff");
const claimMyPendingVenueStaffInvitesCallable = httpsCallable<
  Record<string, never>,
  {
    ok: true;
    redeemed: Array<{
      venueId: string;
      inviteId: string;
      role: VenueStaffRole;
    }>;
    note?: string;
  }
>(functions, "claimMyPendingVenueStaffInvites");
const claimMyPendingTicketsCallable = httpsCallable<
  Record<string, never>,
  {
    ok: true;
    claimed: Array<{ ticketId: string; showId: string | null }>;
  }
>(functions, "claimMyPendingTickets");

export async function grantVenueStaff(
  input: GrantVenueStaffInput,
): Promise<GrantVenueStaffResult> {
  const response = await grantVenueStaffCallable(input);
  return response.data;
}

export async function revokeVenueStaff(
  input: RevokeVenueStaffInput,
): Promise<RevokeVenueStaffResult> {
  const response = await revokeVenueStaffCallable(input);
  return response.data;
}

export async function claimMyPendingVenueStaffInvites() {
  const response = await claimMyPendingVenueStaffInvitesCallable({});
  return response.data;
}

export async function claimMyPendingTickets(): Promise<{
  ok: true;
  claimed: Array<{ ticketId: string; showId: string | null }>;
}> {
  const response = await claimMyPendingTicketsCallable({});
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
  input: ValidateTicketScanInput,
): Promise<ValidateTicketScanResult> {
  const response = await validateTicketScanCallable(input);
  return response.data;
}

// ---------------------------------------------------------------------------
// PRIS venue import bridge (platform-admin only)
// ---------------------------------------------------------------------------

export interface PrisVenuePerson {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  phone: string | null;
  location: string | null;
  updatedAt: string | null;
}

export interface PrisVenueSearchItem {
  id: number;
  name: string;
  companyType: string | null;
  companyArea: string | null;
  workspaceId: number | null;
  website: string | null;
  domain: string | null;
  address: string | null;
  capacity: number | null;
  contact: {
    id?: string | number | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  people: PrisVenuePerson[];
  peopleCount: number;
  updatedAt: string | null;
  source: "pris-cloud-crm";
}

export interface SearchPrisVenuesInput {
  search?: string;
  type?: "venue" | "agency" | "agent" | "all";
  limit?: number;
}

export interface SearchPrisVenuesResult {
  venues: PrisVenueSearchItem[];
  count: number;
}

export interface ImportPrisVenueInput {
  prisCompanyId: number;
  public?: boolean;
}

export interface ImportPrisVenueResult {
  ok: true;
  venueId: string;
  prisCompanyId: number;
  imported: boolean;
  name: string;
}

const searchPrisVenuesCallable = httpsCallable<
  SearchPrisVenuesInput,
  SearchPrisVenuesResult
>(functions, "searchPrisVenues");
const importPrisVenueCallable = httpsCallable<
  ImportPrisVenueInput,
  ImportPrisVenueResult
>(functions, "importPrisVenue");

export async function searchPrisVenues(
  input: SearchPrisVenuesInput,
): Promise<SearchPrisVenuesResult> {
  const response = await searchPrisVenuesCallable(input);
  return response.data;
}

export async function importPrisVenue(
  input: ImportPrisVenueInput,
): Promise<ImportPrisVenueResult> {
  const response = await importPrisVenueCallable(input);
  return response.data;
}

// ---------------------------------------------------------------------------
// PRIS gig → ticketed-show bridge (platform-admin only)
// ---------------------------------------------------------------------------

export interface SelfTicketGig {
  id: number;
  title: string | null;
  gigDate: string | null;
  venueName: string | null;
  sellingFrontId: string | null;
  ticketingShowId: string | null;
  ticketingStatus: string | null;
}

export interface ListSelfTicketGigsResult {
  gigs: SelfTicketGig[];
  count: number;
}

export interface CreateTicketedShowFromGigInput {
  prisGigId: number;
}

export interface CreateTicketedShowFromGigResult {
  ok: true;
  showId: string;
  ticketUrl: string;
  sellingFrontId: string;
  created: boolean;
}

const listSelfTicketGigsCallable = httpsCallable<
  Record<string, never>,
  ListSelfTicketGigsResult
>(functions, "listSelfTicketGigs");

const createTicketedShowFromGigCallable = httpsCallable<
  CreateTicketedShowFromGigInput,
  CreateTicketedShowFromGigResult
>(functions, "createTicketedShowFromGig");

export async function listSelfTicketGigs(): Promise<ListSelfTicketGigsResult> {
  const response = await listSelfTicketGigsCallable({});
  return response.data;
}

export async function createTicketedShowFromGig(
  input: CreateTicketedShowFromGigInput,
): Promise<CreateTicketedShowFromGigResult> {
  const response = await createTicketedShowFromGigCallable(input);
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
      orderBy("startDate", "desc"),
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
      (err) => setState({ shows: [], loading: false, error: err }),
    );
    return () => unsub();
  }, []);

  return state;
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

export function useVenueStaff(
  venueId: string | undefined,
): UseVenueStaffResult {
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
      (err) => setState((prev) => ({ ...prev, error: err, loading: false })),
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
      () => {},
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
      query(
        collection(firestoreTicketing, "venues"),
        orderBy("name", "asc"),
        limit(100),
      ),
      (snap) => {
        setState({
          venues: snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as TicketVenue),
          })),
          loading: false,
          error: null,
        });
      },
      (err) => setState({ venues: [], loading: false, error: err }),
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

export async function saveVenue(
  input: SaveVenueInput,
  venueId?: string,
): Promise<string> {
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
      (err) => setState({ show: null, loading: false, error: err }),
    );
    return () => unsub();
  }, [showId]);

  return state;
}

export interface UsePromoCodesResult {
  promoCodes: Array<TicketPromoCode & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function usePromoCodes(showId: string | undefined): UsePromoCodesResult {
  const [state, setState] = useState<UsePromoCodesResult>({
    promoCodes: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!showId) {
      setState({ promoCodes: [], loading: false, error: null });
      return;
    }
    const unsub = onSnapshot(
      query(
        collection(firestoreTicketing, "shows", showId, "promoCodes"),
        orderBy("code", "asc"),
      ),
      (snap) => {
        setState({
          promoCodes: snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as TicketPromoCode),
          })),
          loading: false,
          error: null,
        });
      },
      (err) => setState({ promoCodes: [], loading: false, error: err }),
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

export function useTicketTypes(
  showId: string | undefined,
): UseTicketTypesResult {
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
    const colRef = collection(
      firestoreTicketing,
      "shows",
      showId,
      "ticketTypes",
    );
    // Firestore rules grant public read on ticketTypes; client filters to active.
    const unsub = onSnapshot(
      query(colRef, orderBy("displayOrder", "asc")),
      (snap) => {
        const ticketTypes = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as TicketType) }))
          .filter((t) => t.active);
        setState({ ticketTypes, loading: false, error: null });
      },
      (err) => setState({ ticketTypes: [], loading: false, error: err }),
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
      where("buyerUid", "==", buyerUid),
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
      (err) => setState({ orders: [], loading: false, error: err }),
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

export function useMyTickets(
  memberUid: string | undefined,
): UseMyTicketsResult {
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
      where("holderMemberUid", "==", memberUid),
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
      (err) => setState({ tickets: [], loading: false, error: err }),
    );
    return () => unsub();
  }, [memberUid]);

  return state;
}

const MANAGED_TICKETS_IN_QUERY_LIMIT = 30;

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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
  return Math.max(
    0,
    ticket.quantityTotal - ticket.quantitySold - ticket.quantityReserved,
  );
}

export type {
  TicketType,
  TicketVenue,
  TicketedShow,
  TicketOrder,
  IssuedTicket,
  TicketHolderSnapshot,
};

// ---------------------------------------------------------------------------
// Ticketing admin overview hooks
// ---------------------------------------------------------------------------

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
    let pendingLoads = includePlatformDiagnostics ? 5 : 4;
    setState((prev) => ({
      ...prev,
      stripeEvents: includePlatformDiagnostics ? prev.stripeEvents : [],
      loading: true,
      error: null,
    }));
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
      query(
        collection(firestoreTicketing, "shows"),
        orderBy("startDate", "desc"),
        limit(50),
      ),
      (snap) => {
        setState((prev) => ({
          ...prev,
          shows: snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as TicketedShow),
          })),
          error: null,
        }));
        markLoaded();
      },
      setError,
    );

    const unsubOrders = onSnapshot(
      query(
        collection(firestoreTicketing, "orders"),
        orderBy("createdAt", "desc"),
        limit(50),
      ),
      (snap) => {
        setState((prev) => ({
          ...prev,
          orders: snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as TicketOrder),
          })),
          error: null,
        }));
        markLoaded();
      },
      setError,
    );

    const unsubTickets = onSnapshot(
      query(
        collection(firestoreTicketing, "tickets"),
        orderBy("issuedAt", "desc"),
        limit(200),
      ),
      (snap) => {
        setState((prev) => ({
          ...prev,
          tickets: snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as IssuedTicket),
          })),
          error: null,
        }));
        markLoaded();
      },
      setError,
    );

    const unsubRefunds = onSnapshot(
      query(
        collection(firestoreTicketing, "refunds"),
        orderBy("createdAt", "desc"),
        limit(50),
      ),
      (snap) => {
        setState((prev) => ({
          ...prev,
          refunds: snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as TicketRefund),
          })),
          error: null,
        }));
        markLoaded();
      },
      setError,
    );

    const unsubStripeEvents = includePlatformDiagnostics
      ? onSnapshot(
          query(
            collection(firestoreTicketing, "stripeEvents"),
            orderBy("processedAt", "desc"),
            limit(20),
          ),
          (snap) => {
            setState((prev) => ({
              ...prev,
              stripeEvents: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
              error: null,
            }));
            markLoaded();
          },
          setError,
        )
      : undefined;

    return () => {
      unsubShows();
      unsubOrders();
      unsubTickets();
      unsubRefunds();
      unsubStripeEvents?.();
    };
  }, [includePlatformDiagnostics]);

  return state;
}
