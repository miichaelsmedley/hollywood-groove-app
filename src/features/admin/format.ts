import { formatTicketingDateTime } from "../../lib/ticketingTime";
import type {
  ShowTicketingStatus,
  TicketOrderStatus,
  TicketRefundStatus,
} from "../../types/ticketingContract";

export function dateLabel(value: unknown): string {
  return formatTicketingDateTime(value) ?? "Date TBA";
}

export function shortId(value: string): string {
  return value.length > 10
    ? `${value.slice(0, 6)}...${value.slice(-4)}`
    : value;
}

export function newIdempotencyKey(): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function showStatusTone(status: ShowTicketingStatus): string {
  if (status === "on_sale" || status === "published")
    return "bg-emerald-100 text-emerald-800";
  if (status === "sold_out") return "bg-amber-100 text-amber-800";
  if (status === "cancelled" || status === "postponed")
    return "bg-red-100 text-red-800";
  return "bg-cinema-200 text-cinema-700";
}

export function orderStatusTone(status: TicketOrderStatus): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "disputed") return "bg-red-100 text-red-800";
  if (status === "refunded" || status === "partially_refunded")
    return "bg-sky-100 text-sky-800";
  return "bg-cinema-200 text-cinema-700";
}

export function refundStatusTone(status: TicketRefundStatus): string {
  if (status === "succeeded") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "failed" || status === "cancelled")
    return "bg-red-100 text-red-800";
  return "bg-cinema-200 text-cinema-700";
}
