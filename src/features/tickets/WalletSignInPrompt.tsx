// Shown on /tickets when the visitor is anonymous — e.g. they opened their
// ticket confirmation email in a fresh/incognito browser. Tickets are tied to
// the buyer's account, so this guides them to sign in (or create a free
// account) with the email they used at checkout. After sign-in, their tickets
// — with QR codes — appear in the wallet (TicketsHub also sweeps any tickets
// pending for their now-verified email). Mirrors the /tickets/claim pattern.

import { useState } from "react";
import { LogIn, Ticket, Loader2 } from "lucide-react";
import { signInWithGoogle } from "../../lib/auth";
import EmailLinkSignIn from "../auth/EmailLinkSignIn";

export default function WalletSignInPrompt() {
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogle = async () => {
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      // The auth listener drives the next state; ignore popup-cancel/transient errors.
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <section className="space-y-3" aria-label="Sign in to see your tickets">
      <header className="flex items-center gap-2">
        <Ticket className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-cinema-900">Your tickets</h2>
      </header>

      <div className="card-cinema p-5 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <LogIn className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-cinema-900">Sign in to see your tickets</h3>
          <p className="text-sm text-cinema-600">
            Your tickets are linked to your account. Sign in — or create a free
            account — with the{" "}
            <span className="font-semibold">same email you used at checkout</span>, and
            your tickets (with their QR codes) appear here.
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

        <EmailLinkSignIn returnPath="/tickets" />
      </div>
    </section>
  );
}
