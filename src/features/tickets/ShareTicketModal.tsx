import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Send, X } from "lucide-react";
import { shareTicket } from "../../lib/firebaseTicketing";
import type { IssuedTicket } from "../../types/ticketingContract";

interface ShareTicketModalProps {
  ticket: IssuedTicket & { id: string };
  open: boolean;
  onClose: () => void;
  onShared?: (email: string) => void;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Couldn't send this ticket right now. Please try again.";
}

export default function ShareTicketModal({
  ticket,
  open,
  onClose,
  onShared,
}: ShareTicketModalProps) {
  const titleId = useId();
  const noteId = useId();
  const mountedRef = useRef(true);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setRecipientEmail("");
    setRecipientName("");
    setBusy(false);
    setError(null);
    setSentEmail(null);
  }, [open, ticket.id]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const email = recipientEmail.trim().toLowerCase();
    const name = recipientName.trim();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    setError(null);
    setSentEmail(null);
    try {
      const result = await shareTicket({
        ticketId: ticket.id,
        recipientEmail: email,
        recipientName: name || undefined,
      });
      const sharedToEmail = result.sharedToEmail || email;
      if (!mountedRef.current) return;
      setSentEmail(sharedToEmail);
      setBusy(false);
      onShared?.(sharedToEmail);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={noteId}
        onSubmit={handleSubmit}
        className="card-cinema w-full max-w-md p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-cinema-900">
              Send this ticket to a friend
            </h2>
            <p className="text-xs text-cinema-500 mt-1 truncate max-w-[16rem] sm:max-w-xs">
              {ticket.holderName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-cinema-500 hover:bg-cinema-100 hover:text-cinema-900 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-cinema-800">
            Recipient email
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={recipientEmail}
              onChange={(event) => {
                setRecipientEmail(event.target.value);
                setError(null);
              }}
              className="input-cinema mt-1 w-full"
              placeholder="friend@example.com"
              disabled={busy || Boolean(sentEmail)}
            />
          </label>

          <label className="block text-sm font-semibold text-cinema-800">
            Recipient name <span className="font-normal text-cinema-500">(optional)</span>
            <input
              type="text"
              autoComplete="name"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              className="input-cinema mt-1 w-full"
              placeholder="Friend's name"
              disabled={busy || Boolean(sentEmail)}
            />
          </label>
        </div>

        <p id={noteId} className="rounded-lg bg-primary/10 p-3 text-sm text-cinema-700">
          They'll get an email, sign in, and the ticket moves to their wallet — it will leave yours.
        </p>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {sentEmail && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            Sent to {sentEmail}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-cinema-200 px-4 py-2 text-sm font-semibold text-cinema-700 hover:bg-cinema-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || Boolean(sentEmail)}
            className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send ticket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
