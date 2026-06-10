// Ticket-claim landing page at /tickets/claim?show=<showId>.
//
// Target of the "you've been sent a ticket" invite email. Shows the event the
// recipient is being given a ticket to, then has them sign in / sign up with
// the invited email so the server can match their verified email to the
// pending share claim and move the ticket into their wallet. Handles the
// "signed in as the wrong account" case explicitly.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  Loader2,
  Ticket,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Calendar,
  MapPin,
  Gift,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { signInWithGoogle } from "../lib/auth";
import {
  claimMyPendingTickets,
  firestoreTicketing,
} from "../lib/firebaseTicketing";
import EmailLinkSignIn from "../features/auth/EmailLinkSignIn";
import {
  formatTicketingDateTime,
  toTicketingDate as toDate,
} from "../lib/ticketingTime";
import type { TicketedShow, TicketVenue } from "../types/ticketingContract";

type ClaimState =
  | "checking"
  | "need_signin"
  | "claiming"
  | "claimed"
  | "none_found"
  | "error";

// Date coercion is imported above as `toDate` from lib/ticketingTime.

export default function ClaimTicket() {
  const [params] = useSearchParams();
  const showId = params.get("show");
  const [show, setShow] = useState<(TicketedShow & { id: string }) | null>(null);
  const [venue, setVenue] = useState<TicketVenue | null>(null);
  const [state, setState] = useState<ClaimState>("checking");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [claimedCount, setClaimedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const processedUid = useRef<string | null>(null);

  // Public show details for context (a published show is readable pre-sign-in).
  useEffect(() => {
    if (!showId) return;
    let active = true;
    getDoc(doc(firestoreTicketing, "shows", showId))
      .then((snap) => {
        if (active && snap.exists())
          setShow({ id: snap.id, ...(snap.data() as TicketedShow) });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [showId]);

  useEffect(() => {
    const venueId = show?.venueId;
    if (!venueId) return;
    let active = true;
    getDoc(doc(firestoreTicketing, "venues", venueId))
      .then((snap) => {
        if (active && snap.exists()) setVenue(snap.data() as TicketVenue);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [show?.venueId]);

  const runClaim = useCallback(async () => {
    setState("claiming");
    setError(null);
    try {
      const result = await claimMyPendingTickets();
      const n = result.claimed?.length ?? 0;
      setClaimedCount(n);
      setState(n > 0 ? "claimed" : "none_found");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We couldn't accept your ticket.",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || user.isAnonymous || !user.email || !user.emailVerified) {
        processedUid.current = null;
        setSignedInEmail(null);
        setState((s) => (s === "claiming" ? s : "need_signin"));
        return;
      }
      setSignedInEmail(user.email);
      if (processedUid.current === user.uid) return; // already handled this account
      processedUid.current = user.uid;
      runClaim();
    });
    return () => unsub();
  }, [runClaim]);

  const handleGoogle = async () => {
    setSigningInGoogle(true);
    try {
      await signInWithGoogle();
    } catch {
      // Listener drives the next state; ignore popup-cancel/transient errors.
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleSignOut = async () => {
    processedUid.current = null;
    await signOut(auth);
    setState("need_signin");
  };

  const startDate = useMemo(() => toDate(show?.startDate), [show]);

  const eventCard = show ? (
    <div className="rounded-xl border border-cinema-200 bg-cinema-100/50 p-3 text-left space-y-1.5">
      <p className="font-bold text-cinema-900">{show.title}</p>
      {startDate && (
        <p className="text-xs text-cinema-700 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          {formatTicketingDateTime(startDate, {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
      {venue?.name && (
        <p className="text-xs text-cinema-700 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          {venue.name}
        </p>
      )}
    </div>
  ) : null;

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="card-cinema p-6 text-center space-y-4">
        {(state === "checking" || state === "claiming") && (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Ticket className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-cinema-900">
              {state === "claiming"
                ? "Adding your ticket…"
                : "Just a moment…"}
            </h1>
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          </>
        )}

        {state === "need_signin" && (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-cinema-900">
              You've been given a ticket
            </h1>
            {eventCard}
            <p className="text-sm text-cinema-600">
              To accept it, sign in or create a free account with the email this
              invite was sent to. Your ticket — with its own QR code — then
              appears in your wallet.
            </p>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={signingInGoogle}
              className="w-full px-4 py-3 rounded-xl border-2 border-cinema-300 bg-white text-gray-700 font-semibold hover:border-primary/60 flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {signingInGoogle ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Accept with Google"
              )}
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-cinema-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-cinema-50 text-cinema-500">
                  or accept with any email
                </span>
              </div>
            </div>
            <EmailLinkSignIn returnPath={`/tickets/claim${showId ? `?show=${encodeURIComponent(showId)}` : ""}`} />
          </>
        )}

        {state === "claimed" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-bold text-cinema-900">
              Ticket accepted! 🎟
            </h1>
            {eventCard}
            <p className="text-sm text-cinema-600">
              {claimedCount > 1
                ? `${claimedCount} tickets are now in your wallet.`
                : "It's in your wallet — show its QR code at the door."}
            </p>
            <Link
              to="/tickets"
              className="btn-primary inline-flex w-full justify-center py-3"
            >
              View my tickets
            </Link>
          </>
        )}

        {state === "none_found" && (
          <>
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <h1 className="text-xl font-bold text-cinema-900">
              No ticket to accept
            </h1>
            <p className="text-sm text-cinema-600">
              We couldn't find a ticket waiting for{" "}
              <span className="font-semibold">{signedInEmail}</span>. If the
              invite was sent to a different email address, sign out and sign in
              with that one.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full px-4 py-2.5 rounded-xl border border-cinema-300 text-cinema-700 font-semibold hover:border-primary/60 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign out & use another email
            </button>
            <Link
              to="/tickets"
              className="text-sm text-cinema-500 hover:text-cinema-900 inline-block"
            >
              Go to my tickets
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <h1 className="text-xl font-bold text-cinema-900">
              Something went wrong
            </h1>
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={runClaim}
              className="btn-primary inline-flex w-full justify-center py-2.5"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
