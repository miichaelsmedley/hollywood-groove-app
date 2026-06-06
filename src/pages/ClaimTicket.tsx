// Ticket-claim landing page at /tickets/claim.
//
// This is the target of the "you've been sent a ticket" invite email. The
// recipient MUST sign in with the email the ticket was sent to, so the server
// can match their verified email to the pending share claim and move the
// ticket into their wallet. Plain /tickets never prompted a sign-in, so a
// shared ticket could silently go unclaimed — this page closes that gap and
// handles the "you're signed in as the wrong account" case.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Loader2,
  Ticket,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { signInWithGoogle } from "../lib/auth";
import { claimMyPendingTickets } from "../lib/firebaseTicketing";
import EmailLinkSignIn from "../features/auth/EmailLinkSignIn";

type ClaimState =
  | "checking"
  | "need_signin"
  | "claiming"
  | "claimed"
  | "none_found"
  | "error";

export default function ClaimTicket() {
  const [state, setState] = useState<ClaimState>("checking");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [claimedCount, setClaimedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const processedUid = useRef<string | null>(null);

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
        err instanceof Error ? err.message : "We couldn't claim your ticket.",
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
      // onAuthStateChanged drives the next state once sign-in lands.
    } catch {
      // Swallow popup-cancel / transient errors; the listener handles success.
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleSignOut = async () => {
    processedUid.current = null;
    await signOut(auth);
    setState("need_signin");
  };

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="card-cinema p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <Ticket className="w-6 h-6 text-primary" />
        </div>

        {(state === "checking" || state === "claiming") && (
          <>
            <h1 className="text-xl font-bold text-cinema-900">
              {state === "claiming" ? "Adding your ticket…" : "Just a moment…"}
            </h1>
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          </>
        )}

        {state === "need_signin" && (
          <>
            <h1 className="text-xl font-bold text-cinema-900">
              You've been sent a ticket
            </h1>
            <p className="text-sm text-cinema-600">
              Sign in with the email address this invite was sent to, and the
              ticket will be added to your wallet.
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
                "Continue with Google"
              )}
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
            <EmailLinkSignIn returnPath="/tickets/claim" />
          </>
        )}

        {state === "claimed" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-bold text-cinema-900">
              Ticket added to your wallet!
            </h1>
            <p className="text-sm text-cinema-600">
              {claimedCount > 1
                ? `${claimedCount} tickets are now in your wallet.`
                : "Your ticket is ready — show its QR code at the door."}
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
              No ticket to claim
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
