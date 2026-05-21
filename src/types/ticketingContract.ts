// Firestore ticketing contract for the Hollywood Groove shared ticketing ledger.
// Phase 1 only defines schema and emulator fixtures; Stripe and purchase UI arrive later.

export type TicketingTimestamp =
  | Date
  | number
  | {
      seconds: number;
      nanoseconds: number;
      toMillis?: () => number;
    };

export type SellingFrontId = "hollywood_groove" | "adele_show" | (string & {});
export type TicketCurrency = "AUD";

export type TicketingRole = "platform_admin" | "event_admin" | "venue_manager" | "door_staff";

export type ShowTicketingStatus =
  | "draft"
  | "published"
  | "on_sale"
  | "sold_out"
  | "cancelled"
  | "postponed"
  | "completed";

export type TicketOrderStatus =
  | "pending"
  | "paid"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "disputed";

export type TicketStatus =
  | "valid"
  | "used"
  | "cancelled"
  | "refunded"
  | "disputed"
  | "lost_to_dispute";

export type TicketPaymentType = "charge" | "refund" | "dispute" | "comp" | "cash";
export type TicketPaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "disputed";

export type TicketRefundStatus = "pending" | "succeeded" | "failed" | "cancelled";

export type TicketScanResult =
  | "valid"
  | "already_used"
  | "wrong_event"
  | "refunded"
  | "cancelled"
  | "disputed"
  | "not_found";

export type TicketConsentSource =
  | "ticket_purchase"
  | "self_confirm"
  | "join_show"
  | "import";

export type TicketAuditAction =
  | "refund"
  | "comp_issue"
  | "cash_issue"
  | "name_edit"
  | "role_grant"
  | "role_revoke"
  | "force_refund_after_scan"
  | "ticket_type_create"
  | "ticket_type_update"
  | "ticket_scan"
  | "ticket_issue"
  | "reservation_expire";

export interface TicketSellingFront {
  displayName: string;
  slug: string;
  active: boolean;
  displayOrder: number;
  defaultCurrency: TicketCurrency;
  publicSiteUrl?: string;
  supportEmail?: string;
  // MVP merchant of record is The Adele Show (ABN + .com.au) for both fronts.
  // Phase 9 (Stripe Connect) opens this up to per-venue or per-front MoR;
  // typed loosely so we don't have to churn the contract again then.
  merchantOfRecord: SellingFrontId;
  createdAt: TicketingTimestamp;
  updatedAt: TicketingTimestamp;
}

export interface TicketVenue {
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
  createdAt: TicketingTimestamp;
  updatedAt: TicketingTimestamp;
}

// Path: /venues/{venueId}/eligibleStaff/{uid}
export interface TicketVenueEligibleStaff {
  role: Extract<TicketingRole, "venue_manager" | "door_staff">;
  grantedBy: string;
  grantedAt: TicketingTimestamp;
}

export interface TicketRefundPolicy {
  mode: "default" | "custom";
  cutoffHours: number;
  allowAfterScan: boolean;
}

// Path: /shows/{showId}
export interface TicketedShow {
  title: string;
  sellingFrontId: SellingFrontId;
  startDate: TicketingTimestamp;
  venueId: string;
  status: ShowTicketingStatus;
  capacity: number;
  ticketingEnabled: boolean;
  currency: TicketCurrency;
  refundPolicy: TicketRefundPolicy;
  rtdbShowId?: string;
  eventAdminUids?: string[];
  createdBy: string;
  createdAt: TicketingTimestamp;
  updatedAt: TicketingTimestamp;
  publishedAt?: TicketingTimestamp | null;
}

// Path: /shows/{showId}/ticketTypes/{ticketTypeId}
export interface TicketType {
  name: string;
  description?: string;
  priceCents: number;
  bookingFeeCents: number;
  currency: TicketCurrency;
  quantityTotal: number;
  quantitySold: number;
  quantityReserved: number;
  saleStartAt: TicketingTimestamp;
  saleEndAt: TicketingTimestamp;
  maxPerOrder: number;
  active: boolean;
  displayOrder: number;
  createdAt: TicketingTimestamp;
  updatedAt: TicketingTimestamp;
}

