// Ticket purchase panel embedded on the show detail page.
//
// Reads ticket types live from Firestore (named "ticketing" DB), captures the
// buyer + each holder's marketing consent, then hands off to Stripe-hosted
// Checkout via the createCheckoutSession callable. Stripe handles card capture;
// our deployed webhook mints tickets when the payment succeeds.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Ticket, AlertCircle } from "lucide-react";
import { auth } from "../../lib/firebase";
import {
  createCheckoutSession,
  formatAud,
  ticketAvailableCount,
  ticketTypePricingPreview,
  useTicketTypes,
  useTicketedShow,
} from "../../lib/firebaseTicketing";
import HolderConsentRow, { EMPTY_HOLDER, HolderFormState } from "./HolderConsentRow";
import type { TicketType } from "../../types/ticketingContract";

type TicketTypeWithId = TicketType & { id: string };

interface TicketPurchasePanelProps {
  showId: string;
}

export default function TicketPurchasePanel({ showId }: TicketPurchasePanelProps) {
  const { show, loading: showLoading } = useTicketedShow(showId);
  const { ticketTypes, loading: typesLoading, error: typesError } = useTicketTypes(showId);

  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [holders, setHolders] = useState<HolderFormState[]>([{ ...EMPTY_HOLDER }]);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-select first ticket type once loaded
  useEffect(() => {
    if (!selectedTicketTypeId && ticketTypes.length > 0) {
      setSelectedTicketTypeId(ticketTypes[0].id);
    }
  }, [ticketTypes, selectedTicketTypeId]);

  const selectedTicketType = useMemo<TicketTypeWithId | null>(() => {
    if (!selectedTicketTypeId) return null;
    return ticketTypes.find((t) => t.id === selectedTicketTypeId) ?? null;
  }, [ticketTypes, selectedTicketTypeId]);

  const maxQuantity = selectedTicketType
    ? Math.min(selectedTicketType.maxPerOrder, ticketAvailableCount(selectedTicketType))
    : 1;

  // Keep holders array length in sync with quantity
  useEffect(() => {
    setHolders((current) => {
      if (current.length === quantity) return current;
      if (current.length < quantity) {
        const additions = Array.from({ length: quantity - current.length }, () => ({ ...EMPTY_HOLDER }));
        return [...current, ...additions];
      }
      return current.slice(0, quantity);
    });
  }, [quantity]);

  // Pre-fill buyer email from Firebase Auth once on mount if available
  useEffect(() => {
    const buyerEmail = auth.currentUser?.email;
    const buyerName = auth.currentUser?.displayName;
    if (buyerEmail || buyerName) {
      setHolders((current) => {
        if (current.length === 0) return current;
        const [first, ...rest] = current;
        if (first.holderEmail || first.holderName) return current;
        return [
          {
            ...first,
            holderEmail: first.holderEmail || buyerEmail || "",
            holderName: first.holderName || buyerName || "",
          },
          ...rest,
        ];
      });
    }
    // Intentionally run once at mount; we don't want to overwrite user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showLoading || typesLoading) {
    return (
      <div className="card-cinema p-6 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-cinema-700 text-sm">Loading tickets…</span>
      </div>
    );
  }

  if (typesError) {
    return (
      <div className="card-cinema p-6 border-red-200 bg-red-50">
        <div className="flex items-start gap-2 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            Couldn't load tickets right now. Please refresh and try again.
          </div>
        </div>
      </div>
    );
  }

  // No ticketed show → render nothing (the existing ShowDetail UI still shows).
  if (!show || !show.ticketingEnabled) {
    return null;
  }

  if (ticketTypes.length === 0) {
    return (
      <div className="card-cinema p-6">
        <div className="flex items-start gap-2 text-cinema-700">
          <Ticket className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">Tickets aren't on sale yet for this show.</div>
        </div>
      </div>
    );
  }

  if (!selectedTicketType) {
    return null;
  }

  const pricing = ticketTypePricingPreview(selectedTicketType, quantity);
  const buyerHolder = holders[0];
  const everyHolderHasEmail = holders.every((h) => h.holderEmail.trim().length > 0);
  const everyHolderHasName = holders.every((h) => h.holderName.trim().length > 0);
  const submittable =
    everyHolderHasEmail && everyHolderHasName && !submitting && quantity > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submittable || !buyerHolder) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Omitting successUrl/cancelUrl lets the deployed function build them
      // with the real orderId embedded — it can't template our placeholders.
      // Default form: `${HG_CHECKOUT_BASE_URL}/tickets/success?session_id={CHECKOUT_SESSION_ID}&orderId=<id>`
      const result = await createCheckoutSession({
        showId,
        ticketTypeId: selectedTicketType.id,
        quantity,
        buyerSnapshot: {
          email: buyerHolder.holderEmail,
          displayName: buyerHolder.holderName,
          email_opt_in: emailOptIn,
          sms_opt_in: smsOptIn,
          socials: {},
        },
        holders: holders.map((h) => ({
          holderName: h.holderName.trim(),
          holderEmail: h.holderEmail.trim(),
          holderPhone: h.holderPhone.trim() || null,
          holderEmailOptIn: h.holderEmailOptIn,
          holderSmsOptIn: h.holderSmsOptIn,
        })),
      });
      // Hand off to Stripe-hosted Checkout. Stripe will substitute the
      // session_id template token; the function templates orderId on our side
      // before passing the URL to Stripe.
      window.location.assign(result.url);
    } catch (err) {
      console.error("createCheckoutSession failed", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "We couldn't start checkout. Please try again in a moment.";
      setSubmitError(message);
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Buy tickets">
      <header className="space-y-1">
        <h2 className="text-xl font-bold text-cinema-900 flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          Buy tickets
        </h2>
        <p className="text-sm text-cinema-600">
          Secure checkout by Stripe. Tickets are emailed to each holder when payment lands.
        </p>
      </header>

      {ticketTypes.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ticketTypes.map((tt) => {
            const available = ticketAvailableCount(tt);
            const isSelected = tt.id === selectedTicketType.id;
            const soldOut = available === 0;
            return (
              <button
                key={tt.id}
                type="button"
                onClick={() => {
                  setSelectedTicketTypeId(tt.id);
                  setQuantity(1);
                }}
                disabled={soldOut}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-cinema-200 bg-white hover:border-cinema-300"
                } ${soldOut ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-cinema-900">{tt.name}</span>
                  <span className="text-sm text-cinema-700">
                    {formatAud(tt.priceCents + tt.bookingFeeCents)}
                  </span>
                </div>
                {tt.description && (
                  <p className="text-xs text-cinema-600 mt-1">{tt.description}</p>
                )}
                <p className="text-[11px] text-cinema-500 mt-1">
                  {soldOut ? "Sold out" : `${available} available`}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card-cinema p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-cinema-900">{selectedTicketType.name}</p>
              <p className="text-xs text-cinema-600">
                {formatAud(selectedTicketType.priceCents)} ticket +{" "}
                {formatAud(selectedTicketType.bookingFeeCents)} booking fee
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="quantity" className="text-xs text-cinema-700 font-medium">
                Qty
              </label>
              <select
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                disabled={submitting || maxQuantity < 1}
                className="input-cinema py-1 pr-7"
              >
                {Array.from({ length: Math.max(1, maxQuantity) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-cinema-100 flex items-baseline justify-between">
            <span className="text-sm text-cinema-700">Total</span>
            <span className="text-lg font-bold text-cinema-900">
              {formatAud(pricing.totalCents)}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {holders.map((holder, index) => (
            <HolderConsentRow
              key={index}
              index={index}
              isBuyer={index === 0}
              value={holder}
              onChange={(next) =>
                setHolders((current) =>
                  current.map((h, i) => (i === index ? next : h))
                )
              }
              disabled={submitting}
            />
          ))}
        </div>

        {/* Buyer-only opt-ins separate from per-ticket holder opt-ins. */}
        <div className="card-cinema p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-cinema-700 font-semibold">
            Buyer preferences (you)
          </p>
          <BuyerOptInRow
            label="Email me about future shows and offers"
            checked={emailOptIn}
            onChange={setEmailOptIn}
            disabled={submitting || !buyerHolder.holderEmail.trim()}
          />
          <BuyerOptInRow
            label="Text me reminders before each show I've booked"
            checked={smsOptIn}
            onChange={setSmsOptIn}
            disabled={submitting || !buyerHolder.holderPhone.trim()}
          />
        </div>

        {submitError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={!submittable}
          className="btn-primary w-full py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to secure checkout…
            </span>
          ) : (
            `Pay ${formatAud(pricing.totalCents)} with card`
          )}
        </button>

        <p className="text-[11px] text-center text-cinema-600 leading-snug">
          You'll be taken to Stripe to enter card details. We never see your card.
          The Adele Show is the merchant of record for tickets, including those branded
          "Hollywood Groove".
        </p>
      </form>
    </section>
  );
}

interface BuyerOptInRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}

function BuyerOptInRow({ label, checked, onChange, disabled }: BuyerOptInRowProps) {
  return (
    <label
      className={`flex items-start gap-2 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-cinema-300 text-primary focus:ring-primary"
      />
      <span className="text-xs text-cinema-800">{label}</span>
    </label>
  );
}
