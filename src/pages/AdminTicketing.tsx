// Ticketing admin portal.
//
// This is the cloud transactional/admin surface for ticketing. The Swift
// controller stays focused on live show operation; ticket sales, scanner
// readiness, orders and payment-ledger health live here in the PWA.

import { Link } from "react-router-dom";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import SelfTicketGigsPanel from "../features/tickets/SelfTicketGigsPanel";
import { useStaffRoles } from "../hooks/useStaffRoles";
import {
  Activity,
  AlertTriangle,
  BadgePercent,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Gift,
  Loader2,
  QrCode,
  Save,
  Send,
  ShieldCheck,
  Ticket,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  formatAud,
  issueCompTicket,
  refundOrder,
  savePromoCode,
  setAdminClaim,
  ticketAvailableCount,
  usePromoCodes,
  useTicketTypes,
  useTicketingAdminOverview,
} from "../lib/firebaseTicketing";
import type {
  IssuedTicket,
  ShowTicketingStatus,
  TicketOrder,
  TicketOrderStatus,
  TicketPromoCode,
  TicketRefund,
  TicketRefundStatus,
  TicketedShow,
} from "../types/ticketingContract";

function toMillis(value: unknown): number | null {
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
  return null;
}

function dateLabel(value: unknown): string {
  const millis = toMillis(value);
  if (!millis) return "Date TBA";
  return new Date(millis).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value: string): string {
  return value.length > 10
    ? `${value.slice(0, 6)}...${value.slice(-4)}`
    : value;
}

function newIdempotencyKey(): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showStatusTone(status: ShowTicketingStatus): string {
  if (status === "on_sale" || status === "published")
    return "bg-emerald-100 text-emerald-800";
  if (status === "sold_out") return "bg-amber-100 text-amber-800";
  if (status === "cancelled" || status === "postponed")
    return "bg-red-100 text-red-800";
  return "bg-cinema-200 text-cinema-700";
}

function orderStatusTone(status: TicketOrderStatus): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "disputed") return "bg-red-100 text-red-800";
  if (status === "refunded" || status === "partially_refunded")
    return "bg-sky-100 text-sky-800";
  return "bg-cinema-200 text-cinema-700";
}

function refundStatusTone(status: TicketRefundStatus): string {
  if (status === "succeeded") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "failed" || status === "cancelled")
    return "bg-red-100 text-red-800";
  return "bg-cinema-200 text-cinema-700";
}

function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-cinema-600 font-medium">{label}</p>
          <p className="text-2xl font-bold text-cinema-900 mt-1">{value}</p>
        </div>
        <span className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
}

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
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <h1 className="font-bold">Ticketing admin could not load</h1>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </div>
      </div>
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
              Live payments are not switched on from this screen.
            </p>
            <p className="text-sm">
              The backend is sandbox-proven. Before real money, finish live
              Stripe webhook/secrets, refund/dispute handling, confirmation
              email, and a tiny live pilot transaction.
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

function ReadinessCard({
  ok,
  title,
  description,
}: {
  ok: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        )}
        <div>
          <p className="text-sm font-bold text-cinema-900">{title}</p>
          <p className="text-xs text-cinema-600 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  Icon,
  title,
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <header className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-xl font-bold text-cinema-900">{title}</h2>
    </header>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4 text-sm text-cinema-700">
      {children}
    </div>
  );
}