export interface TicketBuyerSnapshot {
  email?: string | null;
  displayName?: string | null;
  suburb?: string | null;
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
  socials?: Record<string, string>;
}

export interface TicketOrderLineItem {
  ticketTypeId: string;
  name: string;
  quantity: number;
  priceCents: number;
  bookingFeeCents: number;
  subtotalCents: number;
  bookingFeeTotalCents: number;
  totalCents: number;
}

export interface TicketHolderSnapshot {
  holderName: string;
  holderEmail: string;
  holderPhone?: string | null;
  holderEmailOptIn: boolean;
  holderSmsOptIn: boolean;
}

// Path: /orders/{orderId}
export interface TicketOrder {
  showId: string;
  sellingFrontId: SellingFrontId;
  buyerUid: string;
  buyerSnapshot: TicketBuyerSnapshot;
  status: TicketOrderStatus;
  lineItems: TicketOrderLineItem[];
  holders?: TicketHolderSnapshot[];
  stripeCheckoutSessionId?: string | null;
  stripeCheckoutSessionUrl?: string | null;
  stripePaymentIntentId?: string | null;
  subtotalCents: number;
  bookingFeeCents: number;
  stripeFeeCents?: number | null;
  totalCents: number;
  currency: TicketCurrency;
  createdAt: TicketingTimestamp;
  reservationExpiresAt?: TicketingTimestamp | null;
  paidAt?: TicketingTimestamp | null;
}

// Path: /orders/{orderId}/payments/{paymentId}
export interface TicketPayment {
  type: TicketPaymentType;
  stripeId?: string | null;
  amountCents: number;
  feeCents?: number | null;
  status: TicketPaymentStatus;
  createdAt: TicketingTimestamp;
  reason?: string | null;
}

// Path: /tickets/{ticketId}
export interface IssuedTicket {
  orderId: string;
  showId: string;
  sellingFrontId: SellingFrontId;
  ticketTypeId: string;
  holderName: string;
  holderEmail: string;
  holderPhone?: string | null;
  holderEmailOptIn: boolean;
  holderSmsOptIn: boolean;
  holderConsentSource: TicketConsentSource;
  holderConsentAt: TicketingTimestamp | null;
  holderMemberUid?: string | null;
  status: TicketStatus;
  qrToken?: string;
  qrTokenHash: string;
  issuedAt: TicketingTimestamp;
  usedAt?: TicketingTimestamp | null;
  usedByStaffUid?: string | null;
}

// Path: /tickets/{ticketId}/scanEvents/{scanId}
export interface TicketScanEvent {
  scannedAt: TicketingTimestamp;
  scannedByUid: string;
  result: TicketScanResult;
  deviceInfo?: string | Record<string, unknown>;
  idempotencyKey: string;
}

// Path: /stripeEvents/{eventId}
export interface StripeEventLedgerEntry {
  type: string;
  processedAt: TicketingTimestamp;
  status: "pending" | "processed" | "failed" | "ignored";
  relatedOrderId?: string | null;
}

// Path: /refunds/{refundId}
export interface TicketRefund {
  orderId: string;
  ticketIds: string[];
  amountCents: number;
  bookingFeeRefundedCents: number;
  stripeFeeNotReturnedCents: number;
  reason: string;
  forceAfterScan: boolean;
  stripeRefundId?: string | null;
  status: TicketRefundStatus;
  initiatedByUid: string;
  createdAt: TicketingTimestamp;
}

// Path: /auditLog/{logId}
export interface TicketAuditLogEntry {
  actorUid: string;
  action: TicketAuditAction;
  targetType: "sellingFront" | "venue" | "show" | "ticketType" | "order" | "ticket" | "refund" | "role";
  targetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  serverTimestamp: TicketingTimestamp;
}

export const TICKETING_SELLING_FRONTS: Record<"hollywoodGroove" | "adeleShow", SellingFrontId> = {
  hollywoodGroove: "hollywood_groove",
  adeleShow: "adele_show",
};
