import { Loader2, UserMinus, UserPlus, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  setAdminClaim,
  type AdminClaimRole,
} from "../../../lib/firebaseTicketing";

const TICKETING_ACCESS_ROLES: Array<{
  value: AdminClaimRole;
  label: string;
  helper: string;
}> = [
  {
    value: "door_staff",
    label: "Scanner",
    helper: "Can scan tickets once assigned to a venue.",
  },
  {
    value: "venue_manager",
    label: "Ticketer",
    helper: "Venue-level ticketing lead; can scan and manage door staff at assigned venues.",
  },
  {
    value: "event_admin",
    label: "Ticket admin",
    helper: "Can administer ticketing workflows and issue/refund tickets.",
  },
  {
    value: "platform_admin",
    label: "Absolute admin",
    helper: "Full Hollywood Groove platform access.",
  },
];

export default function TicketingCoAdminsPanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminClaimRole>("event_admin");
  const [busyAction, setBusyAction] = useState<"grant" | "revoke" | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error";
    message: string;
  } | null>(null);

  const targetEmail = email.trim().toLowerCase();
  const canSubmit = targetEmail.includes("@") && busyAction === null;
  const selectedRole =
    TICKETING_ACCESS_ROLES.find((option) => option.value === role) ||
    TICKETING_ACCESS_ROLES[0];

  const updateTicketingRole = async (grant: boolean) => {
    if (!canSubmit) return;
    if (
      !grant &&
      !window.confirm(`Revoke ${selectedRole.label} access for ${targetEmail}?`)
    ) {
      return;
    }

    const action = grant ? "grant" : "revoke";
    setBusyAction(action);
    setFeedback(null);
    try {
      const result = await setAdminClaim({
        email: targetEmail,
        role,
        grant,
      });
      setFeedback({
        tone: "ok",
        message: grant
          ? `Set ${targetEmail} to ${selectedRole.label}. ${result.note}`
          : `Revoked ${selectedRole.label} access for ${targetEmail}. ${result.note}`,
      });
      setEmail("");
    } catch (err) {
      setFeedback({
        tone: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not update ticketing access.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await updateTicketingRole(true);
  };

  return (
    <section className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-cinema-900">
              Ticketing access
            </h2>
          </div>
          <p className="text-sm text-cinema-600">
            Set scanner, ticketer, ticket admin, or absolute admin access for
            band members. The matching PRIS user role is synced when that CRM
            account exists. Scanner and ticketer still need venue assignment
            before door access works.
          </p>
        </div>
      </div>

      <form onSubmit={handleGrant} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)_auto_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
            Band member email
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-cinema"
            disabled={busyAction !== null}
            autoComplete="email"
            inputMode="email"
            placeholder="bandmate@example.com"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-cinema-600">
            Ticketing role
          </span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AdminClaimRole)}
            className="input-cinema"
            disabled={busyAction !== null}
          >
            {TICKETING_ACCESS_ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] leading-snug text-cinema-500">
            {selectedRole.helper}
          </p>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-cinema hover:bg-primary/90 disabled:opacity-60 lg:w-auto"
          >
            {busyAction === "grant" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Apply role
          </button>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => updateTicketingRole(false)}
            disabled={!canSubmit}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 lg:w-auto"
          >
            {busyAction === "revoke" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserMinus className="w-4 h-4" />
            )}
            Revoke role
          </button>
        </div>
      </form>

      {feedback && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            feedback.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </section>
  );
}
