import { BadgePercent, Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "../../../components/admin/ui";
import {
  deletePromoCode,
  formatAud,
  savePromoCode,
  usePromoCodes,
} from "../../../lib/firebaseTicketing";
import { toTicketingMillis } from "../../../lib/ticketingTime";
import type {
  TicketPromoCode,
  TicketedShow,
} from "../../../types/ticketingContract";
import { dateLabel } from "../format";

function promoExpiryLabel(promo: TicketPromoCode): string {
  const millis = toTicketingMillis(promo.validUntil);
  return millis ? `Valid until ${dateLabel(promo.validUntil)}` : "No end date";
}

// Format a stored validUntil into the value a <input type="datetime-local">
// expects (local YYYY-MM-DDTHH:mm), so editing pre-fills the existing date.
function toDatetimeLocal(value: unknown): string {
  const millis = toTicketingMillis(value);
  if (!millis) return "";
  const d = new Date(millis);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ShowPromoPanel({
  show,
}: {
  show: TicketedShow & { id: string };
}) {
  const { promoCodes, loading } = usePromoCodes(show.id);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState("10");
  const [validUntil, setValidUntil] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const resetForm = () => {
    setCode("");
    setDiscountType("percent");
    setDiscountValue("10");
    setValidUntil("");
    setMaxRedemptions("");
    setActive(true);
    setEditingCode(null);
  };

  // Load an existing code's settings into the form. The code itself is the
  // record key, so it's locked while editing -- to rename, delete and re-create.
  const loadForEdit = (promo: TicketPromoCode) => {
    setCode(promo.code);
    setDiscountType(promo.discountType);
    setDiscountValue(
      promo.discountType === "percent"
        ? String(promo.percentOff ?? "")
        : String(Number(promo.amountOffCents ?? 0) / 100),
    );
    setValidUntil(toDatetimeLocal(promo.validUntil));
    setMaxRedemptions(promo.maxRedemptions ? String(promo.maxRedemptions) : "");
    setActive(promo.active);
    setEditingCode(promo.code);
    setMessage(null);
  };

  const handleDelete = async (promo: TicketPromoCode) => {
    if (
      !window.confirm(`Delete promo code "${promo.code}"? This can't be undone.`)
    ) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await deletePromoCode(show.id, promo.code);
      setMessage(`${promo.code} deleted`);
      if (editingCode === promo.code) resetForm();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Promo code could not be deleted.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericDiscount = Number(discountValue);
    const maxUses = Number(maxRedemptions);
    setSaving(true);
    setMessage(null);
    try {
      const savedCode = await savePromoCode(show.id, {
        code,
        active,
        discountType,
        percentOff: discountType === "percent" ? numericDiscount : null,
        amountOffCents:
          discountType === "amount" ? Math.round(numericDiscount * 100) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        maxRedemptions:
          Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
      });
      const wasEditing = editingCode !== null;
      resetForm();
      setMessage(`${savedCode} ${wasEditing ? "updated" : "saved"}`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Promo code could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mt-3 border-t border-cinema-200 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-cinema-900">
        <span className="inline-flex items-center gap-2">
          <BadgePercent className="w-4 h-4 text-primary" />
          Promos
        </span>
        <span className="text-xs font-medium text-cinema-500">
          {loading
            ? "Loading..."
            : `${promoCodes.length} code${promoCodes.length === 1 ? "" : "s"}`}
        </span>
      </summary>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.25fr]">
        <div className="space-y-2 rounded-lg border border-cinema-200 bg-white p-3">
          {promoCodes.length === 0 ? (
            <p className="text-xs text-cinema-500">No promo codes yet.</p>
          ) : (
            promoCodes.slice(0, 5).map((promo) => {
              const amount =
                promo.discountType === "percent"
                  ? `${promo.percentOff ?? 0}%`
                  : formatAud(Number(promo.amountOffCents ?? 0));
              const committed =
                Number(promo.redemptionCount ?? 0) +
                Number(promo.reservationCount ?? 0);
              return (
                <div
                  key={promo.id}
                  className="border-b border-cinema-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-cinema-900">
                      {promo.code}
                    </span>
                    <Badge
                      className={
                        promo.active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-cinema-200 text-cinema-700"
                      }
                    >
                      {promo.active ? "active" : "off"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-cinema-500">
                    {amount} off · {committed}/
                    {promo.maxRedemptions || "no limit"} used or reserved ·{" "}
                    {promoExpiryLabel(promo)}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => loadForEdit(promo)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(promo)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={handleSave}
          className="grid gap-2 rounded-lg border border-cinema-200 bg-white p-3 sm:grid-cols-2"
        >
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Code{editingCode ? " (locked)" : ""}
            </span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="input-cinema uppercase disabled:opacity-60"
              placeholder="EARLYBIRD"
              disabled={saving || editingCode !== null}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Discount
            </span>
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(event) =>
                  setDiscountType(event.target.value as "percent" | "amount")
                }
                className="input-cinema w-28"
                disabled={saving}
              >
                <option value="percent">Percent</option>
                <option value="amount">Amount</option>
              </select>
              <input
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                className="input-cinema min-w-0 flex-1"
                inputMode="decimal"
                disabled={saving}
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Valid until
            </span>
            <input
              type="datetime-local"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              className="input-cinema"
              disabled={saving}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
              Max uses
            </span>
            <input
              value={maxRedemptions}
              onChange={(event) => setMaxRedemptions(event.target.value)}
              className="input-cinema"
              inputMode="numeric"
              disabled={saving}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-cinema-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-cinema-300 text-primary focus:ring-primary"
            />
            Active
          </label>
          <div className="flex items-center justify-end gap-2">
            {message && (
              <span className="text-xs text-cinema-600">{message}</span>
            )}
            {editingCode && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-cinema-300 px-3 text-xs font-semibold text-cinema-700 hover:border-primary/60 disabled:opacity-60"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-cinema hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {editingCode ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
