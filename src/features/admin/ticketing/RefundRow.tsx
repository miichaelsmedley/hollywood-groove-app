import { Badge } from "../../../components/admin/ui";
import { formatAud } from "../../../lib/firebaseTicketing";
import type {
  TicketOrder,
  TicketRefund,
} from "../../../types/ticketingContract";
import { dateLabel, refundStatusTone, shortId } from "../format";

export default function RefundRow({
  refund,
  order,
}: {
  refund: TicketRefund & { id: string };
  order: (TicketOrder & { id: string }) | undefined;
}) {
  return (
    <div className="border-b border-cinema-200 last:border-b-0 bg-cinema-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-cinema-900">
              {order?.buyerSnapshot?.email ?? refund.orderId}
            </span>
            <Badge className={refundStatusTone(refund.status)}>
              {refund.status}
            </Badge>
          </div>
          <p className="text-xs text-cinema-600">
            {refund.reason || "No reason supplied"} ·{" "}
            {dateLabel(refund.createdAt)}
          </p>
          <p className="text-[11px] text-cinema-500 font-mono">
            {shortId(refund.id)}
            {refund.stripeRefundId
              ? ` · ${shortId(refund.stripeRefundId)}`
              : ""}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-cinema-900">
            {formatAud(refund.amountCents)}
          </p>
          <p className="text-[11px] text-cinema-500">
            {refund.ticketIds?.length ?? 0} ticket(s)
          </p>
        </div>
      </div>
    </div>
  );
}
