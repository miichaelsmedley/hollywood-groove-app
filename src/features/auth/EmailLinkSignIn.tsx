// Standalone email-link (passwordless) sign-in form. Used on the Signup
// page below the "Continue with Google" button. Works for any email
// provider; the user types their email, taps Send, then taps the link
// Firebase emails them to land on /auth/finish where sign-in completes.

import { useState } from "react";
import { Mail, Loader2, Check, AlertCircle } from "lucide-react";
import { sendEmailLinkSignIn } from "../../lib/auth";

type Phase = "form" | "sending" | "sent" | "error";

interface EmailLinkSignInProps {
  /**
   * Path the buyer returns to after tapping the email link (e.g. an event
   * page mid-checkout). Defaults to /tickets when omitted.
   */
  returnPath?: string;
  /** Pre-fill the email field (e.g. the address used at checkout). */
  defaultEmail?: string;
}

export default function EmailLinkSignIn({ returnPath, defaultEmail }: EmailLinkSignInProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setPhase("sending");
    setErrorMessage(null);
    try {
      await sendEmailLinkSignIn(email, returnPath);
      setPhase("sent");
    } catch (err) {
      console.error("sendEmailLinkSignIn failed", err);
      // The sign-in link now comes from the sendEmailSignInLink callable, which
      // returns friendly HttpsError messages (rate limit, bad email, send
      // failure) that propagate as err.message. Only App Check / session
      // attestation failures need a clearer override.
      const code = ((err as { code?: string }).code ?? "").toLowerCase();
      let message =
        err instanceof Error && err.message
          ? err.message
          : "Couldn't send the link. Please try again.";
      if (
        code.includes("unauthenticated") ||
        code.includes("failed-precondition") ||
        code.includes("app-check") ||
        code.includes("appcheck")
      ) {
        message =
          "Couldn't verify this app session. Refresh the page and try again.";
      }
      setErrorMessage(message);
      setPhase("error");
    }
  };

  if (phase === "sent") {
    return (
      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
        <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold">
          <Check className="w-4 h-4" /> Check your inbox
        </div>
        <p className="text-xs text-emerald-700">
          We've emailed a sign-in link to <strong>{email}</strong>. Tap the link from
          this device for the smoothest sign-in.
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase("form");
            setEmail("");
          }}
          className="text-[11px] text-emerald-700 underline mt-1"
        >
          Send to a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cinema-400 pointer-events-none" />
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (phase === "error") setPhase("form");
          }}
          required
          disabled={phase === "sending"}
          className="input-cinema w-full pl-9"
          placeholder="Use any email — we'll send you a sign-in link"
          autoComplete="email"
        />
      </div>
      <button
        type="submit"
        disabled={phase === "sending" || !email.trim()}
        className="w-full px-3 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-primary/60 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
      >
        {phase === "sending" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Sending link…
          </>
        ) : (
          <>
            <Mail className="w-4 h-4" /> Email me a sign-in link
          </>
        )}
      </button>
      {errorMessage && (
        <div className="flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </form>
  );
}
