// Light-touch sign-in / register prompt used at the two post-purchase moments:
//   1. /tickets wallet, when an anonymous visitor opens it (default copy).
//   2. /tickets/success, right after paying (the "committed" moment — pass
//      success copy + the email they bought with via props).
//
// Tickets are tied to the buyer's account, so this guides them to sign in (or
// create a free account) with the email they used at checkout — Google or a
// passwordless email link. After sign-in their tickets (with QR codes) appear
// in the wallet (TicketsHub also sweeps tickets pending for their verified
// email). Deliberately offers no "skip / continue as guest" button: it's not
// mandatory (they can navigate away), just not advertised as optional.

import { useState } from "react";
import type { ReactNode } from "react";
import { LogIn, Ticket, Loader2 } from "lucide-react";
import { signInWithGoogle } from "../../lib/auth";
import EmailLinkSignIn from "../auth/EmailLinkSignIn";

interface WalletSignInPromptProps {
  /** Section heading above the card; pass null to render the card headless. */
  heading?: string | null;
  title?: string;
  subtitle?: ReactNode;
  /** Where the email-link round-trip returns to. Defaults to /tickets. */
  returnPath?: string;
  /** Pre-fill the email field (e.g. the address they just bought with). */
  defaultEmail?: string;
  /** Called after a successful inline (Google) sign-in — e.g. to navigate. */
  onSignedIn?: () => void;
}

export default function WalletSignInPrompt({
  heading = "Your tickets",
  title = "Sign in to see your tickets",
  subtitle,
  returnPath = "/tickets",
  defaultEmail,
  onSignedIn,
}: WalletSignInPromptProps) {
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogle = async () => {
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      onSignedIn?.();
    } catch {
      // The auth listener drives the next state; ignore popup-cancel/transient errors.
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <section className="space-y-3" aria-label={title}>
      {heading && (
        <header className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-cinema-900">{heading}</h2>
        </header>
      )}

      <div className="card-cinema p-5 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <LogIn className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-cinema-900">{title}</h3>
          <p className="text-sm text-cinema-600">
            {subtitle ?? (
              <>
                Your tickets are linked to your account. Sign in — or create a
                free account — with the{" "}
                <span className="font-semibold">same email you used at checkout</span>,
                and your tickets (with their QR codes) appear here.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleBusy}
          className="w-full px-4 py-3 rounded-xl border-2 border-cinema-300 bg-white text-gray-700 font-semibold hover:border-primary/60 flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {googleBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue with Google"}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-cinema-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-cinema-50 text-cinema-500">or use any email</span>
          </div>
        </div>

        <EmailLinkSignIn returnPath={returnPath} defaultEmail={defaultEmail} />
      </div>
    </section>
  );
}
