// Lands here after Stripe-hosted Checkout completes successfully.
//
// Stripe sends checkout.session.completed to our deployed stripeWebhook before
// (or at most a few seconds after) the redirect, so by the time this page reads
// the order it should be in `paid` status with tickets minted. We subscribe via
// Firestore real-time, so any small lag resolves on its own.

import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, Ticket } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { firestoreTicketing, formatAud } from "../lib/firebaseTicketing";
import type { TicketOrder } from "../types/ticketingContract";

export default function TicketsSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = useMemo(() => searchParams.get("orderId"), [searchParams]);
  const [order, setOrder] = useState<(TicketOrder & { id: string }) | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setHydrated(true);
      return;
    }
    const unsub = onSnapshot(
      doc(firestoreTicketing, "orders", orderId),
      (snap) => {
        if (!snap.exists()) {
          setOrder(null);
          setHydrated(true);
          return;
        }
        setOrder({ id: snap.id, ...(snap.data() as TicketOrder) });
        setHydrated(true);
      },
      (err) => {
        setError(err);
        setHydrated(true);
      }
    );
    return () => unsub();
  }, [orderId]);

  if (!orderId) {
    return (
      <CenteredCard>
        <div className="flex items-start gap-3 text-cinema-800">
          <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold mb-1">Order reference missing</h1>
            <p className="text-sm text-cinema-600">
              We couldn't find your order details in the redirect link. If you completed
              payment, check your email for confirmation — your tickets are still on the way.
            </p>
          </div>
        </div>
        <BackLinks />
      </CenteredCard>
    );
  }

  if (!hydrated) {
    return (
      <CenteredCard>
        <div className="flex items-center gap-3 text-cinema-700">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Confirming your payment…</span>
        </div>
      </CenteredCard>
    );
  }

  if (error) {
    return (
      <CenteredCard>
        <div className="flex items-start gap-3 text-cinema-800">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold mb-1">We couldn't load this order</h1>
            <p className="text-sm text-cinema-600">{error.message}</p>
            <p className="text-sm text-cinema-600 mt-2">
              Check your email for the confirmation receipt while we sort this out.
            </p>
          </div>
        </div>
        <BackLinks />
      </CenteredCard>
    );
  }

  // Webhook usually fires inside a second, but if the user gets here first
  // we keep listening — onSnapshot will refresh as soon as Firestore updates.
  if (!order) {
    return (
      <CenteredCard>
        <div className="flex items-start gap-3 text-cinema-800">
          <Loader2 className="w-6 h-6 animate-spin text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold mb-1">Almost there…</h1>
            <p className="text-sm text-cinema-600">
              Stripe is finalising your payment. This page refreshes automatically — give
              it a few seconds.
            </p>
          </div>
        </div>
      </CenteredCard>
    );
  }

  if (order.status !== "paid") {
    return (
      <CenteredCard>
        <div className="flex items-start gap-3 text-cinema-800">
          <Loader2 className="w-6 h-6 animate-spin text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold mb-1">Waiting on Stripe…</h1>
            <p className="text-sm text-cinema-600">
              Your card was accepted, but our records haven't confirmed yet. This usually
              resolves in a few seconds. The page will refresh automatically.
            </p>
            <p className="text-xs text-cinema-500 mt-3">
              Order reference: <code className="font-mono">{order.id}</code>
            </p>
          </div>
        </div>
      </CenteredCard>
    );
  }

  const ticketCount = order.lineItems.reduce((sum, li) => sum + li.quantity, 0);

  return (
    <CenteredCard>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-cinema-900 mb-1">Payment received</h1>
          <p className="text-sm text-cinema-600">
            Thanks {order.buyerSnapshot.displayName || order.buyerSnapshot.email}. We've
            sent ticket{ticketCount === 1 ? "" : "s"} and a receipt to{" "}
            <span className="font-semibold">{order.buyerSnapshot.email}</span>.
          </p>
        </div>
      </div>

      <div className="card-cinema p-4 mt-5 space-y-2">
        <p className="text-xs uppercase tracking-wide text-cinema-500 font-semibold">
          Order summary
        </p>
        {order.lineItems.map((li, idx) => (
          <div key={idx} className="flex items-baseline justify-between text-sm">
            <span className="text-cinema-800">
              {li.quantity} × {li.name}
            </span>
            <span className="text-cinema-900 font-semibold">
              {formatAud(li.totalCents)}
            </span>
          </div>
        ))}
        <div className="border-t border-cinema-100 pt-2 flex items-baseline justify-between">
          <span className="text-sm text-cinema-800">Total paid</span>
          <span className="text-base font-bold text-cinema-900">
            {formatAud(order.totalCents)}
          </span>
        </div>
        <p className="text-[11px] text-cinema-500 pt-1">
          Order <code className="font-mono">{order.id}</code>
        </p>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-2">
        <Link to="/tickets" className="btn-primary flex-1 py-3 text-center inline-flex items-center justify-center gap-2">
          <Ticket className="w-4 h-4" /> View my tickets
        </Link>
        <Link to={`/shows/${order.showId}`} className="flex-1 py-3 text-center rounded-lg border border-cinema-200 text-cinema-800 hover:bg-cinema-50">
          Back to show
        </Link>
      </div>
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="bg-cinema-50 rounded-2xl p-6 border border-cinema-200 space-y-4">
        {children}
      </div>
    </div>
  );
}

function BackLinks() {
  return (
    <div className="mt-5 flex flex-col sm:flex-row gap-2">
      <Link to="/shows" className="btn-primary flex-1 py-3 text-center">
        Browse shows
      </Link>
      <Link to="/" className="flex-1 py-3 text-center rounded-lg border border-cinema-200 text-cinema-800 hover:bg-cinema-50">
        Home
      </Link>
    </div>
  );
}
