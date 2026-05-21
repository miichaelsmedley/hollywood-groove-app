// Lands here if the buyer abandons Stripe Checkout.
//
// The reservation we created during createCheckoutSession still holds inventory
// for ~31 minutes; the scheduled expireReservations job releases it. We don't
// proactively cancel here because the buyer may have just lost focus and could
// click the same Stripe link again.

import { Link, useSearchParams } from "react-router-dom";
import { XCircle, ArrowLeft } from "lucide-react";

export default function TicketsCancelled() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="bg-cinema-50 rounded-2xl p-6 border border-cinema-200 space-y-4">
        <div className="flex items-start gap-3">
          <XCircle className="w-7 h-7 text-cinema-400 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-cinema-900 mb-1">Checkout cancelled</h1>
            <p className="text-sm text-cinema-600">
              No charge was made. Your seat reservation will release automatically in about
              30 minutes if you don't finish checkout — feel free to come back any time.
            </p>
            {orderId && (
              <p className="text-[11px] text-cinema-500 mt-2">
                Order reference: <code className="font-mono">{orderId}</code>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/shows" className="btn-primary flex-1 py-3 text-center inline-flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Browse shows
          </Link>
          <Link to="/" className="flex-1 py-3 text-center rounded-lg border border-cinema-200 text-cinema-800 hover:bg-cinema-50">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
