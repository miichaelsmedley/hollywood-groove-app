// Admin page: manage door staff and venue managers for a venue.
// Route: /admin/venues/:venueId/staff
// Gated by <AdminRoute> in App.tsx (platform_admin only).
//
// You can:
//   - Invite someone by email (gives them door_staff or venue_manager when
//     they next sign in with that email)
//   - Revoke an existing staff member at this venue
//   - Cancel a pending invite
//   - Set an optional expiry on a new grant ("just for tonight")

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, UserPlus, X, Loader2, Shield, ShieldCheck, Clock, Mail } from "lucide-react";
import {
  firestoreTicketing,
  grantVenueStaff,
  revokeVenueStaff,
  useVenueStaff,
  type VenueStaffRole,
} from "../lib/firebaseTicketing";
import type { TicketVenue } from "../types/ticketingContract";

const ROLE_LABEL: Record<VenueStaffRole, string> = {
  door_staff: "Door staff",
  venue_manager: "Venue manager",
};

interface VenueState {
  venue: (TicketVenue & { id: string }) | null;
  loading: boolean;
}

export default function AdminVenueStaff() {
  const { venueId } = useParams<{ venueId: string }>();
  const [venueState, setVenueState] = useState<VenueState>({ venue: null, loading: true });
  const { staff, invites } = useVenueStaff(venueId);

  // Grant form state.
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<VenueStaffRole>("door_staff");
  const [expiryChoice, setExpiryChoice] = useState<"open" | "24h" | "7d">("open");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!venueId) return;
    const unsub = onSnapshot(
      doc(firestoreTicketing, "venues", venueId),
      (snap) => {
        if (snap.exists()) {
          setVenueState({
            venue: { id: snap.id, ...(snap.data() as TicketVenue) },
            loading: false,
          });
        } else {
          setVenueState({ venue: null, loading: false });
        }
      },
      () => setVenueState({ venue: null, loading: false })
    );
    return () => unsub();
  }, [venueId]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId || !email.trim()) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      let expiresAt: number | null = null;
      if (expiryChoice === "24h") expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      if (expiryChoice === "7d") expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

      const result = await grantVenueStaff({
        venueId,
        email: email.trim(),
        role,
        expiresAt,
      });

      if (result.outcome === "granted") {
        setFeedback({
          tone: "ok",
          message: `Granted ${ROLE_LABEL[role]} to that user. They'll need to refresh their app to see the change.`,
        });
      } else {
        setFeedback({
          tone: "ok",
          message: `Invite sent. ${email.trim()} will get access automatically next time they sign in.`,
        });
      }
      setEmail("");
      setExpiryChoice("open");
    } catch (err) {
      console.error("grantVenueStaff failed", err);
      const message = err instanceof Error ? err.message : "Could not grant access.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeStaff = async (uid: string) => {
    if (!venueId) return;
    if (!confirm("Revoke this person's access at this venue?")) return;
    try {
      await revokeVenueStaff({ venueId, targetUid: uid });
      setFeedback({ tone: "ok", message: "Access revoked." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not revoke.";
      setFeedback({ tone: "error", message });
    }
  };

  const handleCancelInvite = async (inviteEmail: string) => {
    if (!venueId) return;
    if (!confirm("Cancel this pending invite?")) return;
    try {
      await revokeVenueStaff({ venueId, email: inviteEmail });
      setFeedback({ tone: "ok", message: "Invite cancelled." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not cancel invite.";
      setFeedback({ tone: "error", message });
    }
  };

  const sortedStaff = useMemo(
    () =>
      [...staff].sort((a, b) => {
        // venue_manager first
        if (a.role !== b.role) return a.role === "venue_manager" ? -1 : 1;
        return a.uid.localeCompare(b.uid);
      }),
    [staff]
  );

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-cinema-500 hover:text-cinema-900 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back home
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-cinema-900">Venue door staff</h1>
        <p className="text-cinema-600 text-sm mt-1">
          {venueState.loading
            ? "Loading venue…"
            : venueState.venue
              ? `Manage scanner access at ${venueState.venue.name}.`
              : "This venue couldn't be loaded."}
        </p>
      </header>

      {feedback && (
        <div
          className={`rounded-xl p-3 text-sm border ${
            feedback.tone === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Invite / grant form */}
      <section className="card-cinema p-4 space-y-3" aria-label="Invite a scanner">
        <header className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold text-cinema-900">Invite a scanner</h2>
        </header>
        <form onSubmit={handleGrant} className="space-y-3">
          <label className="block">
            <span className="text-xs text-cinema-700 font-medium">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
              className="input-cinema mt-1 w-full"
              placeholder="dave@example.com"
              autoComplete="off"
            />
            <p className="text-[11px] text-cinema-500 mt-1">
              They'll need to sign in to the Hollywood Groove app with this email (via
              Google) to activate their scanner access.
            </p>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-cinema-700 font-medium">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as VenueStaffRole)}
                disabled={submitting}
                className="input-cinema mt-1 w-full"
              >
                <option value="door_staff">Door staff (scanner only)</option>
                <option value="venue_manager">
                  Venue manager (can also grant door staff at this venue)
                </option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-cinema-700 font-medium">Expires</span>
              <select
                value={expiryChoice}
                onChange={(e) => setExpiryChoice(e.target.value as "open" | "24h" | "7d")}
                disabled={submitting}
                className="input-cinema mt-1 w-full"
              >
                <option value="open">Open-ended (until I revoke)</option>
                <option value="24h">In 24 hours (one-off helper)</option>
                <option value="7d">In 7 days</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Grant access
              </>
            )}
          </button>
        </form>
      </section>

      {/* Current staff */}
      <section className="space-y-2">
        <h2 className="text-base font-bold text-cinema-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Current staff
        </h2>
        {sortedStaff.length === 0 ? (
          <div className="card-cinema p-4 text-sm text-cinema-700">
            Nobody has scanner access at this venue yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedStaff.map((s) => (
              <li key={s.id} className="card-cinema p-3 flex items-center gap-3">
                <Shield
                  className={`w-4 h-4 flex-shrink-0 ${
                    s.role === "venue_manager" ? "text-amber-500" : "text-cinema-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-cinema-900">{ROLE_LABEL[s.role]}</p>
                  <p className="text-[11px] text-cinema-500 font-mono truncate">{s.uid}</p>
                  {s.invitedEmail && (
                    <p className="text-[11px] text-cinema-500 truncate">
                      Invited as {s.invitedEmail}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRevokeStaff(s.uid)}
                  className="text-cinema-400 hover:text-red-600 transition-colors p-1"
                  title="Revoke"
                  aria-label={`Revoke ${ROLE_LABEL[s.role]}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending invites */}
      <section className="space-y-2">
        <h2 className="text-base font-bold text-cinema-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Pending invites
        </h2>
        {invites.length === 0 ? (
          <div className="card-cinema p-4 text-sm text-cinema-700">
            No invites waiting to be redeemed.
          </div>
        ) : (
          <ul className="space-y-2">
            {invites.map((i) => (
              <li key={i.id} className="card-cinema p-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-cinema-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-cinema-900 truncate">{i.email}</p>
                  <p className="text-[11px] text-cinema-500">
                    {ROLE_LABEL[i.role]} · waiting for sign-in
                  </p>
                </div>
                <button
                  onClick={() => handleCancelInvite(i.email)}
                  className="text-cinema-400 hover:text-red-600 transition-colors p-1"
                  title="Cancel invite"
                  aria-label="Cancel invite"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!!staff.length || !!invites.length ? (
        <p className="text-[11px] text-cinema-500">
          Access changes take effect on the staffer's next ID token refresh (within an
          hour, or immediately on next sign-in).
        </p>
      ) : null}
    </div>
  );
}
