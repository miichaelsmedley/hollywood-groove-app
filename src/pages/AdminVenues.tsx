// Platform-admin venue management.
//
// Venues live in the named Firestore "ticketing" database and are shared by
// Hollywood Groove, The Adele Show, and future white-label ticketing fronts.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { saveVenue, useAdminVenues } from "../lib/firebaseTicketing";
import type { TicketVenue } from "../types/ticketingContract";

interface VenueFormState {
  name: string;
  address: string;
  capacity: string;
  public: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  stripeConnectAccountId: string;
}

const EMPTY_FORM: VenueFormState = {
  name: "",
  address: "",
  capacity: "",
  public: true,
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  stripeConnectAccountId: "",
};

function venueToForm(venue: TicketVenue): VenueFormState {
  return {
    name: venue.name ?? "",
    address: venue.address ?? "",
    capacity: typeof venue.capacity === "number" ? String(venue.capacity) : "",
    public: venue.public !== false,
    contactName: venue.contact?.name ?? "",
    contactEmail: venue.contact?.email ?? "",
    contactPhone: venue.contact?.phone ?? "",
    stripeConnectAccountId: venue.stripeConnectAccountId ?? "",
  };
}

function parseCapacity(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
}

export default function AdminVenues() {
  const { venues, loading, error } = useAdminVenues();
  const [form, setForm] = useState<VenueFormState>(EMPTY_FORM);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const sortedVenues = useMemo(
    () => [...venues].sort((a, b) => a.name.localeCompare(b.name)),
    [venues]
  );

  const editingVenue = editingVenueId
    ? venues.find((venue) => venue.id === editingVenueId)
    : null;

  const resetForm = () => {
    setEditingVenueId(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
  };

  const startEdit = (venue: TicketVenue & { id: string }) => {
    setEditingVenueId(venue.id);
    setForm(venueToForm(venue));
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setFeedback(null);
    try {
      const savedId = await saveVenue(
        {
          name: form.name,
          address: form.address,
          capacity: parseCapacity(form.capacity),
          public: form.public,
          contact: {
            name: form.contactName,
            email: form.contactEmail,
            phone: form.contactPhone,
          },
          stripeConnectAccountId: form.stripeConnectAccountId,
        },
        editingVenueId ?? undefined
      );

      setFeedback({
        tone: "ok",
        message: editingVenueId
          ? "Venue updated."
          : `Venue created. You can now add staff or attach shows to venue ${savedId}.`,
      });
      if (!editingVenueId) {
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      console.error("saveVenue failed", err);
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Could not save venue.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/ticketing"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cinema-500 hover:text-cinema-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to ticketing admin
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold text-cinema-900">Venues</h1>
          </div>
          <p className="max-w-2xl text-sm text-cinema-600">
            Create venues for Hollywood Groove, The Adele Show, and future white-label
            ticketed events. Staff access is managed per venue after the venue exists.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cinema-300 px-4 py-2 text-sm font-bold text-cinema-900 hover:border-primary/70"
        >
          <Plus className="h-4 w-4" />
          New venue
        </button>
      </header>

      {feedback && (
        <section
          className={`rounded-xl border p-4 text-sm ${
            feedback.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.tone === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            <p>{feedback.message}</p>
          </div>
        </section>
      )}

      {error && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{error.message}</p>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <form onSubmit={handleSubmit} className="card-cinema space-y-4 p-4">
          <header className="space-y-1">
            <h2 className="text-lg font-bold text-cinema-900">
              {editingVenue ? `Edit ${editingVenue.name}` : "Add venue"}
            </h2>
            <p className="text-xs text-cinema-500">
              Public venues can be shown on buyer-facing ticket pages.
            </p>
          </header>

          <label className="block">
            <span className="text-xs font-medium text-cinema-700">Venue name</span>
            <input
              className="input-cinema mt-1 px-3 py-2"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Manny's Music Hall"
              required
              disabled={saving}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-cinema-700">Address</span>
            <input
              className="input-cinema mt-1 px-3 py-2"
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="123 Example Street, Melbourne VIC"
              disabled={saving}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-cinema-700">Capacity</span>
              <input
                className="input-cinema mt-1 px-3 py-2"
                type="number"
                min="0"
                inputMode="numeric"
                value={form.capacity}
                onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
                placeholder="120"
                disabled={saving}
              />
            </label>

            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-cinema-200 bg-cinema px-3 py-2">
              <input
                type="checkbox"
                checked={form.public}
                onChange={(event) => setForm((prev) => ({ ...prev, public: event.target.checked }))}
                disabled={saving}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium text-cinema-800">Public on ticket pages</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-cinema-700">Contact name</span>
              <input
                className="input-cinema mt-1 px-3 py-2"
                value={form.contactName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactName: event.target.value }))
                }
                placeholder="Venue contact"
                disabled={saving}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-cinema-700">Contact email</span>
              <input
                className="input-cinema mt-1 px-3 py-2"
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactEmail: event.target.value }))
                }
                placeholder="venue@example.com"
                disabled={saving}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-cinema-700">Contact phone</span>
              <input
                className="input-cinema mt-1 px-3 py-2"
                value={form.contactPhone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactPhone: event.target.value }))
                }
                placeholder="0400 000 000"
                disabled={saving}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-cinema-700">
              Stripe Connect account ID
            </span>
            <input
              className="input-cinema mt-1 px-3 py-2 font-mono text-xs"
              value={form.stripeConnectAccountId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, stripeConnectAccountId: event.target.value }))
              }
              placeholder="Deferred unless this venue gets its own Stripe Connect account"
              disabled={saving}
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="btn-primary inline-flex min-h-11 flex-1 items-center justify-center gap-2 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {editingVenue ? "Save venue" : "Create venue"}
            </button>
            {editingVenue && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cinema-300 px-4 py-3 text-sm font-bold text-cinema-900 hover:border-primary/70 disabled:opacity-50"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <section className="space-y-3">
          <header className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-cinema-900">Existing venues</h2>
            <span className="rounded-full bg-cinema-100 px-2.5 py-1 text-xs font-semibold text-cinema-600">
              {sortedVenues.length} total
            </span>
          </header>

          {loading ? (
            <div className="card-cinema flex min-h-40 items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sortedVenues.length === 0 ? (
            <div className="card-cinema p-4 text-sm text-cinema-700">
              No venues yet. Add the first venue using the form.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedVenues.map((venue) => (
                <article key={venue.id} className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-cinema-900">{venue.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            venue.public
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-cinema-200 text-cinema-700"
                          }`}
                        >
                          {venue.public ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {venue.public ? "Public" : "Private"}
                        </span>
                      </div>
                      {venue.address && (
                        <p className="flex items-center gap-1 text-xs text-cinema-600">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{venue.address}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-cinema-500">
                        {typeof venue.capacity === "number"
                          ? `Capacity ${venue.capacity}`
                          : "Capacity not set"}
                      </p>
                      {venue.contact?.email && (
                        <p className="truncate text-[11px] text-cinema-500">
                          {venue.contact.name ? `${venue.contact.name} · ` : ""}
                          {venue.contact.email}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => startEdit(venue)}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-cinema-300 px-3 py-1.5 text-xs font-semibold text-cinema-800 hover:border-primary/60"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <Link
                        to={`/admin/venues/${venue.id}/staff`}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-cinema hover:bg-primary/90"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Staff
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
