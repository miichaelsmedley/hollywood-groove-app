import { Gift, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  issueCompTicket,
  ticketAvailableCount,
  useTicketTypes,
} from "../../../lib/firebaseTicketing";
import { dateLabel, newIdempotencyKey, shortId } from "../format";
import type { TicketedShow } from "../../../types/ticketingContract";

const COMPACT_FIELD_CLASS =
  "input-cinema min-h-9 rounded-md px-2 py-1.5 text-[13px] leading-tight";

export default function IssueCompTicketPanel({
  shows,
}: {
  shows: Array<TicketedShow & { id: string }>;
}) {
  const issuableShows = useMemo(
    () =>
      shows.filter(
        (show) =>
          show.ticketingEnabled &&
          ["published", "on_sale", "sold_out"].includes(show.status),
      ),
    [shows],
  );
  const [showId, setShowId] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    ticketTypes,
    loading: ticketTypesLoading,
    error: ticketTypesError,
  } = useTicketTypes(showId || undefined);

  useEffect(() => {
    if (!showId && issuableShows.length > 0) {
      setShowId(issuableShows[0].id);
    }
  }, [issuableShows, showId]);

  useEffect(() => {
    if (ticketTypes.length === 0) {
      setTicketTypeId("");
      return;
    }
    if (!ticketTypes.some((ticketType) => ticketType.id === ticketTypeId)) {
      setTicketTypeId(ticketTypes[0].id);
    }
  }, [ticketTypeId, ticketTypes]);

  const selectedTicketType = ticketTypes.find(
    (ticketType) => ticketType.id === ticketTypeId,
  );
  const available = selectedTicketType
    ? ticketAvailableCount(selectedTicketType)
    : 0;
  const parsedQuantity = Number(quantity);
  const validQuantity =
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1 &&
    parsedQuantity <= Math.min(20, Math.max(1, available));
  const canSubmit =
    Boolean(showId) &&
    Boolean(ticketTypeId) &&
    recipientName.trim().length > 0 &&
    recipientEmail.trim().includes("@") &&
    validQuantity &&
    !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await issueCompTicket({
        showId,
        ticketTypeId,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim(),
        quantity: parsedQuantity,
        note: note.trim() || null,
        idempotencyKey,
      });
      setMessage(
        result.idempotent
          ? `Already issued: ${shortId(result.orderId)}`
          : `Issued ${result.ticketIds.length} comp ticket${result.ticketIds.length === 1 ? "" : "s"} to ${result.recipientEmail}`,
      );
      setRecipientName("");
      setRecipientEmail("");
      setQuantity("1");
      setNote("");
      setIdempotencyKey(newIdempotencyKey());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Comp ticket could not be issued.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <details open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-lg font-bold text-cinema-900">
            <Gift className="w-5 h-5 text-primary" />
            Issue comp ticket
          </span>
          <span className="text-xs font-semibold text-cinema-500">
            {issuableShows.length} show{issuableShows.length === 1 ? "" : "s"}
          </span>
        </summary>

        <form
          onSubmit={handleSubmit}
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1.4fr)_72px_92px]"
        >
          <label className="min-w-0 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Show
            </span>
            <select
              value={showId}
              onChange={(event) => {
                setShowId(event.target.value);
                setTicketTypeId("");
              }}
              className={COMPACT_FIELD_CLASS}
              disabled={submitting || issuableShows.length === 0}
            >
              {issuableShows.length === 0 ? (
                <option value="">No issuable shows</option>
              ) : (
                issuableShows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.title} · {dateLabel(show.startDate)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Ticket type
            </span>
            <select
              value={ticketTypeId}
              onChange={(event) => setTicketTypeId(event.target.value)}
              className={COMPACT_FIELD_CLASS}
              disabled={submitting || ticketTypesLoading || ticketTypes.length === 0}
            >
              {ticketTypesLoading ? (
                <option value="">Loading ticket types</option>
              ) : ticketTypes.length === 0 ? (
                <option value="">No active ticket types</option>
              ) : (
                ticketTypes.map((ticketType) => (
                  <option key={ticketType.id} value={ticketType.id}>
                    {ticketType.name} · {ticketAvailableCount(ticketType)} left
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Qty
            </span>
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={`${COMPACT_FIELD_CLASS} text-center`}
              inputMode="numeric"
              disabled={submitting}
            />
          </label>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Available
            </span>
            <div className="flex min-h-9 items-center rounded-md border border-cinema-200 bg-cinema px-2 py-1.5 text-[13px] font-bold leading-tight text-cinema-900">
              {selectedTicketType ? available : "-"}
            </div>
          </div>

          <label className="min-w-0 space-y-1 xl:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Recipient name
            </span>
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              className={COMPACT_FIELD_CLASS}
              disabled={submitting}
              autoComplete="name"
            />
          </label>

          <label className="min-w-0 space-y-1 xl:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Recipient email
            </span>
            <input
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              className={COMPACT_FIELD_CLASS}
              disabled={submitting}
              autoComplete="email"
              inputMode="email"
            />
          </label>

          <label className="min-w-0 space-y-1 xl:col-span-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Note
            </span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={COMPACT_FIELD_CLASS}
              disabled={submitting}
            />
          </label>

          <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:items-center sm:justify-between xl:col-span-4">
            <div className="min-h-5 text-xs">
              {ticketTypesError && (
                <span className="text-red-700">{ticketTypesError.message}</span>
              )}
              {error && <span className="text-red-700">{error}</span>}
              {message && <span className="text-emerald-700">{message}</span>}
              {!error && !message && selectedTicketType && available === 0 && (
                <span className="text-amber-700">
                  This ticket type has no available inventory.
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-cinema hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Issue comp
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
