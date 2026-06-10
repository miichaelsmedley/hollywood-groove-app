import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "../../../components/admin/ui";
import { formatAud } from "../../../lib/firebaseTicketing";
import type {
  TicketOrder,
  TicketRefund,
  TicketedShow,
} from "../../../types/ticketingContract";
import { dateLabel, orderStatusTone, shortId } from "../format";

export default function OrderRow({
  order,
  show,
  refunds,
  busy,
  onRefund,
}: {
  order: TicketOrder & { id: string };
  show: (TicketedShow & { id: string }) | undefined;
  refunds: Array<TicketRefund & { id: string }>;
  busy: boolean;
  onRefund: () => void;
}) {
  const refundedCents = refunds
    .filter((refund) => refund.status === "succeeded")
    .reduce((sum, refund) => sum + Number(refund.amountCents ?? 0), 0);
  const isComp = order.paymentType === "comp";
  const canRefund =
    order.status === "paid" &&
    !isComp &&
    Number(order.totalCents ?? 0) > 0 &&
    Boolean(order.stripePaymentIntentId);

  return (
    <div className="border-b border-cinema-200 last:border-b-0 bg-cinema-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-cinema-900">
              {show?.title ?? order.showId}
            </span>
            <Badge className={orderStatusTone(order.status)}>
              {order.status}
            </Badge>
            {isComp && (
              <Badge className="bg-primary/20 text-cinema-900">comp</Badge>
            )}
          </div>
          <p className="text-xs text-cinema-600">
            {order.buyerSnapshot?.email || "No buyer email"} ·{" "}
            {dateLabel(order.createdAt)}
          </p>
          <p className="text-[11px] text-cinema-500 font-mono">
            {shortId(order.id)}
            {order.stripePaymentIntentId
              ? ` · ${shortId(order.stripePaymentIntentId)}`
              : ""}
          </p>
          {refundedCents > 0 && (
            <p className="text-[11px] text-sky-700">
              Refunded {formatAud(refundedCents)}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0 space-y-2">
          <p className="text-sm font-bold text-cinema-900">
            {formatAud(order.totalCents)}
          </p>
          <p className="text-[11px] text-cinema-500">
            {order.lineItems?.[0]?.quantity ?? 0} ticket(s)
          </p>
          {canRefund && (
            <button
              type="button"
              onClick={onRefund}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              Refund
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
