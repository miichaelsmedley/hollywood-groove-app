// Standalone desktop-first event ticketing page at /event/:showId.
//
// This is the public top-of-funnel: a buyer clicks a Facebook/Instagram/Google
// ad, lands on the marketing site (adeleshow.com.au), taps "Buy tickets" and
// arrives here. It deliberately renders OUTSIDE the mobile PWA chrome — no
// bottom tab bar, no Shows/Tickets/Join nav — so it reads as a real ticketing
// page, not an in-venue game app.
//
// Flow: browse (pick ticket type + quantity) → holder details + consent →
// Stripe Checkout. Sign-in is NOT required to buy (guest checkout); the buyer
// enters their email at the details step and signs in AFTER paying to claim
// their ticket. Selection is persisted to sessionStorage so any optional
// sign-in round-trip doesn't lose it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Calendar,
  MapPin,
  Ticket,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Lock,
  CheckCircle2,
  BadgePercent,
  X,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { signInWithGoogle } from "../lib/auth";
import {
  createCheckoutSession,
  firestoreTicketing,
  formatAud,
  getPromoCodePreview,
  normalizePromoCodeInput,
  type PromoCodePreview,
  ticketAvailableCount,
  ticketTypePricingPreview,
  useEventShowId,
  useTicketTypes,
  useTicketedShow,
} from "../lib/firebaseTicketing";
import type {
  SellingFrontId,
  TicketType,
  TicketVenue,
} from "../types/ticketingContract";
import HolderConsentRow, {
  EMPTY_HOLDER,
  HolderFormState,
} from "../features/tickets/HolderConsentRow";
import EmailLinkSignIn from "../features/auth/EmailLinkSignIn";
import { toTicketingDate as toDate } from "../lib/ticketingTime";
import {
  getTicketCancelUrl,
  getTicketSuccessUrl,
  getTicketWalletPath,
  resolveSellingFrontId,
  useSellingFrontBrand,
} from "../lib/sellingFronts";

type TicketTypeWithId = TicketType & { id: string };
type Step = "browse" | "signin" | "details";
type PricingPreview = {
  subtotalCents: number;
  bookingFeeTotalCents: number;
  discountCents: number;
  totalCents: number;
};

// Date coercion is imported above as `toDate` from lib/ticketingTime.

