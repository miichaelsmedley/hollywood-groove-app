// /auth/finish — completes a Firebase email-link sign-in.
//
// When the user taps the "sign in" link in their email, Firebase verifies
// the code then redirects them here with the link's URL. We pull the email
// they used to request the link (from localStorage) and complete sign-in.
// If they opened the link in a different browser (no localStorage), we
// prompt them to retype the email.
//
// After sign-in, the AutoClaimVenueStaffInvites effect in App.tsx fires and
// redeems any pending invites for this email automatically.

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";
import { completeEmailLinkSignIn, isSignInWithEmailLink } from "../lib/auth";
import { auth } from "../lib/firebase";
import { safeInternalPath } from "../lib/safeRedirect";

type Phase = "verifying" | "needs_email" | "success" | "failed";

export default function AuthFinish() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Constrain to an in-app path so `?return=` can't redirect off-site after sign-in.
  const returnUrl = safeInternalPath(params.get("return"), "/tickets");

  const [phase, setPhase] = useState<Phase>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setPhase("failed");
      setErrorMessage("This link isn't a valid sign-in link. It may have expired.");
      return;
    }
    completeEmailLinkSignIn()
      .then(() => setPhase("success"))
      .catch((err) => {
        if (err instanceof Error && err.message === "MISSING_EMAIL") {
          setPhase("needs_email");
        } else {
          setPhase("failed");
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      });
  }, []);

  // Redirect on success after a brief acknowledgement so the user can see
  // the result and the AutoClaim effect has time to run.
  useEffect(() => {
    if (phase !== "success") return;
    const timer = setTimeout(() => {
      navigate(returnUrl, { replace: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase, navigate, returnUrl]);

  const handleRetry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fallbackEmail.trim()) return;
    setRetrying(true);
    setErrorMessage(null);
    try {
      await completeEmailLinkSignIn(fallbackEmail);
      setPhase("success");
    } catch (err) {
      setPhase("failed");
      setErrorMessage(
        err instanceof Error
          ? err.message === "MISSING_EMAIL"
            ? "Please enter the email you used to request the link."
            : err.message
          : String(err)
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-cinema-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-cinema-50 rounded-2xl p-6 border border-cinema-200 space-y-4">
        {phase === "verifying" && (
          <div className="flex items-start gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="text-lg font-bold text-cinema-900 mb-1">Signing you in…</h1>
              <p className="text-sm text-cinema-600">Just a moment.</p>
            </div>
          </div>
        )}

        {phase === "needs_email" && (
          <form onSubmit={handleRetry} className="space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h1 className="text-lg font-bold text-cinema-900 mb-1">
                  Confirm your email
                </h1>
                <p className="text-sm text-cinema-600">
                  Looks like you opened this link in a different browser or device.
                  Just type the email you used to request it, and we'll finish signing
                  you in.
                </p>
              </div>
            </div>
            <input
              type="email"
              value={fallbackEmail}
              onChange={(e) => setFallbackEmail(e.target.value)}
              required
              autoFocus
              disabled={retrying}
              className="input-cinema w-full"
              placeholder="name@example.com"
              autoComplete="email"
            />
            {errorMessage && (
              <p className="text-sm text-red-700">{errorMessage}</p>
            )}
            <button
              type="submit"
              disabled={retrying || !fallbackEmail.trim()}
              className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {retrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        )}

        {phase === "success" && (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="text-lg font-bold text-cinema-900 mb-1">Signed in</h1>
              <p className="text-sm text-cinema-600">
                Taking you to the app…
              </p>
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-7 h-7 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h1 className="text-lg font-bold text-cinema-900 mb-1">
                  Couldn't sign you in
                </h1>
                <p className="text-sm text-cinema-600">
                  {errorMessage ??
                    "Something went wrong. Try requesting a new sign-in link."}
                </p>
              </div>
            </div>
            <Link
              to="/signup"
              className="btn-primary block py-3 text-center text-sm font-bold"
            >
              Try again
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
