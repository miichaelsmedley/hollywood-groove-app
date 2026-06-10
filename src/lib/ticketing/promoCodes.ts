import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { toTicketingMillis } from "../ticketingTime";
import { firestoreTicketing } from "./client";
import type { TicketPromoCode } from "../../types/ticketingContract";

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
  return toTicketingMillis(value) ?? 0;
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