export default function EventTicketing() {
  const { showId: routeEventId } = useParams<{ showId: string }>();
  const location = useLocation();
  const {
    showId,
    loading: resolvingShow,
    error: resolveError,
  } = useEventShowId(routeEventId);
  const { show, loading: showLoading } = useTicketedShow(showId ?? undefined);
  const {
    ticketTypes,
    loading: typesLoading,
    error: typesError,
  } = useTicketTypes(showId ?? undefined);

  const [venue, setVenue] = useState<TicketVenue | null>(null);
  const [signedIn, setSignedIn] = useState<boolean>(() => {
    const u = auth.currentUser;
    return Boolean(u && !u.isAnonymous && u.email);
  });

  const sessionKey = `hg_event_selection_${routeEventId ?? ""}`;
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<
    string | null
  >(null);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<Step>("browse");
  const [holders, setHolders] = useState<HolderFormState[]>([
    { ...EMPTY_HOLDER },
  ]);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoPreview, setPromoPreview] = useState<PromoCodePreview | null>(
    null,
  );
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const routeFrontId = resolveSellingFrontId();
  const activeFrontId = show?.sellingFrontId ?? routeFrontId;
  const brand = useSellingFrontBrand(activeFrontId);
  const frontName = brand.displayName;
  const returnPath = `${location.pathname}${location.search}`;

  // Track auth so the page reacts when a Google popup sign-in completes.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setSignedIn(Boolean(u && !u.isAnonymous && u.email));
    });
    return () => unsub();
  }, []);

  // Best-effort venue fetch. Rules only expose venues flagged public; if the
  // read is denied we simply omit the venue line rather than erroring.
  useEffect(() => {
    if (!show?.venueId) return;
    const unsub = onSnapshot(
      doc(firestoreTicketing, "venues", show.venueId),
      (snap) => setVenue(snap.exists() ? (snap.data() as TicketVenue) : null),
      () => setVenue(null),
    );
    return () => unsub();
  }, [show?.venueId]);

  // Restore a saved selection (survives the email-link / OAuth round-trip).
  useEffect(() => {
    if (typeof window === "undefined" || !routeEventId) return;
    try {
      const raw = window.sessionStorage.getItem(sessionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          ticketTypeId?: string;
          quantity?: number;
          promoCode?: string;
        };
        if (parsed.ticketTypeId) setSelectedTicketTypeId(parsed.ticketTypeId);
        if (parsed.quantity && parsed.quantity > 0)
          setQuantity(parsed.quantity);
        if (parsed.promoCode) setPromoInput(parsed.promoCode);
      }
    } catch {
      // Corrupt/blocked storage — ignore and start fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeEventId]);

  // Auto-select the first ticket type once loaded if nothing restored.
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
    ? Math.max(
        1,
        Math.min(
          selectedTicketType.maxPerOrder,
          ticketAvailableCount(selectedTicketType),
        ),
      )
    : 1;

  // Persist selection whenever it changes.
  const persistSelection = useCallback(
    (ticketTypeId: string | null, qty: number, promoCode?: string | null) => {
      if (typeof window === "undefined" || !routeEventId) return;
      try {
        window.sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            ticketTypeId,
            quantity: qty,
            promoCode: promoCode || undefined,
          }),
        );
      } catch {
        // ignore
      }
    },
    [sessionKey, routeEventId],
  );

  // Keep holders array length synced to quantity.
  useEffect(() => {
    setHolders((current) => {
      if (current.length === quantity) return current;
      if (current.length < quantity) {
        return [
          ...current,
          ...Array.from({ length: quantity - current.length }, () => ({
            ...EMPTY_HOLDER,
          })),
        ];
      }
      return current.slice(0, quantity);
    });
  }, [quantity]);

  // Once the buyer signs in (Google popup or returning from email link),
  // advance from the sign-in step into holder details automatically.
  useEffect(() => {
    if (step === "signin" && signedIn) {
      setStep("details");
    }
  }, [step, signedIn]);

  // Pre-fill the buyer (holder 0) from the signed-in account, once.
  useEffect(() => {
    const u = auth.currentUser;
    if (!signedIn || !u) return;
    setHolders((current) => {
      if (current.length === 0) return current;
      const [first, ...rest] = current;
      if (first.holderEmail || first.holderName) return current;
      return [
        {
          ...first,
          holderEmail: first.holderEmail || u.email || "",
          holderName: first.holderName || u.displayName || "",
        },
        ...rest,
      ];
    });
  }, [signedIn]);

  const startDate = useMemo(() => toDate(show?.startDate), [show?.startDate]);

  // ----- loading / not-found gates -------------------------------------------
  if (resolvingShow || showLoading || typesLoading) {
    return (
      <EventShell frontName={frontName} frontId={brand.id} signedIn={signedIn}>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </EventShell>
    );
  }

  if (!show || !show.ticketingEnabled || typesError || resolveError) {
    return (
      <EventShell frontName={frontName} frontId={brand.id} signedIn={signedIn}>
        <div className="max-w-lg mx-auto py-16 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">
            Tickets aren't available
          </h1>
          <p className="text-cinema-500 text-sm">
            This event isn't on sale right now. It may have sold out, finished,
            or the link may be out of date.
          </p>
          <Link to="/shows" className="btn-primary inline-block mt-2">
            Browse other shows
          </Link>
        </div>
      </EventShell>
    );
  }

  const pricing = selectedTicketType
    ? ticketTypePricingPreview(selectedTicketType, quantity)
    : null;
  const displayPricing: PricingPreview | null = pricing
    ? {
        subtotalCents: pricing.subtotalCents,
        bookingFeeTotalCents: pricing.bookingFeeTotalCents,
        discountCents: promoPreview?.discountCents ?? 0,
        totalCents: promoPreview?.totalCents ?? pricing.totalCents,
      }
    : null;

  const clearPromoPreview = () => {
    setPromoPreview(null);
    setPromoMessage(null);
  };

  const applyPromo = async () => {
    if (!showId || !selectedTicketType || !pricing) return;
    const normalized = normalizePromoCodeInput(promoInput);
    if (!normalized) {
      setPromoPreview(null);
      setPromoMessage("Enter a valid promo code.");
      return;
    }

    setPromoApplying(true);
    setPromoMessage(null);
    try {
      const preview = await getPromoCodePreview({
        showId,
        ticketTypeId: selectedTicketType.id,
        quantity,
        subtotalCents: pricing.subtotalCents,
        bookingFeeCents: pricing.bookingFeeTotalCents,
        promoCode: normalized,
      });
      setPromoInput(preview.code);
      setPromoPreview(preview);
      setPromoMessage(`${preview.code} applied`);
      persistSelection(selectedTicketType.id, quantity, preview.code);
    } catch (err) {
      setPromoPreview(null);
      setPromoMessage(
        err instanceof Error
          ? err.message
          : "That promo code could not be applied.",
      );
    } finally {
      setPromoApplying(false);
    }
  };

  const handleGetTickets = () => {
    setSubmitError(null);
    // Guest checkout: go straight to details — no sign-in required to buy. The
    // buyer enters their email at the details step and signs in AFTER paying to
    // claim the ticket (post-purchase wallet prompt + claimMyPendingTickets).
    setStep("details");
  };

  const handleGoogle = async () => {
    setSigningInGoogle(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged flips `signedIn`; advance once that lands.
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handlePay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTicketType || !showId) return;
    const buyer = holders[0];
    const everyHolderValid = holders.every(
      (h) => h.holderName.trim() && h.holderEmail.trim(),
    );
    if (!everyHolderValid || !buyer) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await createCheckoutSession({
        showId,
        ticketTypeId: selectedTicketType.id,
        quantity,
        promoCode: promoPreview?.code,
        sellingFrontId: brand.id,
        successUrl: getTicketSuccessUrl(brand.id),
        cancelUrl: getTicketCancelUrl(brand.id),
        buyerSnapshot: {
          email: buyer.holderEmail.trim(),
          displayName: buyer.holderName.trim(),
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
      // Clear the saved selection — checkout has begun.
      try {
        window.sessionStorage.removeItem(sessionKey);
      } catch {
        // ignore
      }
      window.location.assign(result.url);
    } catch (err) {
      console.error("createCheckoutSession failed", err);
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't start checkout. Please try again in a moment.",
      );
      setSubmitting(false);
    }
  };

  return (
    <EventShell frontName={frontName} frontId={brand.id} signedIn={signedIn}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10">
          {/* ---- Left: show hero ------------------------------------------- */}
          <div className="lg:col-span-3 space-y-6">
            <div className="relative rounded-2xl overflow-hidden border border-cinema-200 bg-gradient-to-br from-cinema-100 via-cinema-50 to-black min-h-[260px] sm:min-h-[340px] flex flex-col justify-end p-6 sm:p-8">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "radial-gradient(ellipse at top right, rgba(245,158,11,0.35), transparent 60%)",
                }}
                aria-hidden="true"
              />
              <div className="relative space-y-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Ticket className="w-3.5 h-3.5" /> {frontName} · Live event
                </span>
                <h1 className="font-display text-3xl sm:text-5xl text-white leading-tight">
                  {show.title}
                </h1>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-cinema-700">
                  {startDate && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      {startDate.toLocaleString("en-AU", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {venue?.name && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-primary" />
                      {venue.name}
                      {venue.address ? ` · ${venue.address}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-cinema-600 text-sm leading-relaxed">
              <h2 className="text-white font-bold text-lg">About this event</h2>
              <p>
                Secure your spot for {show.title}. Tickets are issued instantly
                — each ticket holder gets their own QR code to scan at the door,
                plus access to live trivia, dancing and prizes through the
                Hollywood Groove app on the night.
              </p>
              <p className="text-cinema-500 text-xs">
                {frontName} is the seller for this event. Payments are processed
                securely by Stripe — your card details never touch our servers.
              </p>
            </div>
          </div>

          {/* ---- Right: purchase card (sticky on desktop) ------------------ */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 rounded-2xl border border-cinema-200 bg-cinema-50/80 backdrop-blur p-5 sm:p-6 space-y-5">
              {step === "browse" && (
                <BrowseStep
                  ticketTypes={ticketTypes}
                  selectedTicketType={selectedTicketType}
                  quantity={quantity}
                  maxQuantity={maxQuantity}
                  pricing={displayPricing}
                  promoInput={promoInput}
                  promoPreview={promoPreview}
                  promoMessage={promoMessage}
                  promoApplying={promoApplying}
                  onSelectType={(id) => {
                    setSelectedTicketTypeId(id);
                    setQuantity(1);
                    clearPromoPreview();
                    persistSelection(id, 1, promoInput);
                  }}
                  onQuantity={(q) => {
                    setQuantity(q);
                    clearPromoPreview();
                    persistSelection(selectedTicketTypeId, q, promoInput);
                  }}
                  onPromoInput={setPromoInput}
                  onApplyPromo={applyPromo}
                  onRemovePromo={() => {
                    setPromoInput("");
                    setPromoPreview(null);
                    setPromoMessage(null);
                    persistSelection(selectedTicketTypeId, quantity, null);
                  }}
                  onGetTickets={handleGetTickets}
                />
              )}

              {step === "signin" && !signedIn && (
                <SignInStep
                  showId={routeEventId ?? showId!}
                  returnPath={returnPath}
                  signingInGoogle={signingInGoogle}
                  onGoogle={handleGoogle}
                  onBack={() => setStep("browse")}
                />
              )}

              {step === "details" && selectedTicketType && displayPricing && (
                <DetailsStep
                  show={{ title: show.title }}
                  ticketType={selectedTicketType}
                  quantity={quantity}
                  pricing={displayPricing}
                  promoPreview={promoPreview}
                  holders={holders}
                  emailOptIn={emailOptIn}
                  smsOptIn={smsOptIn}
                  submitting={submitting}
                  submitError={submitError}
                  onHolderChange={(i, next) =>
                    setHolders((cur) =>
                      cur.map((h, idx) => (idx === i ? next : h)),
                    )
                  }
                  onEmailOptIn={setEmailOptIn}
                  onSmsOptIn={setSmsOptIn}
                  onBack={() => setStep("browse")}
                  onSubmit={handlePay}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </EventShell>
  );
}

// ---------------------------------------------------------------------------
// Standalone shell — minimal header + footer, no PWA nav.
// ---------------------------------------------------------------------------
function EventShell({
  frontName,
  frontId,
  signedIn,
  children,
}: {
  frontName: string;
  frontId: SellingFrontId;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  // Browser-back when we have in-app history (returns the buyer to the show
  // detail or marketing-site ad they came from); otherwise fall back to Shows.
  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/shows");
  };

  return (
    <div className="min-h-screen bg-cinema text-white flex flex-col">
      <header className="border-b border-cinema-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="inline-flex h-9 w-9 -ml-1.5 flex-shrink-0 items-center justify-center rounded-lg text-cinema-700 hover:text-white hover:bg-cinema-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Link
              to="/"
              className="font-display text-lg sm:text-xl text-primary hover:opacity-80 transition-opacity truncate"
            >
              {frontName}
            </Link>
          </div>
          <Link
            to={getTicketWalletPath(frontId)}
            className="flex-shrink-0 text-sm font-semibold text-cinema-700 hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <Ticket className="w-4 h-4" />
            {signedIn ? "My tickets" : "Sign in"}
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-cinema-200 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-xs text-cinema-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>
            © {new Date().getFullYear()} {frontName}. Tickets sold by The Adele
            Show.
          </span>
          <span className="inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Secure checkout by Stripe
          </span>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — browse + select
// ---------------------------------------------------------------------------
function BrowseStep({
  ticketTypes,
  selectedTicketType,
  quantity,
  maxQuantity,
  pricing,
  promoInput,
  promoPreview,
  promoMessage,
  promoApplying,
  onSelectType,
  onQuantity,
  onPromoInput,
  onApplyPromo,
  onRemovePromo,
  onGetTickets,
}: {
  ticketTypes: TicketTypeWithId[];
  selectedTicketType: TicketTypeWithId | null;
  quantity: number;
  maxQuantity: number;
  pricing: PricingPreview | null;
  promoInput: string;
  promoPreview: PromoCodePreview | null;
  promoMessage: string | null;
  promoApplying: boolean;
  onSelectType: (id: string) => void;
  onQuantity: (q: number) => void;
  onPromoInput: (value: string) => void;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  onGetTickets: () => void;
}) {
  if (ticketTypes.length === 0) {
    return (
      <div className="text-sm text-cinema-600">
        Tickets for this event aren't on sale yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Get tickets</h2>

      <div className="space-y-2">
        {ticketTypes.map((tt) => {
          const available = ticketAvailableCount(tt);
          const soldOut = available === 0;
          const selected = selectedTicketType?.id === tt.id;
          return (
            <button
              key={tt.id}
              type="button"
              onClick={() => !soldOut && onSelectType(tt.id)}
              disabled={soldOut}
              className={`w-full text-left p-3 rounded-xl border-2 transition-colors cursor-pointer ${
                selected
                  ? "border-primary bg-primary/10"
                  : "border-cinema-200 bg-cinema-100/60 hover:border-cinema-300"
              } ${soldOut ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-white">{tt.name}</span>
                <span className="text-sm font-bold text-primary">
                  {formatAud(tt.priceCents + tt.bookingFeeCents)}
                </span>
              </div>
              {tt.description && (
                <p className="text-xs text-cinema-500 mt-1">{tt.description}</p>
              )}
              <p className="text-[11px] text-cinema-500 mt-1">
                {soldOut ? "Sold out" : `${available} available`}
                {tt.bookingFeeCents > 0 &&
                  ` · incl. ${formatAud(tt.bookingFeeCents)} booking fee`}
              </p>
            </button>
          );
        })}
      </div>

      {selectedTicketType && (
        <>
          <div className="flex items-center justify-between">
            <label
              htmlFor="qty"
              className="text-sm text-cinema-600 font-medium"
            >
              Quantity
            </label>
            <select
              id="qty"
              value={quantity}
              onChange={(e) => onQuantity(Number(e.target.value))}
              className="input-cinema py-1.5 pr-8 bg-cinema-100 cursor-pointer"
            >
              {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              onApplyPromo();
            }}
          >
            <label
              htmlFor="promo-code"
              className="text-sm text-cinema-600 font-medium"
            >
              Promo code
            </label>
            <div className="flex gap-2">
              <input
                id="promo-code"
                value={promoInput}
                onChange={(event) => onPromoInput(event.target.value)}
                disabled={promoApplying}
                className="input-cinema min-w-0 flex-1 bg-cinema-100 uppercase"
                autoComplete="off"
                inputMode="text"
              />
              {promoPreview ? (
                <button
                  type="button"
                  onClick={onRemovePromo}
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-cinema-300 text-cinema-500 hover:border-primary/60 hover:text-white"
                  aria-label="Remove promo code"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={promoApplying || promoInput.trim().length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-primary/50 px-3 text-sm font-bold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {promoApplying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BadgePercent className="w-4 h-4" />
                  )}
                  Apply
                </button>
              )}
            </div>
            {promoMessage && (
              <p
                className={`text-xs ${promoPreview ? "text-emerald-400" : "text-amber-300"}`}
              >
                {promoMessage}
              </p>
            )}
          </form>

          <div className="space-y-1 border-t border-cinema-200 pt-3">
            {pricing && pricing.discountCents > 0 && (
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-cinema-600">Discount</span>
                <span className="font-semibold text-emerald-400">
                  -{formatAud(pricing.discountCents)}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-cinema-600">Total</span>
              <span className="text-2xl font-bold text-white">
                {pricing ? formatAud(pricing.totalCents) : "—"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onGetTickets}
            className="btn-primary w-full py-3 text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            Get tickets <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-cinema-500 text-center inline-flex items-center justify-center gap-1 w-full">
            <ShieldCheck className="w-3 h-3" /> Instant QR tickets · secure
            Stripe checkout
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — sign in (required so the buyer can manage tickets later)
// ---------------------------------------------------------------------------
function SignInStep({
  showId,
  returnPath,
  signingInGoogle,
  onGoogle,
  onBack,
}: {
  showId: string;
  returnPath: string;
  signingInGoogle: boolean;
  onGoogle: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Create your account</h2>
        <p className="text-sm text-cinema-500 mt-1">
          So you can manage, view and re-download your tickets any time. Takes a
          few seconds.
        </p>
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={signingInGoogle}
        className="w-full px-4 py-3 rounded-xl border-2 border-cinema-600 bg-white text-gray-700 font-semibold hover:border-primary/60 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
      >
        {signingInGoogle ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        {signingInGoogle ? "Signing in…" : "Continue with Google"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-cinema-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-cinema-50 text-cinema-500">
            or use any email
          </span>
        </div>
      </div>

      {/* returnPath sends the buyer back to this exact event page after the
          email-link round-trip, with their selection restored from storage. */}
      <EmailLinkSignIn returnPath={returnPath || `/event/${showId}`} />

      <button
        type="button"
        onClick={onBack}
        className="text-xs text-cinema-500 hover:text-white w-full text-center cursor-pointer"
      >
        ← Back to tickets
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — holder details + consent + pay
// ---------------------------------------------------------------------------
function DetailsStep({
  show,
  ticketType,
  quantity,
  pricing,
  promoPreview,
  holders,
  emailOptIn,
  smsOptIn,
  submitting,
  submitError,
  onHolderChange,
  onEmailOptIn,
  onSmsOptIn,
  onBack,
  onSubmit,
}: {
  show: { title: string };
  ticketType: TicketTypeWithId;
  quantity: number;
  pricing: PricingPreview;
  promoPreview: PromoCodePreview | null;
  holders: HolderFormState[];
  emailOptIn: boolean;
  smsOptIn: boolean;
  submitting: boolean;
  submitError: string | null;
  onHolderChange: (index: number, next: HolderFormState) => void;
  onEmailOptIn: (v: boolean) => void;
  onSmsOptIn: (v: boolean) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const everyHolderValid = holders.every(
    (h) => h.holderName.trim() && h.holderEmail.trim(),
  );
  const buyer = holders[0];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
        <CheckCircle2 className="w-4 h-4" /> Signed in — your tickets will be
        saved
      </div>

      <div className="rounded-xl bg-cinema-100/60 border border-cinema-200 p-3 space-y-1">
        <p className="text-sm font-semibold text-white">
          {quantity} × {ticketType.name}
        </p>
        <p className="text-xs text-cinema-500">{show.title}</p>
        {promoPreview && pricing.discountCents > 0 && (
          <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-cinema-200 text-sm">
            <span className="text-cinema-600">Promo {promoPreview.code}</span>
            <span className="font-semibold text-emerald-400">
              -{formatAud(pricing.discountCents)}
            </span>
          </div>
        )}
        <div
          className={`flex items-baseline justify-between ${promoPreview ? "pt-1" : "pt-2 mt-1 border-t border-cinema-200"}`}
        >
          <span className="text-sm text-cinema-600">Total</span>
          <span className="text-lg font-bold text-white">
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
            onChange={(next) => onHolderChange(index, next)}
            disabled={submitting}
          />
        ))}
      </div>

      <div className="card-cinema p-3 space-y-2">
        <p className="text-xs uppercase tracking-wide text-cinema-600 font-semibold">
          Your preferences
        </p>
        <label
          className={`flex items-start gap-2 ${buyer?.holderEmail.trim() ? "cursor-pointer" : "opacity-50"}`}
        >
          <input
            type="checkbox"
            checked={emailOptIn}
            onChange={(e) => onEmailOptIn(e.target.checked)}
            disabled={submitting || !buyer?.holderEmail.trim()}
            className="mt-0.5 h-4 w-4 rounded border-cinema-500 text-primary focus:ring-primary"
          />
          <span className="text-xs text-cinema-600">
            Email me about future shows and offers
          </span>
        </label>
        <label
          className={`flex items-start gap-2 ${buyer?.holderPhone.trim() ? "cursor-pointer" : "opacity-50"}`}
        >
          <input
            type="checkbox"
            checked={smsOptIn}
            onChange={(e) => onSmsOptIn(e.target.checked)}
            disabled={submitting || !buyer?.holderPhone.trim()}
            className="mt-0.5 h-4 w-4 rounded border-cinema-500 text-primary focus:ring-primary"
          />
          <span className="text-xs text-cinema-600">
            Text me reminders before shows I've booked
          </span>
        </label>
      </div>

      {submitError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !everyHolderValid}
        className="btn-primary w-full py-3 text-base font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Taking you to checkout…
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" /> Pay {formatAud(pricing.totalCents)}
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="text-xs text-cinema-500 hover:text-white w-full text-center cursor-pointer disabled:opacity-50"
      >
        ← Change tickets
      </button>
    </form>
  );
}