function TicketingCoAdminsPanel() {
  const [email, setEmail] = useState("");
  const [busyAction, setBusyAction] = useState<"grant" | "revoke" | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error";
    message: string;
  } | null>(null);

  const targetEmail = email.trim().toLowerCase();
  const canSubmit = targetEmail.includes("@") && busyAction === null;

  const updateCoAdmin = async (grant: boolean) => {
    if (!canSubmit) return;
    if (
      !grant &&
      !window.confirm(`Revoke ticketing co-admin access for ${targetEmail}?`)
    ) {
      return;
    }

    const action = grant ? "grant" : "revoke";
    setBusyAction(action);
    setFeedback(null);
    try {
      const result = await setAdminClaim({
        email: targetEmail,
        role: "event_admin",
        grant,
      });
      setFeedback({
        tone: "ok",
        message: grant
          ? `Granted ticketing co-admin access to ${targetEmail}. ${result.note}`
          : `Revoked ticketing co-admin access for ${targetEmail}. ${result.note}`,
      });
      setEmail("");
    } catch (err) {
      setFeedback({
        tone: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not update ticketing co-admin access.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await updateCoAdmin(true);
  };

  return (
    <section className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-cinema-900">
              Ticketing co-admins
            </h2>
          </div>
          <p className="text-sm text-cinema-600">
            Grant or revoke the event_admin ticketing claim for band members.
            They must have signed in to Hollywood Groove at least once with this
            email so an Auth account exists.
          </p>
        </div>
      </div>

      <form onSubmit={handleGrant} className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
            Band member email
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-cinema"
            disabled={busyAction !== null}
            autoComplete="email"
            inputMode="email"
            placeholder="bandmate@example.com"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-cinema hover:bg-primary/90 disabled:opacity-60 lg:w-auto"
          >
            {busyAction === "grant" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Grant co-admin
          </button>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => updateCoAdmin(false)}
            disabled={!canSubmit}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 lg:w-auto"
          >
            {busyAction === "revoke" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserMinus className="w-4 h-4" />
            )}
            Revoke co-admin
          </button>
        </div>
      </form>

      {feedback && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            feedback.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </section>
  );
}

function IssueCompTicketPanel({
  shows,
}: {
  shows: Array<TicketedShow & { id: string }>;
}) {
  const issuableShows = useMemo(
    () =>
      shows.filter(
        (show) =>
          show.ticketingEnabled &&
          ["published", "on_sale", "sold_out"].includes(show.status),
      ),
    [shows],
  );
  const [showId, setShowId] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    ticketTypes,
    loading: ticketTypesLoading,
    error: ticketTypesError,
  } = useTicketTypes(showId || undefined);

  useEffect(() => {
    if (!showId && issuableShows.length > 0) {
      setShowId(issuableShows[0].id);
    }
  }, [issuableShows, showId]);

  useEffect(() => {
    if (ticketTypes.length === 0) {
      setTicketTypeId("");
      return;
    }
    if (!ticketTypes.some((ticketType) => ticketType.id === ticketTypeId)) {
      setTicketTypeId(ticketTypes[0].id);
    }
  }, [ticketTypeId, ticketTypes]);

  const selectedTicketType = ticketTypes.find(
    (ticketType) => ticketType.id === ticketTypeId,
  );
  const available = selectedTicketType
    ? ticketAvailableCount(selectedTicketType)
    : 0;
  const parsedQuantity = Number(quantity);
  const validQuantity =
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1 &&
    parsedQuantity <= Math.min(20, Math.max(1, available));
  const canSubmit =
    Boolean(showId) &&
    Boolean(ticketTypeId) &&
    recipientName.trim().length > 0 &&
    recipientEmail.trim().includes("@") &&
    validQuantity &&
    !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await issueCompTicket({
        showId,
        ticketTypeId,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim(),
        quantity: parsedQuantity,
        note: note.trim() || null,
        idempotencyKey,
      });
      setMessage(
        result.idempotent
          ? `Already issued: ${shortId(result.orderId)}`
          : `Issued ${result.ticketIds.length} comp ticket${result.ticketIds.length === 1 ? "" : "s"} to ${result.recipientEmail}`,
      );
      setRecipientName("");
      setRecipientEmail("");
      setQuantity("1");
      setNote("");
      setIdempotencyKey(newIdempotencyKey());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Comp ticket could not be issued.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <details open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xl font-bold text-cinema-900">
            <Gift className="w-5 h-5 text-primary" />
            Issue comp ticket
          </span>
          <span className="text-xs font-semibold text-cinema-500">
            {issuableShows.length} show{issuableShows.length === 1 ? "" : "s"}
          </span>
        </summary>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 lg:grid-cols-6">
          <label className="space-y-1 lg:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Show
            </span>
            <select
              value={showId}
              onChange={(event) => {
                setShowId(event.target.value);
                setTicketTypeId("");
              }}
              className="input-cinema"
              disabled={submitting || issuableShows.length === 0}
            >
              {issuableShows.length === 0 ? (
                <option value="">No issuable shows</option>
              ) : (
                issuableShows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.title} · {dateLabel(show.startDate)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Ticket type
            </span>
            <select
              value={ticketTypeId}
              onChange={(event) => setTicketTypeId(event.target.value)}
              className="input-cinema"
              disabled={submitting || ticketTypesLoading || ticketTypes.length === 0}
            >
              {ticketTypesLoading ? (
                <option value="">Loading ticket types</option>
              ) : ticketTypes.length === 0 ? (
                <option value="">No active ticket types</option>
              ) : (
                ticketTypes.map((ticketType) => (
                  <option key={ticketType.id} value={ticketType.id}>
                    {ticketType.name} · {ticketAvailableCount(ticketType)} left
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Qty
            </span>
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="input-cinema"
              inputMode="numeric"
              disabled={submitting}
            />
          </label>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Available
            </span>
            <div className="min-h-11 rounded-lg border border-cinema-200 bg-white px-3 py-2 text-sm font-bold text-cinema-900">
              {selectedTicketType ? available : "-"}
            </div>
          </div>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Recipient name
            </span>
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              className="input-cinema"
              disabled={submitting}
              autoComplete="name"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Recipient email
            </span>
            <input
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              className="input-cinema"
              disabled={submitting}
              autoComplete="email"
              inputMode="email"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Note
            </span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="input-cinema"
              disabled={submitting}
            />
          </label>

          <div className="flex flex-col gap-2 lg:col-span-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-xs">
              {ticketTypesError && (
                <span className="text-red-700">{ticketTypesError.message}</span>
              )}
              {error && <span className="text-red-700">{error}</span>}
              {message && <span className="text-emerald-700">{message}</span>}
              {!error && !message && selectedTicketType && available === 0 && (
                <span className="text-amber-700">
                  This ticket type has no available inventory.
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-cinema hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Issue comp
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}

function ShowRow({
  show,
  tickets,
  canManageStaff,
}: {
  show: TicketedShow & { id: string };
  tickets: Array<IssuedTicket & { id: string }>;
  canManageStaff: boolean;
}) {
  const showTickets = tickets.filter((ticket) => ticket.showId === show.id);
  const sold = showTickets.filter(
    (ticket) => ticket.status === "valid" || ticket.status === "used",
  ).length;
  const used = showTickets.filter((ticket) => ticket.status === "used").length;
  const front =
    show.sellingFrontId === "adele_show"
      ? "The Adele Show"
      : "Hollywood Groove";

  return (
    <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-cinema-900 truncate">
              {show.title}
            </h3>
            <Badge className={showStatusTone(show.status)}>
              {show.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-xs text-cinema-600">
            {dateLabel(show.startDate)} · {front}
          </p>
          <p className="text-xs text-cinema-500">
            {sold} sold, {used} scanned, capacity {show.capacity || "not set"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <Link
            to={`/event/${show.publicSlug || show.id}`}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-cinema-300 px-3 py-1.5 text-xs font-semibold text-cinema-800 hover:border-primary/60"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Event page
          </Link>
          {canManageStaff && show.venueId && (
            <Link
              to={`/admin/venues/${show.venueId}/staff`}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary text-cinema px-3 py-1.5 text-xs font-bold hover:bg-primary/90"
            >
              <Users className="w-3.5 h-3.5" /> Staff
            </Link>
          )}
        </div>
      </div>
      <ShowPromoPanel show={show} />
    </div>
  );
}

function promoExpiryLabel(promo: TicketPromoCode): string {
  const millis = toMillis(promo.validUntil);
  return millis ? `Valid until ${dateLabel(promo.validUntil)}` : "No end date";
}

function ShowPromoPanel({ show }: { show: TicketedShow & { id: string } }) {
  const { promoCodes, loading } = usePromoCodes(show.id);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState("10");
  const [validUntil, setValidUntil] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericDiscount = Number(discountValue);
    const maxUses = Number(maxRedemptions);
    setSaving(true);
    setMessage(null);
    try {
      const savedCode = await savePromoCode(show.id, {
        code,
        active,
        discountType,
        percentOff: discountType === "percent" ? numericDiscount : null,
        amountOffCents:
          discountType === "amount" ? Math.round(numericDiscount * 100) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        maxRedemptions:
          Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
      });
      setCode("");
      setMessage(`${savedCode} saved`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Promo code could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mt-3 border-t border-cinema-200 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-cinema-900">
        <span className="inline-flex items-center gap-2">
          <BadgePercent className="w-4 h-4 text-primary" />
          Promos
        </span>
        <span className="text-xs font-medium text-cinema-500">
          {loading
            ? "Loading..."
            : `${promoCodes.length} code${promoCodes.length === 1 ? "" : "s"}`}
        </span>
      </summary>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.25fr]">
        <div className="space-y-2 rounded-lg border border-cinema-200 bg-white p-3">
          {promoCodes.length === 0 ? (
            <p className="text-xs text-cinema-500">No promo codes yet.</p>
          ) : (
            promoCodes.slice(0, 5).map((promo) => {
              const amount =
                promo.discountType === "percent"
                  ? `${promo.percentOff ?? 0}%`
                  : formatAud(Number(promo.amountOffCents ?? 0));
              const committed =
                Number(promo.redemptionCount ?? 0) +
                Number(promo.reservationCount ?? 0);
              return (
                <div
                  key={promo.id}
                  className="border-b border-cinema-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-cinema-900">
                      {promo.code}
                    </span>
                    <Badge
                      className={
                        promo.active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-cinema-200 text-cinema-700"
                      }
                    >
                      {promo.active ? "active" : "off"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-cinema-500">
                    {amount} off · {committed}/
                    {promo.maxRedemptions || "no limit"} used or reserved ·{" "}
                    {promoExpiryLabel(promo)}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={handleSave}
          className="grid gap-2 rounded-lg border border-cinema-200 bg-white p-3 sm:grid-cols-2"
        >
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Code
            </span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="input-cinema uppercase"
              placeholder="EARLYBIRD"
              disabled={saving}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Discount
            </span>
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(event) =>
                  setDiscountType(event.target.value as "percent" | "amount")
                }
                className="input-cinema w-28"
                disabled={saving}
              >
                <option value="percent">Percent</option>
                <option value="amount">Amount</option>
              </select>
              <input
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                className="input-cinema min-w-0 flex-1"
                inputMode="decimal"
                disabled={saving}
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Valid until
            </span>
            <input
              type="datetime-local"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              className="input-cinema"
              disabled={saving}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Max uses
            </span>
            <input
              value={maxRedemptions}
              onChange={(event) => setMaxRedemptions(event.target.value)}
              className="input-cinema"
              inputMode="numeric"
              disabled={saving}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-cinema-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-cinema-300 text-primary focus:ring-primary"
            />
            Active
          </label>
          <div className="flex items-center justify-end gap-2">
            {message && (
              <span className="text-xs text-cinema-600">{message}</span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-cinema hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}

function OrderRow({
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

function RefundRow({
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
