import { httpsCallable } from "firebase/functions";
import { functions } from "./client";
import type { TicketBuyerSnapshot } from "../../types/ticketingContract";

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
