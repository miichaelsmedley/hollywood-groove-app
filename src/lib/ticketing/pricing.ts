import type { TicketType } from "../../types/ticketingContract";

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
