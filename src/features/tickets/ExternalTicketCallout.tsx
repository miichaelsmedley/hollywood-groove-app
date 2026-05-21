// Renders a "Buy tickets via <external platform>" card on ShowDetail when
// the show has no internal ticketing (no Firestore TicketedShow with
// ticketingEnabled=true) but does have a `ticketUrl` set on the RTDB show
// meta. The ticketUrl is controller-driven — some venues won't let HG
// ticket their shows and provide their own Eventbrite/Moshtix/etc. URL.

import { ExternalLink, Ticket } from "lucide-react";
import { useTicketedShow } from "../../lib/firebaseTicketing";

interface ExternalTicketCalloutProps {
  showId: string;
  ticketUrl?: string;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the venue's site";
  }
}

export default function ExternalTicketCallout({ showId, ticketUrl }: ExternalTicketCalloutProps) {
  const { show, loading } = useTicketedShow(showId);

  if (!ticketUrl || loading) return null;

  // Internal ticketing takes precedence. If this show has an active
  // Firestore TicketedShow, the embedded TicketPurchasePanel handles it.
  const hasInternal =
    Boolean(show?.ticketingEnabled) &&
    show?.status !== "cancelled" &&
    show?.status !== "completed";
  if (hasInternal) return null;

  return (
    <section className="card-cinema p-5 space-y-3" aria-label="Buy tickets">
      <header className="flex items-center gap-2">
        <Ticket className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-cinema-900">Buy tickets</h2>
      </header>
      <p className="text-sm text-cinema-700">
        This venue handles its own ticketing. You'll be taken to {hostLabel(ticketUrl)} to
        complete your purchase. Once you've bought a ticket there, your seat is confirmed
        — but Hollywood Groove won't be able to show it in your wallet.
      </p>
      <a
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary py-3 px-4 text-sm font-semibold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
      >
        Buy tickets at {hostLabel(ticketUrl)} <ExternalLink className="w-4 h-4" />
      </a>
    </section>
  );
}
