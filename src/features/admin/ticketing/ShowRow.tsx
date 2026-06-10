import { ExternalLink, Loader2, Save, Ticket, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/admin/ui";
import {
  ticketAvailableCount,
  updateTicketTypeMaxPerOrder,
  useTicketTypes,
} from "../../../lib/firebaseTicketing";
import type {
  IssuedTicket,
  TicketedShow,
  TicketType,
} from "../../../types/ticketingContract";
import { dateLabel, showStatusTone } from "../format";
import ShowPromoPanel from "./ShowPromoPanel";

export default function ShowRow({
  show,
  tickets,
  canManageStaff,
}: {
  show: TicketedShow & { id: string };
  tickets: Array<IssuedTicket & { id: string }>;
  canManageStaff: boolean;
}) {
  const showTickets = tickets.filter((ticket) => ticket.showId === show.id);
  const sold = showTickets.filter(
    (ticket) => ticket.status === "valid" || ticket.status === "used",
  ).length;
  const used = showTickets.filter((ticket) => ticket.status === "used").length;
  const front =
    show.sellingFrontId === "adele_show"
      ? "The Adele Show"
      : "Hollywood Groove";

  return (
    <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-cinema-900 truncate">
              {show.title}
            </h3>
            <Badge className={showStatusTone(show.status)}>
              {show.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-xs text-cinema-600">
            {dateLabel(show.startDate)} · {front}
          </p>
          <p className="text-xs text-cinema-500">
            {sold} sold, {used} scanned, capacity {show.capacity || "not set"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <Link
            to={`/event/${show.publicSlug || show.id}`}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-cinema-300 px-3 py-1.5 text-xs font-semibold text-cinema-800 hover:border-primary/60"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Event page
          </Link>
          {canManageStaff && show.venueId && (
            <Link
              to={`/admin/venues/${show.venueId}/staff`}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary text-cinema px-3 py-1.5 text-xs font-bold hover:bg-primary/90"
            >
              <Users className="w-3.5 h-3.5" /> Staff
            </Link>
          )}
        </div>
      </div>
      <ShowTicketLimitsPanel show={show} />
      <ShowPromoPanel show={show} />
    </div>
  );
}

// Per-show editor for how many tickets a buyer may purchase in one order.
// Writes maxPerOrder straight to each ticketType doc (platform_admin only per
// rules); createCheckoutSession re-enforces the same cap server-side.
function ShowTicketLimitsPanel({
  show,
}: {
  show: TicketedShow & { id: string };
}) {
  const { ticketTypes, loading } = useTicketTypes(show.id);

  return (
    <div className="mt-3 rounded-lg border border-cinema-200 bg-white/60 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Ticket className="w-3.5 h-3.5 text-cinema-500" />
        <h4 className="text-xs font-bold uppercase tracking-wide text-cinema-600">
          Tickets per order
        </h4>
      </div>
      {loading ? (
        <p className="text-xs text-cinema-500">Loading ticket types...</p>
      ) : ticketTypes.length === 0 ? (
        <p className="text-xs text-cinema-500">
          No active ticket types for this show.
        </p>
      ) : (
        <div className="space-y-2">
          {ticketTypes.map((ticketType) => (
            <MaxPerOrderRow
              key={ticketType.id}
              showId={show.id}
              ticketType={ticketType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaxPerOrderRow({
  showId,
  ticketType,
}: {
  showId: string;
  ticketType: TicketType & { id: string };
}) {
  const available = ticketAvailableCount(ticketType);
  const [value, setValue] = useState(String(ticketType.maxPerOrder ?? 10));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Keep the input in sync if the stored value changes underneath us (e.g. a
  // save lands, or another admin edits) and we're not mid-edit.
  useEffect(() => {
    setValue(String(ticketType.maxPerOrder ?? 10));
  }, [ticketType.maxPerOrder]);

  const parsed = Number(value);
  const dirty = Number.isFinite(parsed) && parsed !== ticketType.maxPerOrder;
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 1000;

  const handleSave = async () => {
    if (!valid || !dirty) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateTicketTypeMaxPerOrder(showId, ticketType.id, parsed);
      setMessage(`Buyers can now order up to ${parsed} per order.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate font-semibold text-cinema-800">
        {ticketType.name}
        <span className="ml-1 font-normal text-cinema-500">
          · {available} left
        </span>
      </span>
      <label className="flex items-center gap-1.5">
        <span className="text-cinema-500">Max / order</span>
        <input
          type="number"
          min={1}
          max={1000}
          step={1}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage(null);
          }}
          disabled={saving}
          className="w-20 rounded-md border border-cinema-300 px-2 py-1 text-cinema-900 focus:border-primary focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty || !valid}
        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 font-bold text-cinema disabled:opacity-40 hover:bg-primary/90"
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        Save
      </button>
      {message && (
        <span className="w-full text-cinema-600">{message}</span>
      )}
    </div>
  );
}
