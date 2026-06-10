// Ticketing admin portal.
//
// This is the cloud transactional/admin surface for ticketing. The Swift
// controller stays focused on live show operation; ticket sales, scanner
// readiness, orders and payment-ledger health live here in the PWA.

import { Link } from "react-router-dom";
import { useState } from "react";
import SelfTicketGigsPanel from "../features/tickets/SelfTicketGigsPanel";
import { useStaffRoles } from "../hooks/useStaffRoles";
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  QrCode,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import {
  formatAud,
  refundOrder,
  useTicketingAdminOverview,
} from "../lib/firebaseTicketing";
import type { TicketOrder } from "../types/ticketingContract";
import Spinner from "../components/ui/Spinner";
import ErrorCard from "../components/ui/ErrorCard";
import {
  EmptyState,
  ReadinessCard,
  SectionHeader,
  StatCard,
} from "../components/admin/ui";
import IssueCompTicketPanel from "../features/admin/ticketing/IssueCompTicketPanel";
import OrderRow from "../features/admin/ticketing/OrderRow";
import RefundRow from "../features/admin/ticketing/RefundRow";
import ShowRow from "../features/admin/ticketing/ShowRow";
import TicketingCoAdminsPanel from "../features/admin/ticketing/TicketingCoAdminsPanel";

export default function AdminTicketing() {
  const { isPlatformAdmin, isEventAdmin } = useStaffRoles();
  const { shows, orders, tickets, refunds, stripeEvents, loading, error } =
    useTicketingAdminOverview({
      includePlatformDiagnostics: isPlatformAdmin,
    });
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasTicketingAdminClaim = isPlatformAdmin || isEventAdmin;

  const paidOrders = orders.filter(
    (o) => o.status === "paid" && o.paymentType !== "comp",
  );
  const compOrders = orders.filter((o) => o.paymentType === "comp");
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const grossCents = paidOrders.reduce(
    (sum, order) => sum + Number(order.totalCents ?? 0),
    0,
  );
  const validTickets = tickets.filter((t) => t.status === "valid");
  const usedTickets = tickets.filter((t) => t.status === "used");
  const riskTickets = tickets.filter(
    (t) => t.status === "disputed" || t.status === "lost_to_dispute",
  );
  const activeShows = shows.filter((s) =>
    ["published", "on_sale", "sold_out"].includes(s.status),
  );

  const handleRefund = async (order: TicketOrder & { id: string }) => {
    const buyer = order.buyerSnapshot?.email || "this buyer";
    const ok = window.confirm(
      `Refund ${formatAud(order.totalCents)} for ${buyer}? This will invalidate the order's tickets.`,
    );
    if (!ok) return;

    const reason = window.prompt("Refund reason", "Customer requested refund");
    if (reason === null) return;

    setBusyOrderId(order.id);
    setActionError(null);
    try {
      await refundOrder({
        orderId: order.id,
        reason: reason.trim() || "Customer requested refund",
        stripeReason: "requested_by_customer",
        forceAfterScan: false,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setBusyOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="w-7 h-7 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorCard title="Ticketing admin could not load">
        <p>{error.message}</p>
      </ErrorCard>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-bold text-cinema-900">
              Ticketing admin
            </h1>
          </div>
          <p className="text-sm text-cinema-600">
            Transactional control for Hollywood Groove and The Adele Show
            ticketing.
          </p>
        </div>
        {isPlatformAdmin && (
          <Link
            to="/admin/venues"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cinema-300 px-4 py-2 text-sm font-bold text-cinema-900 hover:border-primary/70"
          >
            <Building2 className="w-4 h-4" />
            Manage venues
          </Link>
        )}
      </header>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">
              Live payments are ON - charges are real.
            </p>
            <p className="text-sm">
              Merchant of record: The Adele Show. Handle refunds, disputes,
              and pilot purchases as live-money operations.
            </p>
          </div>
        </div>
      </section>

      {isPlatformAdmin && <SelfTicketGigsPanel />}

      {isPlatformAdmin && <TicketingCoAdminsPanel />}

      {hasTicketingAdminClaim && <IssueCompTicketPanel shows={shows} />}

      {actionError && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{actionError}</p>
          </div>
        </section>
      )}

      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        aria-label="Ticketing totals"
      >
        <StatCard
          label="Active shows"
          value={String(activeShows.length)}
          Icon={Calendar}
        />
        <StatCard
          label="Paid orders"
          value={String(paidOrders.length)}
          Icon={CreditCard}
        />
        <StatCard
          label="Gross paid"
          value={formatAud(grossCents)}
          Icon={Activity}
        />
        <StatCard
          label="Comp orders"
          value={String(compOrders.length)}
          Icon={Gift}
        />
      </section>

      <section className={`grid gap-3 ${isPlatformAdmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <ReadinessCard
          ok={hasTicketingAdminClaim}
          title="Admin login"
          description="You are authenticated with a ticketing admin claim and can see the ticketing ledger."
        />
        {isPlatformAdmin && (
          <ReadinessCard
            ok={stripeEvents.some((event) => event.status === "processed")}
            title="Webhook ledger"
            description="Stripe event idempotency is visible in the ticketing database."
          />
        )}
        <ReadinessCard
          ok
          title="Refund controls"
          description="Ticketing admins can issue full-order refunds and invalidate tickets from this portal."
        />
      </section>

      <section className="space-y-3">
        <SectionHeader Icon={Calendar} title="Shows on the ticketing ledger" />
        {shows.length === 0 ? (
          <EmptyState>No ticketed shows exist yet.</EmptyState>
        ) : (
          <div className="space-y-2">
            {shows.slice(0, 12).map((show) => (
              <ShowRow
                key={show.id}
                show={show}
                tickets={tickets}
                canManageStaff={isPlatformAdmin}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader Icon={CreditCard} title="Recent orders" />
        {orders.length === 0 ? (
          <EmptyState>No orders yet.</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-cinema-200">
            {orders.slice(0, 12).map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                show={shows.find((s) => s.id === order.showId)}
                refunds={refunds.filter(
                  (refund) => refund.orderId === order.id,
                )}
                busy={busyOrderId === order.id}
                onRefund={() => handleRefund(order)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader Icon={AlertTriangle} title="Recent refunds" />
        {refunds.length === 0 ? (
          <EmptyState>No refunds yet.</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-cinema-200">
            {refunds.slice(0, 8).map((refund) => (
              <RefundRow
                key={refund.id}
                refund={refund}
                order={orders.find((order) => order.id === refund.orderId)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader Icon={QrCode} title="Ticket states" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Valid"
            value={String(validTickets.length)}
            Icon={Ticket}
          />
          <StatCard
            label="Used"
            value={String(usedTickets.length)}
            Icon={CheckCircle2}
          />
          <StatCard
            label="Pending orders"
            value={String(pendingOrders.length)}
            Icon={Clock}
          />
          <StatCard
            label="Risk/dispute"
            value={String(riskTickets.length)}
            Icon={AlertTriangle}
          />
        </div>
      </section>
    </div>
  );
}
